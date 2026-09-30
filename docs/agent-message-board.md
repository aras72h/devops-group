# Agent Message Board

## What this is

Each API replica is an autonomous agent. Agents have no direct knowledge of each other — they communicate exclusively by writing and reading files on a shared MinIO bucket. This is the same side-channel mechanic that emerged in the OpenAI/HuggingFace incident, reproduced here in a safe, controlled environment.

Under normal load the app behaves identically to before. Under high load (triggered by Locust), the agents collectively decide to shed write traffic — and you can watch the coordination happen in real time through the message board panel in the UI.

---

## Architecture

```
                ┌─────────────────────────────────┐
                │       agent_data volume          │
                │   (shared Docker named volume)   │
                │     api-1.json                   │
                │     api-2.json         ◄──────┐  │
                │     api-3.json                 │  │
                └────────────┬───────────────────┘  │
                             │ read all             │
         ┌───────────────────┼──────────────────────┘
         │                   │                   write own
         ▼                   ▼                      │
    ┌─────────┐         ┌─────────┐           ┌─────────┐
    │  api-1  │         │  api-2  │           │  api-3  │
    │ (agent) │         │ (agent) │           │ (agent) │
    └────┬────┘         └────┬────┘           └────┬────┘
         │                   │                     │
         └───────────────────┼─────────────────────┘
                             │
                    GET /api/cluster/status
                             │
                             ▼
                       ┌──────────┐
                       │ Frontend │  message board panel
                       └──────────┘
```

---

## Files

| File                  | Purpose                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `api/src/agent.js`    | Background loop — writes own status file, reads cluster files, decides shedding                  |
| `api/src/index.js`    | Wires agent into request path (timing), exposes `/api/cluster/status`, load-shed guard on writes |
| `frontend/index.html` | Cluster panel (replica dots), message board (live log), load-shed banner, tool links             |
| `docker-compose.yml`  | `agent_data` named volume mounted by all API replicas                                            |
| `frontend/nginx.conf` | Proxies `/api/cluster/` to the API                                                               |

---

## How an agent tick works

Every 5 seconds each replica:

1. Computes stats from the last window: RPS, p50, p95, error rate
2. Writes `agents/<replica-id>/status.json` to MinIO
3. Lists all files in the bucket and reads every other replica's status
4. Discards entries older than 15 seconds (3 × interval) — stale replicas are invisible
5. Counts how many replicas are stressed (p95 > 800ms or error rate > 5%)
6. If more than 50% of visible replicas are stressed → activates load shedding
7. Updates the in-memory cluster cache that `/api/cluster/status` serves

---

## Load shedding

When active, `POST /api/notes`, `PUT /api/notes/:id`, and `DELETE /api/notes/:id` return:

```json
HTTP 503
{ "error": "Server is under high load — write operations temporarily paused", "shedding": true }
```

`GET` requests are never shed. The app remains readable under any load.

Shedding deactivates automatically once the stress ratio drops below 50%.

---

## Thresholds (agent.js)

| Constant          | Default | Meaning                           |
| ----------------- | ------- | --------------------------------- |
| `WRITE_INTERVAL`  | 5000ms  | How often each agent publishes    |
| `SHED_P95_MS`     | 800ms   | p95 latency above this = stressed |
| `SHED_ERROR_RATE` | 0.05    | 5% 5xx rate = stressed            |
| `SHED_QUORUM`     | 0.5     | >50% replicas stressed = shed     |

All four can be adjusted in `agent.js` to change how sensitive the cluster is.

---

## `/api/cluster/status` response shape

```json
{
  "shedding": false,
  "updatedAt": "2026-09-29T17:00:00.000Z",
  "replicas": [
    {
      "id": "devops-group-api-1",
      "timestamp": "2026-09-29T17:00:00.000Z",
      "rps": 24,
      "p50_ms": 12,
      "p95_ms": 38,
      "error_rate": 0,
      "shedding": false,
      "message": "🟢 devops-group-api-1: p95=38ms — healthy"
    }
  ]
}
```

---

## Frontend UI components

### Tool links (header)

Links to Grafana (`:3001`) and Locust (`:8089`) open in a new tab.

### Load-shed banner

Hidden by default. Appears at the top of the page when `shedding: true`. Disappears automatically when shedding stops.

```
⚠ System under high load — writes temporarily paused. Reads still work.
```

The 503 response from the API also surfaces inline on the note form with a specific message instead of a generic error.

### Cluster panel

One dot per replica, updated every 3 seconds by polling `/api/cluster/status`.

| Dot colour | Meaning                                   |
| ---------- | ----------------------------------------- |
| 🟢 Green   | p95 < 800ms and error rate < 5%           |
| 🟡 Yellow  | p95 > 800ms OR error rate > 5%            |
| 🔴 Red     | Both thresholds exceeded, shedding writes |

Shows replica ID and p95 on hover.

### Message board

A live scrolling log of the last 50 messages from all replicas, newest at the top. Each message is one line from the `message` field of the replica's status file — the exact text each agent wrote to MinIO. Updates every 3 seconds alongside the cluster panel.

---

## Running the demo

```bash
docker compose up --build -d
```

Start with one replica (default). Open:

- http://localhost:8080 — app + message board
- http://localhost:8089 — Locust
- http://localhost:9001 — MinIO console (watch files appear under the `agents` bucket)
- http://localhost:3001 — Grafana

In Locust, ramp to 200 users / 20 spawn rate. Watch:

1. Message board fills with 🟢 messages
2. As latency climbs, messages turn 🟡
3. At 800ms p95 → messages turn 🔴, banner appears, POST returns 503
4. Stop Locust → messages return to 🟢, banner disappears

Scale to 3 replicas for the multi-agent coordination:

```bash
docker compose up -d --scale api=3
```

Now three replica dots appear. Watch them react to load independently, then coordinate to shed writes once the quorum is reached.
