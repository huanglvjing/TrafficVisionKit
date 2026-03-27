from datetime import datetime
from typing import Optional

from sqlalchemy import CHAR, Boolean, DateTime, Enum, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class User(Base):
    """用户账户表（4.8 节）。"""

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("username", name="uk_username"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(32), nullable=False)
    # bcrypt(cost=12) 固定输出 60 字符；使用 CHAR 固定长度
    password_hash: Mapped[str] = mapped_column(CHAR(60), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    full_name: Mapped[str] = mapped_column(String(50), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("admin", "operator", name="user_role"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="1"
    )
    # 设计稿 1.4 节：首次登录强制改密标志（section 4.8 隐含需求）
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0"
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
