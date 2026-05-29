# SQLite schema for NEXUS incident storage.
# UNIQUE on ticket_id is the deduplication guard.
# Three indexes cover the three analytics query patterns.

CREATE_INCIDENTS_TABLE = """
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL UNIQUE,
    customer_email TEXT,
    root_cause TEXT,
    confidence_pct INTEGER,
    severity TEXT,
    affected_service TEXT,
    linear_issue_id TEXT,
    signals_used TEXT,
    brief_json TEXT,
    dispatched INTEGER DEFAULT 0,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
"""

CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_incidents_customer ON incidents(customer_email)",
    "CREATE INDEX IF NOT EXISTS idx_incidents_service  ON incidents(affected_service)",
    "CREATE INDEX IF NOT EXISTS idx_incidents_cause    ON incidents(root_cause)",
]