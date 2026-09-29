# Session 5 — Monitoring & Operations

**Goal:** Know whether the application is actually working, before users tell you it isn't.

**Duration:** ~2 hours

---

## The question that drives this session

> "How do we know whether our application is actually working?"

Ask the group: "If the API crashed at 3am, how would you find out?"

- A user emails you tomorrow
- You notice when you try to use it yourself
- An alert wakes you up

The goal is option 3 — automated detection, before the impact is felt.

---

## Part 1 — Application logs (20 min)

Logs are the first tool you reach for when something goes wrong.

```bash
# All services together
docker compose logs

# Follow in real time
docker compose logs -f

# Just the API, last 50 lines
docker compose logs --tail=50 api

# Just the database
docker compose logs db
```

Use the app — create a note, edit it, delete it — while following the API logs. Notice what each request looks like.

Now cause a deliberate error: try to get a note that doesn't exist:

```bash
curl https://your-domain.com/api/notes/99999
```

See the 404 log line appear.

**Discussion:**
- What's the difference between a 404 and a 500?
- What information should a log line contain? (timestamp, level, what happened, relevant IDs)
- What would you search for in logs when the app is broken?

---

## Part 2 — The health endpoint (15 min)

The API has a `/health` endpoint built in.

```bash
curl https://your-domain.com/health
# {"status":"ok","timestamp":"2026-09-29T..."}
```

This is used by:
- Docker Compose `healthcheck` (waits for the API to be ready before starting the frontend)
- The status dot in the frontend UI
- Uptime monitoring (next part)

What makes a good health endpoint?
- Fast (< 100ms)
- Actually checks something real (could check DB connection — see below as an extension)
- Returns a machine-readable response

Check the Docker healthcheck status:

```bash
docker compose ps
# Look at the STATUS column — "healthy", "unhealthy", "starting"
```

---

## Part 3 — Container status (15 min)

```bash
# Live resource usage
docker stats

# Inspect a specific container
docker inspect team-notes-api-1

# See restart count (should be 0 on a healthy system)
docker inspect team-notes-api-1 | grep -A5 RestartCount
```

Interpret together:
- **CPU %** — is the process consuming unexpected CPU?
- **MEM USAGE** — is memory growing over time? (memory leak)
- **NET I/O** — is traffic what you expect?

---

## Part 4 — Uptime Kuma (30 min)

[Uptime Kuma](https://github.com/louislam/uptime-kuma) is a simple self-hosted uptime monitor with a nice UI and alerts.

Add it to the production stack. SSH into the server:

```bash
cd ~/team-notes
```

Add this service to `docker-compose.prod.yml` (or create a separate `docker-compose.monitoring.yml`):

```yaml
  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: always
    volumes:
      - uptime_data:/app/data
    ports:
      - "3001:3001"
    networks:
      - notes_net
```

And add `uptime_data:` under `volumes:`.

Start it:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d uptime-kuma
```

Access it at **http://your-server-ip:3001** (or add a Caddy route for it).

Set up a monitor:
1. Add monitor → HTTP(s)
2. URL: `https://your-domain.com/health`
3. Heartbeat interval: 60 seconds
4. Expected status code: 200

**Set up an alert:**
- Notification → Telegram, email, or whatever the group uses
- Test it

---

## Part 5 — Deliberately break something and watch the alert fire (20 min)

This is the payoff.

```bash
# Stop just the API
docker compose stop api
```

Watch Uptime Kuma — within 60 seconds it should show the monitor going down and fire an alert.

Open the frontend — the status dot turns red.

Check the logs:

```bash
docker compose logs frontend
# nginx will log 502 Bad Gateway errors
```

Restore:

```bash
docker compose start api
```

Watch Uptime Kuma recover. Alert fires again (recovery notification).

**Discussion:**
- What's the difference between the API being down and the whole server being down?
- If only the database is down, what would you see? Where would you look?
- What would you monitor in addition to `/health`? (Response time, error rate, disk space)

---

## Basic resource usage

```bash
# Server-level
top          # or htop if installed
df -h        # disk space
free -m      # memory

# Docker-level
docker system df    # space used by images, containers, volumes
docker stats        # live container resource usage
```

Warning signs to look for:
- Disk above 80%
- A container's memory growing continuously (leak)
- Restart count > 0

---

## Wrap-up discussion

- What's the difference between monitoring and logging? (Monitoring = is it up? Logging = what happened?)
- When should a health check fail? (DB unreachable, critical dependency down — not a single 404)
- What's the first thing you do when an alert fires at 3am?
- What would "good observability" look like for this app a year from now?

---

## Deliverable

An alert fires within 60 seconds of the API going down, and the team knows how to investigate using logs and container status.
