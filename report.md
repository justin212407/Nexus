# NEXUS Project Report

This report explains what NEXUS does, how a person uses it, how the application processes a ticket, and where the main responsibilities live in the repository.

It reflects the current source code rather than treating older documentation as definitive.

The inventory covers authored source, configuration, tests, documentation, and fixtures.

It excludes installed dependencies, virtual environments, Python caches, frontend build output, and the local SQLite database.

## 1. What this project is

NEXUS is a customer-escalation intelligence application.

It takes an incoming Intercom support ticket, correlates it with engineering signals, produces a structured diagnosis called a `TechnicalBrief`, and routes the diagnosis to support and engineering channels.

The signals represented in the code are Sentry errors, Slack messages, GitHub deployments, and Linear issues.

The intended value is to reduce manual investigation by correlating support and engineering evidence in a single pipeline.

The project has two ways to run:

- **Demo mode** uses local JSON fixtures for the Coral query and prints Intercom and Slack outputs rather than making those outbound calls.
- **Live mode** invokes the Coral CLI for source data, calls a configured language model, and can post to Intercom and Slack.

The main technologies are Python, FastAPI, LangGraph, Pydantic, SQLite, Coral Protocol, React, Vite, and Server-Sent Events (SSE).

## 2. How a person uses the application

The frontend is a small operational dashboard rather than a separate customer-facing support portal.

1. Start the backend and the Vite frontend.
2. Open the dashboard. It requests `/health` to display whether the backend is in demo or live mode, and connects to `/stream` for ticket events.
3. Click one of the scenario buttons: **Checkout Bug**, **False Alarm**, or **Stripe Outage**.
4. The browser constructs an Intercom-shaped webhook payload with a unique ticket ID and posts it to `POST /webhook/intercom` using the demo signature bypass.
5. The backend validates and queues the ticket. The endpoint responds without waiting for the full analysis.
6. The dashboard receives the ticket’s SSE events, adds it to the incident list, and can show the completed brief when the incident is selected.
7. The analytics panel initially fetches `/stats` and polls periodically for persisted metrics.

In a real deployment, Intercom would submit the webhook instead of a person clicking a dashboard scenario button.

The three buttons are intended to demonstrate different diagnoses and dispatch decisions.

Because the browser currently uses generated ticket IDs, the fixture lookup is based on recognizable substrings in those IDs rather than a direct scenario key.

## 3. Architecture at a glance

```text
Intercom webhook or dashboard demo button
                  |
                  v
      FastAPI POST /webhook/intercom
  HMAC check -> parse TicketContext -> deduplicate
                  |
                  v
       FastAPI background task: run_pipeline
  started event -> Coral source health event
                  |
                  v
       LangGraph sequential state graph
 ticket_agent -> coral_agent -> signal_agent
      -> synthesis_agent -> dispatch_agent
                  |
      +-----------+-------------+
      |                         |
      v                         v
   SQLite                 Output integrations
 history, brief,          Intercom note always tried;
 metrics, dedup            Slack if low confidence or critical
      |
      +-------------------------------+
                                      v
                         SSE events -> React dashboard
```

The backend is layered by responsibility.

- **API layer** receives tickets and exposes health, event streaming, history, and metrics.
- **Orchestration layer** runs a fixed, sequential LangGraph pipeline over `NexusState`.
- **Agent layer** enriches ticket context, retrieves evidence, converts it to typed signals, synthesizes a brief, and dispatches it.
- **Data access layer** wraps Coral SQL and switches between live CLI calls and demo fixtures.
- **Persistence layer** stores briefs and incident metadata in SQLite.
- **Integration layer** formats and sends outbound Intercom and Slack messages.
- **Presentation layer** renders tickets, briefs, and metrics in the React dashboard.

## 4. Ticket processing, step by step

### 4.1 Webhook intake

`main.py` creates the FastAPI application, includes the routers, initializes SQLite at startup, and exposes `/health`.

`api/webhook.py` handles `POST /webhook/intercom`.

It reads the raw request bytes and validates `X-Hub-Signature-256` with HMAC-SHA256 and `hmac.compare_digest()`.

The special value `sha256=demo_bypass` skips HMAC verification for local demos and tests.

It parses the nested Intercom payload into a `TicketContext` defined in `models/ticket.py`.

Malformed JSON or missing required nested fields returns HTTP 400, and a bad signature returns HTTP 401.

Before queuing work, it checks whether the ticket ID is already in the SQLite incidents table and whether the same ticket is already active in this process.

Already-persisted tickets return `already_processed`; in-memory duplicates return `duplicate_ignored`.

Otherwise it records the ticket as active, schedules `run_pipeline()` with FastAPI `BackgroundTasks`, and returns a queued response.

### 4.2 Pipeline orchestration and shared state

`pipeline/graph.py` builds a graph with this exact order:

```text
START
  -> ticket_agent
  -> coral_agent
  -> signal_agent
  -> synthesis_agent
  -> dispatch_agent
  -> END
```

There are no conditional branches or parallel nodes.

`pipeline/state.py` defines `NexusState`, the typed dictionary merged across graph nodes.

The webhook supplies the initial `ticket` value.

Each node returns a partial dictionary containing the state values it writes.

### 4.3 Historical context

`agents/ticket_agent.py` calls `db.ops.find_similar()` to retrieve up to three previous incidents for the same customer email.

It stores this result in `pattern_match` for the synthesis step.

Ticket parsing itself happens in the webhook handler, not in this agent.

### 4.4 Coral data retrieval

`agents/coral_agent.py` runs `MASTER_QUERY` from `coral/queries.py` with the ticket ID and puts the returned rows in `result_set`.

`coral/client.py` is the boundary between the application and Coral.

In demo mode it calls `coral/mock_client.py`, which selects fixture data based on the ticket ID.

In live mode it invokes `coral sql` as a subprocess with JSON parameters and a timeout/retry path.

The master query selects Sentry, Slack, deployment, and Linear columns using aliases that are also consumed by `agents/signal_agent.py` and present in the Coral result fixtures.

Those aliases form a shared data contract.

### 4.5 Typed signal extraction

`agents/signal_agent.py` converts the raw row dictionaries into four dataclasses from `models/signals.py`:

- `SentrySignal` describes an error, its time, occurrence count, and affected users.
- `SlackSignal` describes matching messages and whether the issue is already known to engineers.
- `DeploySignal` describes a deployment and calculates minutes between the deployment and ticket time.
- `LinearSignal` describes a related work item and its status.

Each signal has a `found` flag, so the pipeline represents missing matches explicitly rather than using an absent object.

### 4.6 Diagnosis synthesis and storage

`agents/synthesis_agent.py` serializes the ticket, signals, and optional historical context into a language-model prompt.

It selects an OpenRouter-compatible OpenAI client when the OpenRouter key is present and the OpenAI package is available; otherwise it uses Anthropic.

It parses the model response as JSON and validates it with `models/brief.py`.

`TechnicalBrief` constrains root-cause and severity categories and normalizes a few common output variations.

In demo mode, the model call is intentionally skipped and `_load_fallback_brief()` selects one of the fixture briefs based on signal patterns.

Both model-generated and fallback briefs are saved to SQLite through `db/ops.py` before being returned to graph state.

### 4.7 Dispatch

`agents/dispatch_agent.py` tries to send every available brief as an Intercom internal note.

It also tries a Slack escalation when confidence is below `CONFIDENCE_THRESHOLD` or severity is `critical`.

`integrations/intercom.py` and `integrations/slack.py` format their respective messages and either print them in demo mode or call the live service.

Dispatch errors are logged separately so one outbound integration failure does not prevent the other attempt.

The dispatch agent also asks SQLite to mark the incident dispatched and return `dispatched: True` in graph state.

### 4.8 Events and dashboard updates

`api/webhook.py` runs the graph in `run_pipeline()` and sends SSE events through `api/stream.py`.

The event types emitted by current code are `started`, `sources_checked`, `coral_done`, `signal_done`, `synthesis_done`, `completed`, and `error`.

`api/stream.py` serializes each event as an SSE `data:` message and serves it from `GET /stream`.

`frontend/src/hooks/useSSE.js` opens an `EventSource`, parses incoming JSON, keeps the events in React state, and reconnects after a connection error.

`frontend/src/App.jsx` uses those events to build the incident list and select a brief for display.

`frontend/src/components/MetricsBar.jsx` fetches persisted metrics from `/stats` and updates its local display when it sees completed briefs.

## 5. Data contracts

### Ticket input

`models/ticket.py` defines `TicketContext` with ticket ID, customer email, message, creation time, priority, and tags.

### Pipeline state

`pipeline/state.py` defines the shared `NexusState` keys:

| Key | Main writer | Purpose |
|---|---|---|
| `ticket` | Webhook initializes it | Parsed support ticket |
| `pattern_match` | Ticket agent | Previous incidents for this customer |
| `result_set` | Coral agent | Raw SQL result rows |
| `sentry_signal` | Signal agent | Typed Sentry evidence |
| `slack_signal` | Signal agent | Typed Slack evidence |
| `deploy_signal` | Signal agent | Typed deployment evidence |
| `linear_signal` | Signal agent | Typed Linear evidence |
| `brief` | Synthesis agent | Validated diagnosis |
| `dispatched` | Dispatch agent | Dispatch completion marker |

### Diagnosis output

`models/brief.py` defines `TechnicalBrief`.

Its main fields include `root_cause`, `confidence_pct`, `severity`, `affected_service`, `affected_users`, `summary`, `signals_used`, `causal_chain`, `engineer_summary`, `draft_customer_response`, `recommended_action`, and optional Linear, endpoint, and ETA fields.

### Persistence

`db/models.py` contains SQLite DDL for the `incidents` table and indexes by customer email, affected service, and root cause.

The row stores a unique ticket ID, classification and confidence values, dispatch status, timestamps, and the full brief JSON.

`db/ops.py` owns persistence operations, including duplicate checks, saving briefs, historical lookups, dispatch updates, recent history, and stats.

### Coral rows

The aliases in `coral/queries.py` are read by `agents/signal_agent.py` and must remain aligned with fixture keys such as `sentry_issue_id`, `slack_message`, `deploy_sha`, and `linear_issue_id`.

### SSE event shape

Every event must include `event` and `ticket_id`.

Other fields depend on the event, for example `available_sources` on `sources_checked`, `signals_found` on `signal_done`, and `brief` on `completed`.

## 6. Repository file guide

This section indexes the authored files by responsibility.

### Root files

| File | Responsibility |
|---|---|
| `README.md` | Project overview, setup, endpoints, demo scenarios, and original architecture summary. |
| `report.md` | This onboarding report. |
| `main.py` | FastAPI app, CORS middleware, router registration, startup database initialization, and `/health`. |
| `config.py` | Environment-backed settings, credentials, mode selection, confidence threshold, and database URL. |
| `.env.example` | Template for demo/live configuration variables. Do not put actual secrets in this file. |
| `pyproject.toml` | Python project metadata, dependencies, and tool/test configuration. |
| `requirements.txt` | Python dependency pin list. |
| `uv.lock` | Resolved Python dependency lock data. |
| `package-lock.json` | Root-level npm lockfile; the frontend has its own package manifest and lockfile. |
| `.gitignore` | Excludes local environments, secrets, databases, caches, and frontend build output. |
| `PROMPT_LOG.md` | History and rationale for prompt iteration and demo stability checks. |
| `copilot-instructions.md` | Repository-specific coding guidance and historical architecture notes. |
| `.github/copilot-instructions.md` | GitHub Copilot instructions; includes a detailed but partly stale original file map and design notes. |
| `.vscode/settings.json` | Editor workspace settings. |

The actual `.env` file is local configuration and is intentionally not described or reproduced here.

### `api/`

| File | Responsibility |
|---|---|
| `api/__init__.py` | Marks the API package. |
| `api/webhook.py` | Signature verification, Intercom payload parsing, deduplication, background execution, Coral source checks, and pipeline SSE events. |
| `api/stream.py` | In-memory async queue, event validation, SSE formatting, and `GET /stream`. |
| `api/history.py` | `GET /history` and `GET /stats`, backed by SQLite operations. |

### `agents/`

| File | Responsibility |
|---|---|
| `agents/__init__.py` | Marks the agent package. |
| `agents/ticket_agent.py` | Adds previous incidents for the ticket's customer to graph state. |
| `agents/coral_agent.py` | Calls the Coral client with the master query and ticket ID. |
| `agents/signal_agent.py` | Converts raw query rows into the four typed signal dataclasses. |
| `agents/synthesis_agent.py` | Builds prompts, invokes a configured model outside demo mode, validates output, chooses fixture fallbacks, and persists the brief. |
| `agents/dispatch_agent.py` | Applies Intercom and Slack routing rules, logs delivery failures, and records dispatch completion. |

### `coral/`

| File | Responsibility |
|---|---|
| `coral/__init__.py` | Marks the Coral package. |
| `coral/queries.py` | Defines `MASTER_QUERY` and its source joins, time windows, and canonical output aliases. |
| `coral/client.py` | Switches between mock data and live Coral CLI execution; handles subprocess output, retry, and timeout behavior. |
| `coral/mock_client.py` | Resolves demo ticket IDs to JSON fixtures. |

### `db/`

| File | Responsibility |
|---|---|
| `db/__init__.py` | Marks the persistence package. |
| `db/models.py` | SQLite table and index SQL. Despite the filename, this contains DDL rather than ORM classes. |
| `db/session.py` | Opens SQLite connections, enables WAL and foreign keys, initializes the schema, and manages transactions. |
| `db/ops.py` | SQL operations for deduplication, brief persistence, history, customer patterns, stats, and dispatch status. |

### `integrations/`

| File | Responsibility |
|---|---|
| `integrations/__init__.py` | Marks the integrations package. |
| `integrations/intercom.py` | Formats a diagnosis as an internal note and posts it to Intercom outside demo mode. |
| `integrations/slack.py` | Formats a Block Kit escalation and posts it to Slack outside demo mode. |

### `models/`

| File | Responsibility |
|---|---|
| `models/__init__.py` | Marks the model package. |
| `models/ticket.py` | Defines the `TicketContext` dataclass. |
| `models/signals.py` | Defines `SentrySignal`, `SlackSignal`, `DeploySignal`, and `LinearSignal`. |
| `models/brief.py` | Defines and validates the Pydantic `TechnicalBrief`. |

### `pipeline/`

| File | Responsibility |
|---|---|
| `pipeline/__init__.py` | Marks the pipeline package. |
| `pipeline/state.py` | Defines the typed shared LangGraph state. |
| `pipeline/graph.py` | Registers and connects the five sequential agent nodes and exports the compiled graph. |

### `frontend/`

| File | Responsibility |
|---|---|
| `frontend/index.html` | Vite HTML entry page and React mount element. |
| `frontend/package.json` | Frontend scripts and React/Vite/testing dependencies. |
| `frontend/package-lock.json` | Resolved frontend npm dependency versions. |
| `frontend/vite.config.js` | React plugin and development proxy routes to the backend. |
| `frontend/src/main.jsx` | Mounts the root React application and imports global styles. |
| `frontend/src/App.jsx` | Dashboard layout, scenario triggers, health mode, SSE event state, ticket selection, and brief display. |
| `frontend/src/index.css` | Global theme and shared CSS/Tailwind utility styles. |
| `frontend/src/hooks/useSSE.js` | `EventSource` connection, event parsing, connection status, error state, and reconnection. |
| `frontend/src/components/TicketQueue.jsx` | Builds and renders a live ticket queue from events. |
| `frontend/src/components/TechnicalBrief.jsx` | Renders the selected diagnosis, causal chain, confidence, signals, response draft, and recommendation. |
| `frontend/src/components/MetricsBar.jsx` | Fetches stats, periodically refreshes them, and renders classification metrics. |
| `frontend/src/components/MetricsBar.css` | Styles for the metrics bar class-based design. The current component mostly uses inline styles. |
| `frontend/src/components/AgentStatus.jsx` | Renders source and pipeline progress from SSE events. |
| `frontend/src/components/AgentStatus.test.jsx` | Tests `AgentStatus` event filtering, progress, and error/source rendering. |

### `mock_data/`

| File | Responsibility |
|---|---|
| `mock_data/ticket_checkout.json` | Intercom-shaped checkout ticket payload. |
| `mock_data/ticket_login.json` | Intercom-shaped login/false-alarm scenario payload. |
| `mock_data/ticket_payment.json` | Intercom-shaped payment scenario payload. |
| `mock_data/ticket_false_alarm.json` | One-row false-alarm Coral-like signal fixture used by the mock client. |
| `mock_data/ticket_stripe_outage.json` | One-row Stripe-outage signal fixture used by the mock client. |
| `mock_data/coral_result_a.json` | Coral result rows for the checkout/known-bug case. |
| `mock_data/coral_result_b.json` | Coral result row with null signal values. |
| `mock_data/coral_result_c.json` | Coral result fixture for scenario C; currently also contains all-null signals. |
| `mock_data/scenario_b_all_null.json` | Additional all-null scenario fixture. |
| `mock_data/brief_fallback_a.json` | Deterministic known-bug diagnosis fallback. |
| `mock_data/brief_fallback_b.json` | Deterministic user-error diagnosis fallback. |
| `mock_data/brief_fallback_c.json` | Deterministic external-dependency diagnosis fallback. |

### `scripts/`

| File | Responsibility |
|---|---|
| `scripts/smoke_test.py` | Runs the three demo scenarios through the graph and checks expected classifications, signals, and dispatch state. |
| `scripts/dry_run.py` | Repeats three graph scenarios and checks output consistency and elapsed-time gates. |

### `tests/`

| File | Coverage |
|---|---|
| `tests/conftest.py` | Shared fixtures for the FastAPI client, demo mode, tickets, briefs, and signals. |
| `tests/coral_contract.py` | Helpers/constants used for the Coral query and fixture contract. |
| `tests/test_webhook.py` | Webhook signatures, payload parsing, duplicates, task scheduling, pipeline event behavior, errors, and cleanup. |
| `tests/test_stream.py` | SSE event validation, event format/order, and response headers. |
| `tests/test_history_main.py` | History/stats/health endpoints and route registration. |
| `tests/test_coral_agent.py` | Coral agent result and failure behavior. |
| `tests/test_coral_client.py` | Demo fixture path, subprocess arguments, and query alias contract. |
| `tests/test_coral_client_error.py` | Coral timeout, retry, subprocess failure, malformed JSON, and parameter handling. |
| `tests/test_coral_contract.py` | Fixture keys and SQL aliases remain compatible. |
| `tests/test_coral_live.py` | Opt-in checks that require a live Coral setup. |
| `tests/test_signal_agent.py` | Signal mapping for populated, empty, and mixed fixture rows. |
| `tests/test_synthesis.py` | Prompt generation, JSON/Pydantic parsing, retry behavior, and persistence. |
| `tests/test_dispatch.py` | Intercom delivery and confidence/severity Slack escalation rules. |

### `docs/`

| File | Subject |
|---|---|
| `docs/01_ARCHITECTURE.md` | Original high-level system architecture and design rationale. |
| `docs/02_AGENT_PIPELINE.md` | LangGraph state and original agent pipeline description. |
| `docs/03_CORAL_DATA_LAYER.md` | Coral SQL, signal contracts, fixtures, and persistence design notes. |
| `docs/04_API_COMPLEXITY.md` | API/SSE behavior and historical complexity analysis. |
| `docs/05_STRUCTURE_SETUP.md` | Original repository structure and setup guide. |

These documents are useful background, but several descriptions predate the current code and should be checked against this report and the implementation.

## 7. Running and testing locally

The repository documents Python 3.11 or later and Node.js 18 or later.

The Python dependencies can be installed from the project manifests, and the frontend dependencies from `frontend/package.json`.

A typical local run uses two terminals:

```bash
# Terminal 1, from the repository root
uvicorn main:app --reload

# Terminal 2
cd frontend
npm run dev
```

Set `DEMO_MODE=true` in the local `.env` to use fixture data and suppress live Intercom/Slack delivery.

The backend defaults to SQLite at `sqlite:///nexus.db`.

Useful checks documented by the project are:

```bash
pytest

cd frontend
npm test
npm run build
```

The standalone graph checks are:

```bash
DEMO_MODE=true python scripts/smoke_test.py
DEMO_MODE=true python scripts/dry_run.py
```

Live-mode checks require configured Coral sources, model credentials, and any outbound service credentials being exercised.

## 8. Current implementation notes and documentation differences

These points are especially relevant when using older README or architecture descriptions as a guide.

- **Ticket parsing is in the webhook.** `agents/ticket_agent.py` performs a customer history lookup; it does not parse raw Intercom payloads.
- **The pipeline is sequential.** The graph has five ordered nodes and no parallel execution branches.
- **The dashboard does not currently render `AgentStatus`.** The component and tests exist, but `frontend/src/App.jsx` imports and renders the queue, brief, and metrics components only.
- **Several named progress events are emitted after the graph returns.** `started` and `sources_checked` are emitted before the graph, but `coral_done`, `signal_done`, `synthesis_done`, and `completed` are broadcast after the entire `ainvoke()` finishes. They are therefore completion summaries, not live node-by-node progress.
- **SSE uses one in-process queue.** Events are consumed from a shared queue, not fanned out to each connected client. Multiple dashboard clients do not each receive a copy of every event, and process restarts lose queued events.
- **Deduplication has process and persistence pieces.** Active run tracking is in memory. The SQLite existence check becomes true after synthesis saves the brief, so it is not a durable claim/lock for an in-flight run across multiple worker processes.
- **`/stats` average confidence is currently a constant.** `db/ops.py` has `get_avg_confidence()`, but `api/history.py` returns a hard-coded estimate of 75.
- **Scenario C fixture descriptions differ from the active mock path.** The demo mock client selects `ticket_stripe_outage.json` for IDs containing `stripe`; `coral_result_c.json` itself is all-null. The fallback brief selection depends on parsed signals, not on the scenario label.
- **The master query references `intercom.conversations`.** The webhook already supplies ticket content, while comments in `coral/queries.py` describe the Intercom Coral source as not connected. Validate this source/query arrangement against the configured Coral environment before relying on live mode.
- **The source-health check tests four services.** It checks Sentry, Slack, GitHub, and Linear; demo mode reports all four available. Its result treats any successful query call as available, even if the rows are empty.
- **Demo mode skips the model call too.** Although some older setup text says an Anthropic key is always required, the current synthesis code deliberately selects a fixture fallback in demo mode.
- **The dashboard's demo trigger uses a permissive signature bypass.** That is for local demonstration; live webhook authentication should use the configured HMAC secret.

## 9. Suggested reading order

For a guided code tour, I recommend reading these files in sequence:

1. `README.md` for the product summary and setup context.
2. `main.py` and `config.py` for application startup and configuration.
3. `api/webhook.py` for the request and background-task flow.
4. `pipeline/graph.py` and `pipeline/state.py` for orchestration and state.
5. `agents/ticket_agent.py`, `agents/coral_agent.py`, `agents/signal_agent.py`, `agents/synthesis_agent.py`, and `agents/dispatch_agent.py` for the processing stages.
6. `models/ticket.py`, `models/signals.py`, and `models/brief.py` for the contracts shared across those stages.
7. `coral/queries.py`, `coral/client.py`, and `coral/mock_client.py` for live/demo data retrieval.
8. `db/session.py`, `db/models.py`, and `db/ops.py` for persistence.
9. `api/stream.py`, `frontend/src/App.jsx`, and `frontend/src/hooks/useSSE.js` for dashboard updates.
10. `integrations/intercom.py`, `integrations/slack.py`, and `tests/` to understand delivery and verify behavior.

## 10. UI redesign direction

The redesigned UI targets support/escalation staff on desktop first.
It should turn the current read-only dashboard into a clean support workspace where users select a ticket from a queue, review and edit a draft customer response, see technical details on demand, and explicitly approve actions before dispatch.

Planned actions are: send the reply to the customer, escalate to Slack, and mark the ticket resolved.
The queue should prioritize by status, severity, and recency, and demo scenarios should remain clearly separated from live tickets.

These decisions are captured in `ui-decisions.md`.
