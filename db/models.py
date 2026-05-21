CREATE_INCIDENTS_TABLE = """
CREATE TABLE IF NOT EXISTS incidents (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id        TEXT    NOT NULL UNIQUE,
    customer_email   TEXT    NOT NULL,
    root_cause       TEXT    NOT NULL,
    confidence_pct   INTEGER NOT NULL,
    severity         TEXT    NOT NULL,
    affected_service TEXT,
    sentry_issue_id  TEXT,
    linear_issue_id  TEXT,
    brief_json       TEXT    NOT NULL,
    resolved_at      TEXT,
    created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

CREATE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_incidents_customer
ON incidents(customer_email);

CREATE INDEX IF NOT EXISTS idx_incidents_service
ON incidents(affected_service);

CREATE INDEX IF NOT EXISTS idx_incidents_cause
ON incidents(root_cause);
"""