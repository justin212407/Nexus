# IMPORTANT:
# Keep aliases aligned with:
# 1. mock_data/*.json
# 2. agents/signal_agent.py
#
# These files are tightly coupled.

MASTER_QUERY = """
SELECT

  -- =====================================================
  -- SENTRY SIGNALS
  -- =====================================================
  s.title              AS sentry_error_title,
  s.culprit            AS sentry_culprit,
  s.level              AS sentry_level,
  s.times_seen         AS sentry_occurrences,
  s.first_seen         AS sentry_first_seen,
  s.last_seen          AS sentry_last_seen,
  s.user_count         AS sentry_affected_users,

  -- =====================================================
  -- SLACK SIGNALS
  -- =====================================================
  sl.ts                AS slack_thread_ts,
  sl.text              AS slack_message,
  sl.user              AS slack_author,
  sl.channel           AS slack_channel,
  sl.ts                AS slack_created_at,

  -- =====================================================
  -- DEPLOY SIGNALS
  -- =====================================================
  g.sha                AS deploy_sha,
  g.created_at         AS deploy_time,
  g.description        AS deploy_description,

  -- =====================================================
  -- LINEAR SIGNALS
  -- =====================================================
  l.identifier         AS linear_issue_id,
  l.title              AS linear_title,
  l.state_name         AS linear_status,
  l.assignee_name      AS linear_assignee

FROM intercom.conversations t

LEFT JOIN sentry.issues s
  ON  s.user_email  = t.contact_email
  AND s.first_seen >= DATETIME(t.created_at, '-2 hours')
  AND s.first_seen <= DATETIME(t.created_at, '+30 minutes')

LEFT JOIN slack.messages sl
  ON (
       sl.text LIKE '%' || SUBSTR(s.culprit, 1, 30) || '%'
       OR sl.text LIKE '%' || s.tags_service || '%'
     )
  AND sl.ts >= DATETIME(t.created_at, '-4 hours')
  AND sl.channel IN (
       '#engineering',
       '#incidents',
       '#on-call'
     )

LEFT JOIN github.deployments g
  ON  g.environment = 'production'
  AND g.created_at >= DATETIME(t.created_at, '-6 hours')
  AND g.created_at <= t.created_at

LEFT JOIN linear.issues l
  ON  l.title LIKE '%' || SUBSTR(s.title, 1, 20) || '%'
  AND l.state_name IN (
       'Todo',
       'In Progress',
       'In Review'
     )

WHERE t.id = :ticket_id

LIMIT 50
"""
