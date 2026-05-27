import json
import logging
import subprocess
import time

from config import settings

logger = logging.getLogger(__name__)


def coral_query(
    sql: str,
    params: dict | None = None,
) -> list[dict]:
    """Execute Coral SQL query with retry logic and timeout handling.
    
    Returns empty list [] if Coral is unavailable or times out after retries.
    Raises RuntimeError if query fails permanently.
    """

    # Demo mode -> fixtures
    if settings.DEMO_MODE:

        from coral.mock_client import mock_query

        return mock_query(params or {})

    final_sql = sql

    cmd = ["coral", "sql", final_sql, "--format", "json"]
    if params:
        cmd.extend(["--params", json.dumps(params)])

    # Retry logic: 2 attempts with backoff (5s, 10s)
    max_attempts = 2
    backoff_delays = [5, 10]
    
    for attempt in range(max_attempts):
        try:
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

        except subprocess.TimeoutExpired as e:
            logger.warning(
                f"Coral query timeout on attempt {attempt + 1}/{max_attempts}: {str(e)}"
            )
            if attempt < max_attempts - 1:
                delay = backoff_delays[attempt]
                logger.info(f"Retrying after {delay}s...")
                time.sleep(delay)
            else:
                # Final timeout: raise to distinguish from valid empty result
                logger.error(
                    "Coral query failed after retries (timeout). "
                    "Source may be unavailable."
                )
                raise RuntimeError(
                    "Coral query timeout after retries. "
                    "The subprocess did not respond within 30 seconds. "
                    "Coral sources may be unavailable or overloaded."
                )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Coral JSON response: {str(e)}")
            raise RuntimeError(f"Coral JSON parse error: {str(e)}")

        except Exception as e:
            logger.error(f"Coral query error on attempt {attempt + 1}: {str(e)}")
            if attempt == max_attempts - 1:
                raise

    return []
