from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from core.config import get_settings

settings = get_settings()

# ── AsyncEngine（连接池） ──────────────────────────────────────
# pool_size      = 最小保持连接数（对应设计稿 DB_POOL_MIN）
# max_overflow   = 超出 pool_size 后允许额外创建的连接数
# pool_size + max_overflow = 最大连接数（对应 DB_POOL_MAX）
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_MIN,
    max_overflow=settings.DB_POOL_MAX - settings.DB_POOL_MIN,
    pool_pre_ping=True,       # 每次借出前 PING 确认连接存活
    pool_recycle=3600,        # 1 小时后回收空闲连接，防止 MySQL wait_timeout
    echo=(settings.LOG_LEVEL == "DEBUG"),
)

# ── AsyncSession 工厂 ─────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # 避免 commit 后访问属性触发额外 SELECT
    autocommit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖项：提供一个自动关闭的异步 Session。
    路由函数需要显式调用 session.commit() 提交事务。
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
