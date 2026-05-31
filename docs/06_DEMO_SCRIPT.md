# Zenith Demo Script — 3 Scenarios (5 min walkthrough)

## Setup (Before Demo)

```bash
# Terminal 1: Backend
$env:DEMO_MODE="true"
python -m uvicorn main:app --reload
# Expected: "Uvicorn running on http://localhost:8000"

# Terminal 2: Frontend
cd frontend
npm run dev
# Expected: "VITE v5.x ready in Xms" + "Local: http://localhost:5173"

# Browser: Open http://localhost:5173
```

---

## Scenario A: Checkout Bug (3 min)

**Story:** A customer reports "Checkout is broken — users cannot complete payment." Zenith correlates this to a recent production deploy + NullPointerException in Sentry.

### Step 1: Trigger Event

Click **🔴 Checkout Bug** button in the dashboard header.

### What to Watch

**Real-time UI updates:**

1. Card appears in **Tickets** column with status "Processing"
2. **Agent Status** shows pipeline: Ticket Received → Coral Query → Signal Transform → Claude Analysis → Completed
3. Each step completes within 1–2s

**After ~5–8 seconds:**

- Status changes to "Done" (green)
- **TechnicalBrief** card populates:
  - **Root Cause:** Known Bug (red pill)
  - **Severity:** High (orange pill)
  - **Confidence:** ≥88%
  - **Causal Chain:** 4+ timestamped steps showing:
    - 14:18 → Deploy to production (PaymentService v2.1.3)
    - 14:21 → NullPointerException in PaymentService.processCheckout()
    - 14:23 → Multiple Slack messages in #incidents
    - 14:38 → Customer reports checkout failure
  - **Affected Service:** payment-gateway
  - **Affected Users:** 247

**Dispatch:**

- Intercom internal note created (confidence ≥70, no Slack escalation needed)
- **Analytics** panel updates: root_cause count +1

**Value Prop Demonstrated:**

- Single Coral query correlated 4 data sources (Sentry, Slack, GitHub, Linear) in <1s
- Claude classified root cause + confidence in <5s
- Manual correlation would take 15-20 minutes

---

## Scenario B: False Alarm (2 min)

**Story:** Customer says "I cannot log in" but Zenith detects user error (likely forgot password).

### Step 1: Trigger Event

Click **🟡 False Alarm** button.

### What to Watch

**After ~5–8 seconds:**

- Status: "Done"
- **TechnicalBrief** shows:
  - **Root Cause:** User Error (blue pill)
  - **Severity:** Low (blue pill)
  - **Confidence:** ≥88%
  - **Causal Chain:** Single entry: "No technical errors detected for this user. Check password reset flow."
  - **Affected Users:** 1
  - **Draft Customer Response:** Empathetic, non-technical guidance on password recovery

**Dispatch:**

- Intercom note only (no Slack — confidence high, severity low)

**Value Prop Demonstrated:**

- Zenith confidently distinguishes user error from bugs
- Avoids wasting engineer time on non-technical issues
- Suggests self-service path for customers

---

## Scenario C: Stripe Outage (2 min)

**Story:** Multiple customers report payment failures. Zenith identifies external dependency (Stripe API degradation).

### Step 1: Trigger Event

Click **🟠 Stripe Outage** button.

### What to Watch

**After ~5–8 seconds:**

- Status: "Done"
- **TechnicalBrief** shows:
  - **Root Cause:** External Dependency (purple pill)
  - **Severity:** Critical (red pill — highest alert)
  - **Confidence:** ≥85%
  - **Causal Chain:**
    - 14:35 → Stripe API health check: 503 Service Unavailable
    - 14:37 → 50+ webhook failures from Stripe in Slack
    - 14:39 → Multiple customer payment tickets arrive
  - **Affected Service:** payment-gateway
  - **Affected Users:** 500+
  - **Recommended Action:** "Contact Stripe support; monitor status page. Customers can retry after 15 min."

**Dispatch:**

- **Both Intercom AND Slack** (severity=critical triggers escalation)
- Slack message includes severity badge (red) + causal chain for on-call engineer

**Value Prop Demonstrated:**

- Zenith recognizes external dependency patterns
- Escalates appropriately (severity trumps confidence)
- Provides context for on-call team to act fast

---

## Analytics Validation

After running all 3 scenarios, check **Analytics** panel (right column):

```
Incidents Today: 3
Avg Confidence: 87%
Top Service: payment-gateway

Classification Breakdown:
  known_bug: 1
  user_error: 1
  external_dependency: 1
```

This confirms metrics updated in real-time across all dispatches.

---

## Points to Emphasize to Judges

1. **Coral Protocol in action:** One SQL query joins 5 external APIs. No custom integrations. Correlation <1s.
2. **Root cause classification:** Claude analyzes signals + causal chain, not just raw errors. High confidence + explainability.
3. **Dispatch confidence gates:** Routing rules (low confidence → Slack; critical severity → Slack) prevent alert fatigue.
4. **Real-time UI:** SSE events flow from backend to frontend as each agent completes. No polling, <500ms latency.
5. **Demo mode safety:** All fixtures are deterministic stories, no external API flakiness during demo.

---

## Troubleshooting

| Issue                             | Solution                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Frontend won't load               | Check: `http://localhost:5173` + browser console for errors. Restart Vite.                                           |
| Backend 500 error                 | Check `DEMO_MODE=true` is set. Verify Python env activated (should show `(env1)` prompt).                            |
| No SSE events arriving            | Open browser DevTools → Network → filter "stream". Should see SSE connection. If not, check CORS headers in main.py. |
| Ticket card stuck on "Processing" | Backend may have crashed. Check terminal 1 for exceptions. Common: missing env var.                                  |
| Linear issue link broken          | This is expected in DEMO_MODE (fixture issues don't exist in real Linear). In live mode, it will link correctly.     |

---

## Live Mode Setup (Out of Scope for This Demo)

For judges interested in live mode, see [07_LIVE_MODE_SETUP.md](07_LIVE_MODE_SETUP.md). Live mode requires:

- Sentry API token (org slug)
- Slack bot token + channel ID
- GitHub personal access token
- Linear API key
- Intercom access token + webhook secret
- Coral CLI + all 5 sources configured

DEMO_MODE=true bypasses all of this and uses prerecorded fixture data.
