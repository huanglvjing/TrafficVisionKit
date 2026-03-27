from functools import lru_cache
from typing import List
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── 数据库 ──────────────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="mysql+aiomysql://root:password@127.0.0.1:3306/traffic_detection"
    )

    # ── JWT 认证 ─────────────────────────────────────────────────
    JWT_SECRET_KEY: str = Field(default="change-me-in-production-min-32-chars!!")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── TCP 服务 ─────────────────────────────────────────────────
    TCP_HOST: str = "0.0.0.0"
    TCP_PORT: int = 9000

    # ── FastAPI 服务 ──────────────────────────────────────────────
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # ── YOLO 推理 ─────────────────────────────────────────────────
    YOLO_MODEL_PATH: str = "models/yolov8n.pt"
    YOLO_DEVICE: str = "cpu"

    # ── CORS（多个 Origin 用英文逗号分隔）────────────────────────
    CORS_ORIGINS: str = "http://localhost:5173"

    # ── 日志级别 ──────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"

    # ── 数据库连接池 ──────────────────────────────────────────────
    DB_POOL_MIN: int = 3
    DB_POOL_MAX: int = 10

    # ── Cookie 安全（生产环境必须设为 true）──────────────────────
    COOKIE_SECURE: bool = False
    COOKIE_DOMAIN: str = ""

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {allowed}")
        return upper

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """全局配置单例，通过 FastAPI 依赖注入或直接调用获取。"""
    return Settings()
