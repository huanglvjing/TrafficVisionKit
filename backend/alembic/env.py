"""Alembic 迁移环境配置 —— 异步 SQLAlchemy 2.0 模式。

运行方式（均在 backend/ 目录下执行）：
    生成迁移: alembic revision --autogenerate -m "描述"
    执行迁移: alembic upgrade head
    回滚一步: alembic downgrade -1
"""
import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ── 确保 backend/ 在 sys.path 中，使 `import models` 可用 ──
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# ── 从 backend/.env 加载环境变量（覆盖 alembic.ini 的占位符 URL）──
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(_backend_dir, ".env"))

# ── Alembic Config 对象 ───────────────────────────────────────
config = context.config

# 用环境变量中的 DATABASE_URL 替换 alembic.ini 里的占位符
_db_url = os.getenv("DATABASE_URL")
if _db_url:
    config.set_main_option("sqlalchemy.url", _db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── 目标 metadata（Alembic autogenerate 依赖此项）────────────
from models import Base  # noqa: E402

target_metadata = Base.metadata


# ── 离线模式（不连接数据库，仅生成 SQL 文件）────────────────
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── 在线模式（异步连接数据库）───────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # 迁移时不需要连接池
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
