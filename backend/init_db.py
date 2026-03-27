"""一键初始化脚本（首次部署使用）。

执行顺序：
  1. alembic upgrade head  —— 建表 / 迁移
  2. 创建默认 admin 账号（若不存在）
  3. 插入示例设备记录（可选）

用法（在 backend/ 目录下运行）：
  python init_db.py
  python init_db.py --skip-device   # 跳过示例设备
"""
import asyncio
import os
import sys

# ── 确保 backend/ 在 sys.path 中 ──────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def run_migrations() -> None:
    """调用 Alembic Python API 执行数据库迁移。"""
    from alembic.config import Config
    from alembic import command

    ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
    alembic_cfg = Config(ini_path)
    print("▶ 执行 alembic upgrade head ...")
    command.upgrade(alembic_cfg, "head")
    print("✓ 迁移完成")


async def create_default_admin() -> None:
    """若 admin 账号不存在，则创建默认管理员。"""
    from passlib.context import CryptContext
    from sqlalchemy import select
    from database import AsyncSessionLocal
    from models import User

    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.username == "admin")
        )
        if result.scalar_one_or_none() is not None:
            print("ℹ admin 账号已存在，跳过创建")
            return

        admin = User(
            username="admin",
            password_hash=pwd_ctx.hash("admin123"),
            full_name="系统管理员",
            role="admin",
            is_active=True,
            must_change_password=True,   # 首次登录强制改密
        )
        session.add(admin)
        await session.commit()
        print("✓ 默认 admin 账号已创建（用户名: admin，密码: admin123）")
        print("⚠  请在首次登录后立即修改密码！")


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
            print("ℹ 示例设备已存在，跳过创建")
            return

        device = Device(
            name="路口摄像头-01",
            ip_address="192.168.1.100",
            location="主干道路口",
        )
        session.add(device)
        await session.flush()   # 获取自增 ID

        settings = DeviceSettings(device_id=device.id)
        session.add(settings)
        await session.commit()
        print(f"✓ 示例设备已创建（ID: {device.id}，IP: 192.168.1.100）")


async def main(skip_device: bool = False) -> None:
    run_migrations()
    await create_default_admin()
    if not skip_device:
        await create_sample_device()
    print("\n🎉 初始化完成！现在可以启动服务：uvicorn main:app --reload")


if __name__ == "__main__":
    skip_device = "--skip-device" in sys.argv
    asyncio.run(main(skip_device=skip_device))
