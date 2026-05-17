import sqlite3
from contextlib import contextmanager
from config import settings


def init_db():
    """Create tables and indexes on startup."""
    from db.models import CREATE_INCIDENTS_TABLE, CREATE_INDEXES
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    conn.execute(CREATE_INCIDENTS_TABLE)
    for stmt in CREATE_INDEXES.strip().split(";"):
        if stmt.strip():
            conn.execute(stmt)
    conn.commit()
    conn.close()


@contextmanager
def get_session():
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
