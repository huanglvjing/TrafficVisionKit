"""数据聚合服务（Phase 5）。

职责：
  1. 接收来自各设备 db_write_loop 的逐帧统计数据，写入内存缓冲区（add_sample）。
  2. 每 60 秒将缓冲区聚合一次，写 traffic_records 表，并触发 flow_spike 检测。
  3. 每整点将上一小时的 traffic_records 聚合写入 hourly_statistics 表。

flow_spike 冷启动保护（见设计稿 9.2 节）：
  若同一设备同一小时段在 hourly_statistics 中历史数据条数 < 7，跳过 flow_spike 检测，
  并向 system_logs 写一条 info 日志（每小时每设备只写一次，避免刷屏）。
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, func, select
from sqlalchemy.dialects.mysql import insert as mysql_insert

from database import AsyncSessionLocal
from models import HourlyStatistics, SystemLog, TrafficAlert, TrafficRecord

logger = logging.getLogger(__name__)


@dataclass
class _DeviceBuffer:
    """单设备当前 60 秒窗口内的聚合缓冲区。"""
    vehicle_counts: list[int] = field(default_factory=list)
    passed_in: int = 0
    passed_out: int = 0
    # 0002 新增
    occupancy_samples: list[float] = field(default_factory=list)
    speed_samples: list[float] = field(default_factory=list)
    max_speed_samples: list[float] = field(default_factory=list)
    speed_violation_count: int = 0
    headway_samples: list[float] = field(default_factory=list)
    min_headway_samples: list[float] = field(default_factory=list)
    queue_lengths: list[int] = field(default_factory=list)
    los_grades: list[str] = field(default_factory=list)
    wrong_way_count: int = 0


def _utcnow_naive() -> datetime:
    """返回 UTC 无时区信息的 datetime，与 MySQL DATETIME 字段类型匹配。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Aggregator:
    """全局单例：内存聚合缓冲区 + 定时写库。"""

    def __init__(self) -> None:
        # {device_id: _DeviceBuffer}
        self._buffers: dict[int, _DeviceBuffer] = {}
        # 定时任务句柄
        self._minute_task: Optional[asyncio.Task] = None
        # flow_spike 冷启动日志：{device_id: last_logged_hour}，避免每分钟刷 system_logs
        self._cold_start_logged_hour: dict[int, int] = {}

    # ── 外部接口 ────────────────────────────────────────────────────────────────

    def add_sample(self, device_id: int, data: dict) -> None:
        """被 db_write_loop 每帧调用，纯内存操作，不阻塞事件循环。"""
        buf = self._buffers.setdefault(device_id, _DeviceBuffer())
        buf.vehicle_counts.append(data.get("vehicle_count", 0))
        buf.passed_in += data.get("passed_in", 0)
        buf.passed_out += data.get("passed_out", 0)
        # 0002 新增指标
        occ = data.get("occupancy")
        if occ is not None:
            buf.occupancy_samples.append(occ)
        asp = data.get("avg_speed")
        if asp is not None:
            buf.speed_samples.append(asp)
        msp = data.get("max_speed")
        if msp is not None:
            buf.max_speed_samples.append(msp)
        buf.speed_violation_count += data.get("speed_violation_count", 0)
        ahw = data.get("avg_headway")
        if ahw is not None:
            buf.headway_samples.append(ahw)
        mhw = data.get("min_headway")
        if mhw is not None:
            buf.min_headway_samples.append(mhw)
        ql = data.get("queue_length")
        if ql is not None:
            buf.queue_lengths.append(ql)
        lg = data.get("los_grade")
        if lg:
            buf.los_grades.append(lg)
        buf.wrong_way_count += data.get("wrong_way_count", 0)

    def run(self) -> None:
        """启动分钟聚合协程（main.py lifespan 启动时调用）。"""
        self._minute_task = asyncio.create_task(
            self._minute_loop(), name="aggregator_minute"
        )

    async def stop(self) -> None:
        """取消聚合协程（main.py lifespan 关闭时调用）。"""
        if self._minute_task and not self._minute_task.done():
            self._minute_task.cancel()
            try:
                await self._minute_task
            except asyncio.CancelledError:
                pass
        logger.info("[Aggregator] stopped")

    # ── 分钟循环 ────────────────────────────────────────────────────────────────

    async def _minute_loop(self) -> None:
        """对齐到下一整分钟后，每 60 秒聚合一次；跨小时时触发小时聚合。"""
        # 首次对齐到下一个整分钟，保证 recorded_at 与实际时钟分钟对齐
        now = datetime.now(timezone.utc)
        next_minute = (now + timedelta(minutes=1)).replace(second=0, microsecond=0)
        initial_wait = (next_minute - now).total_seconds()
        try:
            await asyncio.sleep(initial_wait)
        except asyncio.CancelledError:
            return

        last_hour: Optional[int] = None

        while True:
            try:
                # recorded_at = 刚结束的那一分钟（truncated to minute，无时区）
                recorded_at = datetime.now(timezone.utc).replace(
                    second=0, microsecond=0, tzinfo=None
                )

                await self._flush_minute(recorded_at)

                # 小时边界检测：当小时号发生变化时，聚合上一小时
                current_hour = recorded_at.hour
                if last_hour is not None and current_hour != last_hour:
                    # 上一小时的起始时刻
                    prev_hour_at = recorded_at.replace(minute=0) - timedelta(hours=1)
                    asyncio.create_task(
                        self._flush_hour(prev_hour_at),
                        name=f"agg_hour_{prev_hour_at:%H%M}",
                    )
                last_hour = current_hour

                # 精确等待到下一个整分钟
                now = datetime.now(timezone.utc)
                next_min = (now + timedelta(minutes=1)).replace(second=0, microsecond=0)
                await asyncio.sleep((next_min - now).total_seconds())

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.exception(f"[Aggregator] minute loop error: {exc}")
                await asyncio.sleep(10)

    # ── 分钟聚合写 traffic_records ───────────────────────────────────────────────

    async def _flush_minute(self, recorded_at: datetime) -> None:
        """将所有设备缓冲区快照写入 traffic_records，完成后检查 flow_spike。"""
        # asyncio 单线程：安全地拍摄快照并清空缓冲区
        snapshot: dict[int, _DeviceBuffer] = {}
        for device_id, buf in list(self._buffers.items()):
            if buf.vehicle_counts:
                snapshot[device_id] = buf
                self._buffers[device_id] = _DeviceBuffer()

        if not snapshot:
            return

        # 逐设备写库，互不影响
        for device_id, buf in snapshot.items():
            avg_count = round(sum(buf.vehicle_counts) / len(buf.vehicle_counts))
            max_count = max(buf.vehicle_counts)
            passed_in = buf.passed_in
            passed_out = buf.passed_out
            passed_count = passed_in + passed_out

            # 计算新指标聚合值
            avg_occ = (
                sum(buf.occupancy_samples) / len(buf.occupancy_samples)
                if buf.occupancy_samples else None
            )
            avg_spd = (
                sum(buf.speed_samples) / len(buf.speed_samples)
                if buf.speed_samples else None
            )
            max_spd = max(buf.max_speed_samples) if buf.max_speed_samples else None
            avg_hw = (
                sum(buf.headway_samples) / len(buf.headway_samples)
                if buf.headway_samples else None
            )
            min_hw = min(buf.min_headway_samples) if buf.min_headway_samples else None
            queue_len = max(buf.queue_lengths) if buf.queue_lengths else None
            # LOS 等级取众数（最频繁出现的等级）
            los = (
                max(set(buf.los_grades), key=buf.los_grades.count)
                if buf.los_grades else None
            )

            try:
                async with AsyncSessionLocal() as session:
                    session.add(
                        TrafficRecord(
                            device_id=device_id,
                            recorded_at=recorded_at,
                            avg_count=avg_count,
                            max_count=max_count,
                            passed_count=passed_count,
                            passed_in_count=passed_in,
                            passed_out_count=passed_out,
                            avg_occupancy=avg_occ,
                            avg_speed_kmh=avg_spd,
                            max_speed_kmh=max_spd,
                            speed_violation_count=buf.speed_violation_count or None,
                            avg_headway_sec=avg_hw,
                            min_headway_sec=min_hw,
                            queue_length=queue_len,
                            los_grade=los,
                            wrong_way_count=buf.wrong_way_count or None,
                        )
                    )
                    await session.commit()
                logger.debug(
                    f"[Aggregator] minute device={device_id} @ {recorded_at} "
                    f"avg={avg_count} max={max_count} passed={passed_count}"
                )
            except Exception as exc:
                logger.error(
                    f"[Aggregator] traffic_records write failed device={device_id}: {exc}"
                )
                continue

            # 重置本分钟丢帧统计（设计稿：dropped_frames 为"本分钟累计"）
            try:
                from pipeline.manager import pipeline_manager
                ctx = pipeline_manager.get_context(device_id)
                if ctx:
                    ctx.stats.dropped_frames = 0
            except Exception:
                pass

            # flow_spike 检测（写库成功后再检测，使用当前分钟数据）
            await self._check_flow_spike(device_id, passed_count, recorded_at.hour)

    # ── flow_spike 检测 ─────────────────────────────────────────────────────────

    async def _check_flow_spike(
        self, device_id: int, passed_count: int, current_hour: int
    ) -> None:
        """比较当前分钟过线量与历史同期均值，触发或解除 flow_spike 预警。

        历史均值：hourly_statistics 中同设备、同小时时段、最近 28 天，取 total_passed/60。
        冷启动保护：历史条数 < 7 时跳过检测，每小时记录一条 info 日志。
        """
        from services.alert_resolver import alert_resolver

        cutoff = _utcnow_naive() - timedelta(days=28)

        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(HourlyStatistics.total_passed).where(
                        and_(
                            HourlyStatistics.device_id == device_id,
                            func.hour(HourlyStatistics.hour_at) == current_hour,
                            HourlyStatistics.hour_at >= cutoff,
                        )
                    )
                )
                historical: list[int] = list(result.scalars().all())
        except Exception as exc:
            logger.warning(
                f"[Aggregator] flow_spike query failed device={device_id}: {exc}"
            )
            return

        if len(historical) < 7:
            # 冷启动保护：每小时每设备只写一条日志
            if self._cold_start_logged_hour.get(device_id) != current_hour:
                self._cold_start_logged_hour[device_id] = current_hour
                try:
                    async with AsyncSessionLocal() as session:
                        session.add(
                            SystemLog(
                                device_id=device_id,
                                event_type="info",
                                message="flow_spike 检测冷启动中，历史数据不足",
                            )
                        )
                        await session.commit()
                except Exception as exc:
                    logger.debug(f"[Aggregator] cold_start log failed: {exc}")
            return

        # 每小时每分钟历史均值（total_passed per hour / 60 = per minute）
        avg_per_min = sum(historical) / len(historical) / 60.0
        if avg_per_min <= 0:
            return

        await alert_resolver.check_flow_spike(device_id, passed_count, avg_per_min)

    # ── 小时聚合写 hourly_statistics ─────────────────────────────────────────────

    async def _flush_hour(self, hour_at: datetime) -> None:
        """将指定整点前后一小时的 traffic_records 聚合写入 hourly_statistics。

        使用 MySQL INSERT ... ON DUPLICATE KEY UPDATE 实现幂等（可重入）。
        """
        hour_end = hour_at + timedelta(hours=1)

        try:
            async with AsyncSessionLocal() as session:
                # 按设备聚合 traffic_records（含新指标字段）
                agg_result = await session.execute(
                    select(
                        TrafficRecord.device_id,
                        func.sum(TrafficRecord.passed_count).label("total_passed"),
                        func.avg(TrafficRecord.avg_count).label("avg_count"),
                        func.max(TrafficRecord.max_count).label("peak_count"),
                        func.avg(TrafficRecord.avg_speed_kmh).label("avg_speed_kmh"),
                        func.avg(TrafficRecord.avg_occupancy).label("avg_occupancy"),
                        func.max(TrafficRecord.avg_occupancy).label("peak_occupancy"),
                        func.sum(TrafficRecord.speed_violation_count).label("speed_violation_count"),
                        func.sum(TrafficRecord.wrong_way_count).label("wrong_way_count"),
                    )
                    .where(
                        and_(
                            TrafficRecord.recorded_at >= hour_at,
                            TrafficRecord.recorded_at < hour_end,
                        )
                    )
                    .group_by(TrafficRecord.device_id)
                )
                rows = agg_result.all()

            if not rows:
                logger.debug(f"[Aggregator] hourly: no traffic_records for hour {hour_at}")
                return

            for row in rows:
                device_id = int(row.device_id)
                total_passed = int(row.total_passed or 0)
                avg_count = int(round(float(row.avg_count or 0)))
                peak_count = int(row.peak_count or 0)
                h_avg_speed = float(row.avg_speed_kmh) if row.avg_speed_kmh is not None else None
                h_avg_occ = float(row.avg_occupancy) if row.avg_occupancy is not None else None
                h_peak_occ = float(row.peak_occupancy) if row.peak_occupancy is not None else None
                h_spd_vio = int(row.speed_violation_count or 0) or None
                h_wrong = int(row.wrong_way_count or 0) or None

                # 统计该小时内触发的预警次数
                try:
                    async with AsyncSessionLocal() as session:
                        alert_cnt_result = await session.execute(
                            select(func.count())
                            .select_from(TrafficAlert)
                            .where(
                                and_(
                                    TrafficAlert.device_id == device_id,
                                    TrafficAlert.triggered_at >= hour_at,
                                    TrafficAlert.triggered_at < hour_end,
                                )
                            )
                        )
                        alert_count = int(alert_cnt_result.scalar_one())
                except Exception as exc:
                    logger.warning(
                        f"[Aggregator] alert_count query failed device={device_id}: {exc}"
                    )
                    alert_count = 0

                # INSERT ... ON DUPLICATE KEY UPDATE（MySQL 幂等写入）
                try:
                    async with AsyncSessionLocal() as session:
                        stmt = mysql_insert(HourlyStatistics).values(
                            device_id=device_id,
                            hour_at=hour_at,
                            total_passed=total_passed,
                            avg_count=avg_count,
                            peak_count=peak_count,
                            alert_count=alert_count,
                            avg_speed_kmh=h_avg_speed,
                            avg_occupancy=h_avg_occ,
                            peak_occupancy=h_peak_occ,
                            speed_violation_count=h_spd_vio,
                            wrong_way_count=h_wrong,
                        )
                        stmt = stmt.on_duplicate_key_update(
                            total_passed=stmt.inserted.total_passed,
                            avg_count=stmt.inserted.avg_count,
                            peak_count=stmt.inserted.peak_count,
                            alert_count=stmt.inserted.alert_count,
                            avg_speed_kmh=stmt.inserted.avg_speed_kmh,
                            avg_occupancy=stmt.inserted.avg_occupancy,
                            peak_occupancy=stmt.inserted.peak_occupancy,
                            speed_violation_count=stmt.inserted.speed_violation_count,
                            wrong_way_count=stmt.inserted.wrong_way_count,
                        )
                        await session.execute(stmt)
                        await session.commit()
                    logger.info(
                        f"[Aggregator] hourly device={device_id} hour={hour_at} "
                        f"total_passed={total_passed} alerts={alert_count}"
                    )
                except Exception as exc:
                    logger.error(
                        f"[Aggregator] hourly_statistics write failed "
                        f"device={device_id} hour={hour_at}: {exc}"
                    )

        except Exception as exc:
            logger.error(f"[Aggregator] _flush_hour error hour={hour_at}: {exc}")


# 全局单例
aggregator = Aggregator()
