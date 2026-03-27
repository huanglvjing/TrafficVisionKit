"""设备管理路由：CRUD + 设备配置读写。"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from models import Device, DeviceSettings, SystemLog, TrafficAlert
from routers.deps import AdminUser, ClientIP, CurrentUser, DBSession
from schemas.device import (
    DeviceCreate,
    DeviceResponse,
    DeviceSettingsResponse,
    DeviceSettingsUpdate,
    DeviceUpdate,
)

router = APIRouter(prefix="/api/devices", tags=["devices"])


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("", response_model=list[DeviceResponse], summary="查询所有设备列表")
async def list_devices(session: DBSession, _user: CurrentUser) -> list[DeviceResponse]:
    result = await session.execute(select(Device).order_by(Device.id))
    devices = result.scalars().all()
    return [DeviceResponse.model_validate(d) for d in devices]


@router.post(
    "",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建新设备（admin）",
)
async def create_device(
    body: DeviceCreate,
    session: DBSession,
    _admin: AdminUser,
    client_ip: ClientIP,
) -> DeviceResponse:
    existing = await session.execute(
        select(Device).where(Device.ip_address == body.ip_address)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": 3001, "message": "该 IP 地址的设备已存在"},
        )
    now = _now()
    device = Device(
        name=body.name,
        ip_address=body.ip_address,
        location=body.location,
        is_active=False,
        total_frames=0,
        created_at=now,
        updated_at=now,
    )
    session.add(device)
    await session.flush()  # 获取自增 id

    # 自动创建默认 device_settings
    settings_row = DeviceSettings(device_id=device.id, updated_at=now)
    session.add(settings_row)

    session.add(SystemLog(
        event_type="info",
        message=f"注册新设备 {body.name}（IP: {body.ip_address}，操作来源: {client_ip}）",
        operator_ip=client_ip,
        created_at=now,
    ))
    await session.commit()
    await session.refresh(device)
    return DeviceResponse.model_validate(device)


@router.get("/{device_id}", response_model=DeviceResponse, summary="查询单个设备详情")
async def get_device(device_id: int, session: DBSession, _user: CurrentUser) -> DeviceResponse:
    result = await session.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": 3002, "message": "设备不存在"})
    return DeviceResponse.model_validate(device)


@router.put("/{device_id}", response_model=DeviceResponse, summary="更新设备信息（admin）")
async def update_device(
    device_id: int,
    body: DeviceUpdate,
    session: DBSession,
    _admin: AdminUser,
) -> DeviceResponse:
    result = await session.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": 3002, "message": "设备不存在"})

    if body.name is not None:
        device.name = body.name
    if body.location is not None:
        device.location = body.location

    await session.commit()
    await session.refresh(device)
    return DeviceResponse.model_validate(device)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除设备（软删除，admin）")
async def delete_device(
    device_id: int,
    session: DBSession,
    _admin: AdminUser,
) -> None:
    result = await session.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": 3002, "message": "设备不存在"})

    # 检查是否有未解除预警
    unresolved = await session.execute(
        select(TrafficAlert).where(
            TrafficAlert.device_id == device_id,
            TrafficAlert.is_resolved == False,  # noqa: E712
        )
    )
    if unresolved.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": 3003, "message": "该设备存在未解除的预警，请先处理预警后再删除"},
        )

    device.is_active = False
    await session.commit()


# ── 设备配置 ────────────────────────────────────────────────────────────────────

@router.get("/{device_id}/settings", response_model=DeviceSettingsResponse, summary="读取设备配置")
async def get_device_settings(
    device_id: int,
    session: DBSession,
    _user: CurrentUser,
) -> DeviceSettingsResponse:
    result = await session.execute(
        select(DeviceSettings).where(DeviceSettings.device_id == device_id)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": 3004, "message": "设备配置不存在"})
    return DeviceSettingsResponse.model_validate(settings)


@router.put("/{device_id}/settings", response_model=DeviceSettingsResponse, summary="更新设备配置（admin，运行时立即生效）")
async def update_device_settings(
    device_id: int,
    body: DeviceSettingsUpdate,
    session: DBSession,
    _admin: AdminUser,
    client_ip: ClientIP,
) -> DeviceSettingsResponse:
    result = await session.execute(
        select(DeviceSettings).where(DeviceSettings.device_id == device_id)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": 3004, "message": "设备配置不存在"})

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)

    now = _now()
    session.add(SystemLog(
        device_id=device_id,
        event_type="settings_changed",
        message=f"设备 {device_id} 配置已更新（操作来源: {client_ip}）",
        operator_ip=client_ip,
        created_at=now,
    ))
    await session.commit()
    await session.refresh(settings)

    # 使设备配置热缓存失效，下一帧推理时自动从 DB 重载（运行时立即生效）
    from pipeline.manager import pipeline_manager
    pipeline_manager.invalidate_settings_cache(device_id)

    return DeviceSettingsResponse.model_validate(settings)
