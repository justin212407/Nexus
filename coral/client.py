import json
import subprocess

from config import settings


def coral_query(
    sql: str,
    params: dict | None = None,
) -> list[dict]:
    """Execute Coral SQL query."""

    # Demo mode -> fixtures
    if settings.DEMO_MODE:

        from coral.mock_client import mock_query

        return mock_query(params or {})

    final_sql = sql

    cmd = ["coral", "sql", final_sql, "--format", "json"]
    if params:
        cmd.extend(["--params", json.dumps(params)])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.returncode != 0:

        raise RuntimeError(
            f"Coral query failed: {result.stderr}"
        )

    return json.loads(
        result.stdout.strip()
    )
