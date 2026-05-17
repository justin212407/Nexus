# THE MASTER QUERY - do not change column aliases without updating:
# 1. mock_data/coral_result_*.json keys
# 2. agents/signal_agent.py .get("key") calls
# These three files form a triangle. Change one, change all three.

MASTER_QUERY = """
SELECT
  s.issue_id           AS sentry_issue_id,
  s.title              AS error_title,
  s.culprit            AS error_culprit,
  s.level              AS error_level,
  s.times_seen         AS error_occurrences,
  s.first_seen         AS error_first_seen,
  s.last_seen          AS error_last_seen,
  s.user_count         AS affected_users,

  sl.ts                AS slack_thread_ts,
  sl.text              AS slack_message,
  sl.user              AS slack_author,
  sl.channel           AS slack_channel,

  g.sha                AS deploy_sha,
  g.created_at         AS deploy_time,
  g.description        AS deploy_description,

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
  ON (sl.text LIKE '%' || SUBSTR(s.culprit, 1, 30) || '%'
   OR sl.text LIKE '%' || s.tags_service || '%')
  AND sl.ts >= DATETIME(t.created_at, '-4 hours')
  AND sl.channel IN ('#engineering', '#incidents', '#on-call')

LEFT JOIN github.deployments g
  ON  g.environment = 'production'
  AND g.created_at >= DATETIME(t.created_at, '-6 hours')
  AND g.created_at <= t.created_at

LEFT JOIN linear.issues l
  ON  l.title      LIKE '%' || SUBSTR(s.title, 1, 20) || '%'
  AND l.state_name IN ('Todo', 'In Progress', 'In Review')

WHERE  t.id = :ticket_id
LIMIT  50
"""
