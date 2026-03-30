"""extend metrics: add speed/occupancy/headway fields and new tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-30

新增内容：
  - traffic_records: avg_occupancy / avg_speed_kmh / max_speed_kmh /
                     speed_violation_count / avg_headway_sec / min_headway_sec /
                     queue_length / los_grade / wrong_way_count
  - hourly_statistics: avg_speed_kmh / avg_occupancy / peak_occupancy /
                       speed_violation_count / wrong_way_count
  - device_settings: calibration_px_per_meter / speed_limit_kmh /
                     allowed_direction / roi_x1 / roi_y1 / roi_x2 / roi_y2
  - 新表 speed_events
  - 新表 trajectory_heatmap_snapshots
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE_KW = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_unicode_ci",
}


def upgrade() -> None:
    # ── traffic_records 新增列 ────────────────────────────────────────────────
    op.add_column("traffic_records", sa.Column("avg_occupancy", sa.Float(), nullable=True))
    op.add_column("traffic_records", sa.Column("avg_speed_kmh", sa.Float(), nullable=True))
    op.add_column("traffic_records", sa.Column("max_speed_kmh", sa.Float(), nullable=True))
    op.add_column("traffic_records", sa.Column("speed_violation_count", sa.Integer(), nullable=True))
    op.add_column("traffic_records", sa.Column("avg_headway_sec", sa.Float(), nullable=True))
    op.add_column("traffic_records", sa.Column("min_headway_sec", sa.Float(), nullable=True))
    op.add_column("traffic_records", sa.Column("queue_length", sa.Integer(), nullable=True))
    op.add_column("traffic_records", sa.Column("los_grade", sa.CHAR(1), nullable=True))
    op.add_column("traffic_records", sa.Column("wrong_way_count", sa.Integer(), nullable=True))

    # ── hourly_statistics 新增列 ──────────────────────────────────────────────
    op.add_column("hourly_statistics", sa.Column("avg_speed_kmh", sa.Float(), nullable=True))
    op.add_column("hourly_statistics", sa.Column("avg_occupancy", sa.Float(), nullable=True))
    op.add_column("hourly_statistics", sa.Column("peak_occupancy", sa.Float(), nullable=True))
    op.add_column("hourly_statistics", sa.Column("speed_violation_count", sa.Integer(), nullable=True))
    op.add_column("hourly_statistics", sa.Column("wrong_way_count", sa.Integer(), nullable=True))

    # ── device_settings 新增列 ────────────────────────────────────────────────
    op.add_column(
        "device_settings",
        sa.Column("calibration_px_per_meter", sa.Float(), nullable=True),
    )
    op.add_column(
        "device_settings",
        sa.Column("speed_limit_kmh", sa.SmallInteger(), server_default="60", nullable=False),
    )
    op.add_column(
        "device_settings",
        sa.Column(
            "allowed_direction",
            sa.Enum("up", "down", "both", name="direction_enum"),
            server_default="both",
            nullable=False,
        ),
    )
    op.add_column("device_settings", sa.Column("roi_x1", sa.SmallInteger(), server_default="0", nullable=False))
    op.add_column("device_settings", sa.Column("roi_y1", sa.SmallInteger(), server_default="0", nullable=False))
    op.add_column("device_settings", sa.Column("roi_x2", sa.SmallInteger(), server_default="640", nullable=False))
    op.add_column("device_settings", sa.Column("roi_y2", sa.SmallInteger(), server_default="480", nullable=False))

    # ── 新建 speed_events 表 ──────────────────────────────────────────────────
    op.create_table(
        "speed_events",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("tracking_id", sa.Integer(), nullable=False),
        sa.Column("speed_kmh", sa.Float(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("bbox_snapshot", sa.String(100), nullable=True),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_se_device"),
        sa.PrimaryKeyConstraint("id"),
        **_TABLE_KW,
    )
    op.create_index("idx_se_device_occurred", "speed_events", ["device_id", "occurred_at"])

    # ── 新建 trajectory_heatmap_snapshots 表 ─────────────────────────────────
    op.create_table(
        "trajectory_heatmap_snapshots",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("snapshot_at", sa.DateTime(), nullable=False),
        sa.Column("heatmap_data", sa.JSON(), nullable=False),
        sa.Column("sample_count", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], name="fk_ths_device"),
        sa.PrimaryKeyConstraint("id"),
        **_TABLE_KW,
    )
    op.create_index("idx_ths_device_snap", "trajectory_heatmap_snapshots", ["device_id", "snapshot_at"])


def downgrade() -> None:
    op.drop_index("idx_ths_device_snap", table_name="trajectory_heatmap_snapshots")
    op.drop_table("trajectory_heatmap_snapshots")

    op.drop_index("idx_se_device_occurred", table_name="speed_events")
    op.drop_table("speed_events")

    for col in ["roi_y2", "roi_x2", "roi_y1", "roi_x1", "allowed_direction",
                "speed_limit_kmh", "calibration_px_per_meter"]:
        op.drop_column("device_settings", col)

    for col in ["wrong_way_count", "speed_violation_count", "peak_occupancy",
                "avg_occupancy", "avg_speed_kmh"]:
        op.drop_column("hourly_statistics", col)

    for col in ["wrong_way_count", "los_grade", "queue_length", "min_headway_sec",
                "avg_headway_sec", "speed_violation_count", "max_speed_kmh",
                "avg_speed_kmh", "avg_occupancy"]:
        op.drop_column("traffic_records", col)
