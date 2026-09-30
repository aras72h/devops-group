# Session 7 — Load Testing & Monitoring

**Goal:** Simulate real user traffic, watch the application break under load, and understand what the metrics are telling you.

**Duration:** ~2.5 hours

**New services introduced:**

| Service           | Port                  | What it is                                    |
| ----------------- | --------------------- | --------------------------------------------- |
| Locust            | http://localhost:8089 | Load generator — you control how many users   |
| Grafana           | http://localhost:3001 | Dashboards — CPU, memory, response time       |
| Prometheus        | (internal)            | Metrics database — Grafana reads from here    |
| node-exporter     | (internal)            | Collects host CPU/memory/disk metrics         |
| cAdvisor          | (internal)            | Collects per-container CPU/memory metrics     |
| blackbox-exporter | (internal)            | Probes HTTP endpoints, measures response time |

---

## The question that drives this session

> "How many users can our application handle before it falls over?"

Right now, if 500 people used Team Notes simultaneously, what would happen?

- Would it slow down? How much?
- Which part would break first — the API or the database?
- How would you know it was struggling before real users started complaining?

This session gives you the tools to answer those questions with data, not guesses.

---

## Part 1 — Start the full stack (15 min)

Pull the latest changes and bring everything up:

```bash
git pull
cp .env.example .env    # if you haven't already — edit passwords if you like
docker compose up --build -d
```

This starts 9 services total. Give it about 60 seconds for everything to become healthy.

Check that all services are running:

```bash
docker compose ps
```

Every service should show `healthy` or `running`. If anything shows `restarting`, check its logs:

```bash
docker compose logs <service-name>
```

**Verify each UI is accessible:**

- App: http://localhost:8080 — create a couple of notes manually
- Grafana: http://localhost:3001 — login with `admin` / `admin` (or what you set in `.env`)
- Locust: http://localhost:8089 — you should see the "Start new load test" form

---

## Part 2 — Explore Grafana before the test (20 min)

Open Grafana at http://localhost:3001. The "Team Notes — Load & Resources" dashboard is already provisioned — find it under **Dashboards → Team Notes**.

Look at the four stat panels at the top:

- **API /health** — green means up, red means down
- **API Response Time** — milliseconds to respond to `/health`
- **Host CPU Usage** — percentage of the server's CPU being used
- **Host Memory Usage** — percentage of RAM being used

Right now, with no load, everything should be low and green. This is your **baseline**. Screenshot it or keep it open.

Below those stats are time-series graphs:

- **Container CPU %** — shows each container separately. The API and DB should be nearly flat.
- **Container Memory** — similar, but for RAM. PostgreSQL will hold more than the API.
- **Host CPU per core** — useful on multi-core servers to see if one core is saturated while others are idle.
- **HTTP Response Time** — how long the blackbox exporter takes to get a response from `/health` and `/api/notes`.

**Discussion:**

- What's the difference between container CPU and host CPU?
- If only the API container's CPU is spiking, what does that tell you?
- What would a memory leak look like on these graphs?

---

## Part 3 — First load test: finding the baseline (30 min)

Time to generate some load. Open Locust at http://localhost:8089.

You'll see three fields:

| Field           | Description                      | Start with |
| --------------- | -------------------------------- | ---------- |
| Number of users | Peak concurrent simulated users  | **20**     |
| Spawn rate      | New users added per second       | **5**      |
| Host            | Already set to `http://api:3000` | Leave it   |

Click **Start swarming**.

Locust will slowly ramp up to 20 users (adding 5 per second). Watch the Locust charts:

- **RPS** (requests per second) — how much traffic is being generated
- **Response time** — median and 95th percentile
- **Failures** — should be 0% at this load

Switch to Grafana. Within 15–30 seconds you should see:

- Container CPU for the `api` container start to climb
- HTTP response time increase slightly
- The stat panels update in real time (auto-refreshes every 10 seconds)

Let it run for 3–5 minutes. This is your **low-load baseline**.

Stop the test in Locust (click **Stop**).

**Discussion:**

- What was the RPS at 20 users?
- Did response time change at all?
- Did the DB container's CPU change? Why or why not?

---

## Part 4 — Ramp it up: finding the breaking point (40 min)

Now push harder. In Locust, start a new test with:

| Field           | Value   |
| --------------- | ------- |
| Number of users | **100** |
| Spawn rate      | **10**  |

Watch Grafana as users ramp up from 0 to 100 over 10 seconds.

Keep an eye on:

1. **API container CPU** — this is what scales with request volume
2. **HTTP response time** — this is what real users feel
3. **Locust failure rate** — this is the hard signal that the app is struggling

At 100 users you'll likely see:

- Response times climbing (median might go from 20ms to 100ms+)
- API CPU clearly elevated
- DB CPU also rising (it's doing more queries)

Let it stabilize for 2–3 minutes, then push further:

Stop → start a new test at **200 users / 20 spawn rate**.

At some point response times will spike or failures will appear. This is the **breaking point** — where the application can't keep up with demand.

When it starts struggling:

1. Note the user count where it broke
2. Note which metric spiked first (CPU? Response time? Failures?)
3. Look at the DB container vs the API container — which is under more pressure?

**Discussion:**

- Did the API or the DB show signs of stress first?
- What's the difference between a slow response and a failed request?
- If CPU is at 100%, what are your options? (Scale horizontally? Optimise code? Add caching?)

---

## Part 5 — Manual scaling (25 min)

Docker Compose can run multiple copies of the same service. The API is stateless (it holds no user data — that's all in the DB), so multiple instances can run in parallel.

Stop Locust first. Then scale the API to 3 instances:

```bash
docker compose up -d --scale api=3
```

Check what happened:

```bash
docker compose ps
# You should see api-1, api-2, api-3 all running
```

Docker Compose's internal DNS round-robins requests across all three instances. The frontend's nginx proxy automatically distributes traffic between them.

Now restart the same load test that was causing failures:

| Field           | Value   |
| --------------- | ------- |
| Number of users | **200** |
| Spawn rate      | **20**  |

Watch Grafana — you should now see 3 separate `api` lines in the Container CPU panel, each carrying a fraction of the total load. Response times should be significantly lower. Failures should drop or disappear.

**Scale back down after the test:**

```bash
docker compose up -d --scale api=1
```

**Discussion:**

- What's the difference between scaling the API and scaling the database?
- Why can't we just run `--scale db=3` to triple database capacity?
- This scaling was manual — someone had to notice the problem and react. What would automatic scaling look like? (That's Session 8.)
- What would need to change in the code or architecture to handle 10,000 users?

---

## Part 6 — Deliberately break it and watch the metrics (20 min)

This connects back to Session 6's "break it" theme, but now with real data.

**Break 1: Kill the API**

```bash
docker compose stop api
```

Watch Locust — failure rate immediately goes to 100%. Watch Grafana — the API /health panel goes red. Response time flatlines (no responses at all).

This is what a real incident looks like on a monitoring dashboard. Everything drops at once.

Restore:

```bash
docker compose start api
```

Watch Grafana recover — health goes green, response time returns.

**Break 2: Overwhelm the database**

Scale the API to 5 instances, then run a very aggressive test:

```bash
docker compose up -d --scale api=5
```

Locust: **500 users / 50 spawn rate**

With 5 API instances all hammering the DB simultaneously, PostgreSQL's connection pool will saturate. Watch for:

- DB container CPU pinned at 100%
- API response times climbing despite multiple API instances
- Eventually: failures with 500 errors as the connection pool is exhausted

This is the **database as a bottleneck** — a fundamental concept in scaling web applications.

Stop the test and scale back:

```bash
docker compose stop
docker compose up -d
```

---

## Understanding what you're looking at

### The metrics pipeline

```
Your App
   │
   ▼
node-exporter ──► host CPU/memory/disk/network
cAdvisor      ──► per-container CPU/memory/network
blackbox      ──► HTTP response time + up/down status
   │
   ▼
Prometheus (collects all of the above every 15s)
   │
   ▼
Grafana (queries Prometheus, renders dashboards)
```

### What each tool does

**Locust** is the attacker — it generates HTTP traffic to simulate users. The web UI lets you control the load without writing any code. Under the hood, each "user" is a Python coroutine that runs the task mix: mostly listing notes, occasionally creating or updating one, same as a real person would.

**Prometheus** is the database for metrics. It pulls (scrapes) data from exporters on a schedule (every 15 seconds by default). It stores time-series data — a value at a timestamp, for a named metric. You query it with PromQL.

**Grafana** is the visualisation layer. It knows nothing about your app — it just queries Prometheus and draws graphs. The dashboard that loaded automatically was pre-configured in `monitoring/grafana/dashboards/team-notes.json`.

**node-exporter** is an agent that reads Linux's `/proc` and `/sys` filesystems — the same data you see in `top` or `htop` — and exposes it as Prometheus metrics.

**cAdvisor** does the same thing but for Docker containers specifically. It reads from the Docker daemon and the Linux cgroup filesystem.

**blackbox-exporter** is an active probe — Prometheus tells it "go make an HTTP request to this URL" and it reports back how long it took and whether it succeeded. This is how the "API Response Time" stat panel works.

---

## Wrap-up discussion

- What's the difference between **monitoring** and **load testing**? (Monitoring is passive — watching what's happening. Load testing is active — deliberately creating conditions.)
- What would you set up as alerts in Grafana? (Response time > 500ms? Failure rate > 1%? CPU > 80%?)
- What did you learn about the application's bottleneck?
- In a real production system, how would you decide when to scale?
- What's the next step after manual `--scale`? (Automatic scaling — that's Session 8 with Kubernetes.)

---

## Deliverable

The group can answer: "Our API handles X users before response time degrades to Y ms, and the bottleneck is [API CPU / database connections]. With 3 API replicas, we can handle Z users."

---

## Stretch goals

**Add application-level metrics to the API:**

Install `prom-client` in the API to expose `/metrics`:

```bash
# In api/
npm install --save prom-client
```

Add to `api/src/index.js`:

```javascript
const client = require("prom-client");
client.collectDefaultMetrics();

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});
```

Then add a scrape job to `monitoring/prometheus/prometheus.yml`:

```yaml
- job_name: "team-notes-api"
  static_configs:
    - targets: ["api:3000"]
  metrics_path: /metrics
```

Hot-reload Prometheus (no restart needed):

```bash
curl -X POST http://localhost:9090/-/reload
```

Now Grafana can show Node.js-specific metrics: event loop lag, heap memory, active HTTP connections per instance. This is the difference between infrastructure metrics (cAdvisor) and application metrics (prom-client).

**Try a spike pattern in Locust:**

Instead of ramping slowly, send a sudden burst — 0 to 300 users instantly (`spawn rate = 300`). Watch how the system responds to a spike vs a gradual ramp. Real traffic patterns look much more like spikes (breaking news, a morning rush) than smooth ramps.
