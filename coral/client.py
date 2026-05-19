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

    # Simple parameter replacement
    if params:

        for key, value in params.items():

            final_sql = final_sql.replace(
                f":{key}",
                f"'{value}'",
            )

    result = subprocess.run(
        ["coral", "sql", final_sql, "--format", "json"],
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