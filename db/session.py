import sqlite3
from contextlib import contextmanager
from typing import Generator
from config import settings


def _db_path() -> str:
    return settings.DATABASE_URL.replace("sqlite:///", "")


def init_db() -> None:
    from db.models import CREATE_INCIDENTS_TABLE, CREATE_INDEXES
    conn = sqlite3.connect(_db_path())
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute(CREATE_INCIDENTS_TABLE)
    # Review metadata is separate from legacy incidents and dispatch flags.
    conn.execute("""CREATE TABLE IF NOT EXISTS ticket_reviews (
        ticket_id TEXT PRIMARY KEY REFERENCES incidents(ticket_id),
        environment TEXT NOT NULL, message_body TEXT NOT NULL,
        received_at TEXT NOT NULL, resolved_at TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS review_actions (
        request_id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES ticket_reviews(ticket_id),
        action TEXT NOT NULL, content TEXT NOT NULL, destination TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )""")
    for stmt in CREATE_INDEXES:
        conn.execute(stmt)
    conn.commit()
    conn.close()


@contextmanager
def get_session():
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db():
    """SQLAlchemy-style generator that wraps get_session for compatibility."""
    with get_session() as conn:
        yield conn
