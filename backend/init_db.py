# -*- coding: utf-8 -*-
"""
init_db.py -- 一键初始化脚本（首次部署使用）

执行顺序：
  1. alembic upgrade head  -- 建表 / 迁移
  2. 创建默认 admin 账号（若不存在）
  3. 插入示例设备记录（可选）

用法（在 backend/ 目录下运行）：
  python init_db.py
  python init_db.py --skip-device   # 跳过示例设备
"""
import asyncio
import os
import sys

# 确保 backend/ 在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def run_migrations() -> None:
    """调用 Alembic Python API 执行数据库迁移。"""
    from alembic import command
    from alembic.config import Config

    ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
    alembic_cfg = Config(ini_path)
    print("[*] running: alembic upgrade head ...")
    command.upgrade(alembic_cfg, "head")
    print("[OK] migration complete")


async def create_default_admin() -> None:
    """若 admin 账号不存在，则创建默认管理员。"""
    import bcrypt
    from sqlalchemy import select

    from database import AsyncSessionLocal
    from models import User

    # 直接使用 bcrypt 原生库，绕开 passlib 与 bcrypt 5.x 的兼容问题
    password_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt(rounds=12)).decode()

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.username == "admin")
        )
        if result.scalar_one_or_none() is not None:
            print("[INFO] admin already exists, skipped")
            return

        admin = User(
            username="admin",
            password_hash=password_hash,
            full_name="系统管理员",
            role="admin",
            is_active=True,
            must_change_password=True,  # 首次登录强制改密
        )
        session.add(admin)
        await session.commit()
        print("[OK] default admin created  (username: admin  password: admin123)")
        print("[!!] Please change the password on first login!")


async def create_sample_device() -> None:
    """插入一条示例设备记录（含默认配置），方便快速验证。"""
    from sqlalchemy import select

    from database import AsyncSessionLocal
    from models import Device, DeviceSettings

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Device).where(Device.ip_address == "192.168.1.100")
        )
        if result.scalar_one_or_none() is not None:
            print("[INFO] sample device already exists, skipped")
            return

        device = Device(
            name="路口摄像头-01",
            ip_address="192.168.1.100",
            location="主干道路口",
        )
        session.add(device)
        await session.flush()  # 获取自增 ID

        settings = DeviceSettings(device_id=device.id)
        session.add(settings)
        await session.commit()
        print(f"[OK] sample device created  (id={device.id}  ip=192.168.1.100)")


async def async_init(skip_device: bool = False) -> None:
    """纯异步部分：创建账号和示例设备（不涉及 alembic）。"""
    await create_default_admin()
    if not skip_device:
        await create_sample_device()
    print("\n[DONE] Init finished. Start server: uvicorn main:app --reload")


if __name__ == "__main__":
    skip_device = "--skip-device" in sys.argv
    # Step 1: 同步跑迁移（不能在事件循环内调 asyncio.run，所以先于 asyncio.run 执行）
    run_migrations()
    # Step 2: 异步创建初始数据
    asyncio.run(async_init(skip_device=skip_device))
