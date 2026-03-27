"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-27

8 张表全量建表迁移（对应完整设计稿第 4 节）：
users / devices / device_settings / traffic_records /
hourly_statistics / traffic_alerts / connection_sessions / system_logs
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 所有表统一使用 utf8mb4 字符集
_TABLE_KW = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_unicode_ci",
}


def upgrade() -> None:
    # ── 1. users ─────────────────────────────────────────────────
    # 不依赖外键，最先建
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("username", sa.String(32), nullable=False),
        sa.Column("password_hash", sa.CHAR(60), nullable=False),
        sa.Column("email", sa.String(100), nullable=True),
        sa.Column("full_name", sa.String(50), nullable=False),
        sa.Column("role", sa.Enum("admin", "operator", name="user_role"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="1", nullable=False),
        # 首次登录强制修改密码标志（设计稿 1.4 节）
        sa.Column("must_change_password", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username", name="uk_username"),
        **_TABLE_KW,
    )

    # ── 2. devices ───────────────────────────────────────────────
    # 其余 6 张表均 FK → devices，必须先于它们建
    op.create_table(
        "devices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("ip_address", sa.String(20), nullable=False),
        sa.Column("location", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("total_frames", sa.BigInteger(), server_default="0", nullable=False),
        sa.Column("firmware_version", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ip_address", name="uk_ip"),
        **_TABLE_KW,
    )

    # ── 3. device_settings ──────────────────────────────────────
    op.create_table(
        "device_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("line_y", sa.Integer(), server_default="240", nullable=False),
        sa.Column("confidence", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("resolution_w", sa.SmallInteger(), server_default="640", nullable=False),
        sa.Column("resolution_h", sa.SmallInteger(), server_default="480", nullable=False),
        sa.Column("fps_limit", sa.SmallInteger(), server_default="30", nullable=False),
        sa.Column("alert_l2_threshold", sa.SmallInteger(), server_default="5", nullable=False),
        sa.Column("alert_l3_threshold", sa.SmallInteger(), server_default="10", nullable=False),
        sa.Column("alert_l4_threshold", sa.SmallInteger(), server_default="15", nullable=False),
        sa.Column("park_timeout_seconds", sa.SmallInteger(), server_default="30", nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_ds_device"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_id", name="uk_device"),
        **_TABLE_KW,
    )

    # ── 4. traffic_records ──────────────────────────────────────
    op.create_table(
        "traffic_records",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.Column("avg_count", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("max_count", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("passed_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("passed_in_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("passed_out_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("car_count", sa.Integer(), nullable=True),
        sa.Column("truck_count", sa.Integer(), nullable=True),
        sa.Column("bus_count", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_tr_device"),
        sa.PrimaryKeyConstraint("id"),
        **_TABLE_KW,
    )
    op.create_index("idx_recorded", "traffic_records", ["recorded_at"])
    op.create_index("idx_device_recorded", "traffic_records", ["device_id", "recorded_at"])

    # ── 5. hourly_statistics ────────────────────────────────────
    op.create_table(
        "hourly_statistics",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("hour_at", sa.DateTime(), nullable=False),
        sa.Column("total_passed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("avg_count", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("peak_count", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("alert_count", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_hs_device"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_id", "hour_at", name="uk_device_hour"),
        **_TABLE_KW,
    )

    # ── 6. traffic_alerts ───────────────────────────────────────
    op.create_table(
        "traffic_alerts",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.SmallInteger(), nullable=False),
        sa.Column("alert_type", sa.String(30), nullable=False),
        sa.Column("message", sa.String(200), nullable=False),
        sa.Column("vehicle_count", sa.SmallInteger(), nullable=True),
        sa.Column("triggered_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("is_resolved", sa.Boolean(), server_default="0", nullable=False),
        sa.Column("resolved_by", sa.String(20), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_ta_device"),
        sa.PrimaryKeyConstraint("id"),
        **_TABLE_KW,
    )
    op.create_index("idx_device_triggered", "traffic_alerts", ["device_id", "triggered_at"])
    op.create_index("idx_unresolved", "traffic_alerts", ["is_resolved", "triggered_at"])

    # ── 7. connection_sessions ──────────────────────────────────
    op.create_table(
        "connection_sessions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("connected_at", sa.DateTime(), nullable=False),
        sa.Column("disconnected_at", sa.DateTime(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("frames_received", sa.Integer(), server_default="0", nullable=False),
        sa.Column("disconnect_reason", sa.String(50), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_cs_device"),
        sa.PrimaryKeyConstraint("id"),
        **_TABLE_KW,
    )
    op.create_index("idx_device_connected", "connection_sessions", ["device_id", "connected_at"])

    # ── 8. system_logs ──────────────────────────────────────────
    op.create_table(
        "system_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("operator_ip", sa.String(45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["device_id"], ["devices.id"], name="fk_sl_device"
        ),
        sa.PrimaryKeyConstraint("id"),
        **_TABLE_KW,
    )
    op.create_index("idx_sl_created", "system_logs", ["created_at"])
    op.create_index("idx_sl_device_event", "system_logs", ["device_id", "event_type"])


def downgrade() -> None:
    # 按外键依赖逆序删除
    op.drop_index("idx_sl_device_event", table_name="system_logs")
    op.drop_index("idx_sl_created", table_name="system_logs")
    op.drop_table("system_logs")

    op.drop_index("idx_device_connected", table_name="connection_sessions")
    op.drop_table("connection_sessions")

    op.drop_index("idx_unresolved", table_name="traffic_alerts")
    op.drop_index("idx_device_triggered", table_name="traffic_alerts")
    op.drop_table("traffic_alerts")

    op.drop_table("hourly_statistics")

    op.drop_index("idx_device_recorded", table_name="traffic_records")
    op.drop_index("idx_recorded", table_name="traffic_records")
    op.drop_table("traffic_records")

    op.drop_table("device_settings")
    op.drop_table("devices")
    op.drop_table("users")
