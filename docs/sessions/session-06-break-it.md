# Session 6 — Break It

**Goal:** Learn how to think when production is broken, not just what commands to run.

**Duration:** ~2 hours

---

## How this session works

Each person gets a broken scenario — sealed in an envelope or sent as a private message.

**Rules:**
- Nobody tells anyone else what their break is
- No Googling the exact error message for the first 10 minutes — try to reason first
- When you find the cause, fix it silently
- At the end, everyone explains how they diagnosed it — not just what it was

The facilitator sets up each break before the session (or during, while others work on the previous scenario).

The process to follow:

```
Something is broken
       ↓
What do I know? What do I NOT know?
       ↓
Check the obvious: is it running? (docker compose ps)
       ↓
Logs (docker compose logs <service>)
       ↓
Network (can the containers reach each other?)
       ↓
Configuration (environment variables, config files)
       ↓
Find the specific cause
       ↓
Fix it and verify
       ↓
Explain what you found and how
```

---

## Scenario A — API container won't start

**Break to apply (facilitator only):**

```bash
# On the server, SSH in and introduce a syntax error in the API code
docker compose exec api sh
# or edit the file directly on disk if using a bind mount

# Alternatively: set a bad environment variable
# Edit .env and set:
# DB_HOST=wrong_hostname
docker compose restart api
```

**What the participant sees:** The app loads the frontend but all API calls fail. The status dot is red.

**Diagnostic path:**
```bash
docker compose ps
# api shows "Restarting" or "Exit 1"

docker compose logs api
# Shows the startup error — connection refused, env var missing, etc.

docker inspect team-notes-api-1
# Check the restart count and last exit code

# If it's a bad DB_HOST:
docker compose exec frontend wget -qO- http://api:3000/health
# Connection refused or timeout
```

**Fix:** correct the environment variable in `.env`, then `docker compose up -d api`.

---

## Scenario B — Database connection is broken

**Break to apply (facilitator only):**

```bash
# Stop just the database
docker compose stop db
```

**What the participant sees:** The app seems to be running (`docker compose ps` shows all containers up) but creating or loading notes fails with a 500 error.

**Diagnostic path:**
```bash
docker compose ps
# db is stopped or unhealthy

docker compose logs api
# "Connection refused" or "ECONNREFUSED 5432"

docker compose logs db
# No output — it's not running

# Verify the DB is actually the problem:
docker compose exec api sh
wget -qO- http://localhost:3000/health
# Returns ok (the API process is alive)
exit

# The API is alive but can't reach the DB
```

**Fix:** `docker compose start db` — then wait for the healthcheck to pass before the API reconnects.

**Bonus break:** Change `DB_PASSWORD` in `.env` to the wrong value, then restart everything. Now the DB is running but authentication fails.

---

## Scenario C — Reverse proxy returns 502

**Break to apply (facilitator only):**

```bash
# Stop the frontend nginx container (Caddy can reach it but nginx is gone)
docker compose stop frontend
```

Or introduce a typo in `caddy/Caddyfile`:

```
# Change this:
reverse_proxy frontend:80
# To this:
reverse_proxy frontend:8080   # wrong port
```

Then `docker compose restart caddy`.

**What the participant sees:** Visiting the domain returns a `502 Bad Gateway` from Caddy.

**Diagnostic path:**
```bash
docker compose ps
# frontend is stopped, or caddy shows errors

docker compose logs caddy
# "dial tcp: ... connection refused" — Caddy can't reach the backend

# Is the frontend container running?
docker compose ps frontend

# Can Caddy reach the frontend at all?
docker compose exec caddy wget -qO- http://frontend:80
# Connection refused → container is down or wrong port

# Check the Caddyfile
cat caddy/Caddyfile
```

**Fix:** `docker compose start frontend`, or correct the port in Caddyfile and `docker compose restart caddy`.

---

## Scenario D — App is running but monitoring says it's down

**Break to apply (facilitator only):**

```bash
# Modify the health endpoint to return a non-200 status
docker compose exec api sh
```

Or, more realistically: change the health check URL in Uptime Kuma to a typo (`/healt` instead of `/health`).

Or change the API's health route to return 500:

```bash
# Temporarily edit api/src/index.js on the server to return status 500:
# app.get('/health', (req, res) => { res.status(500).json({ status: 'error' }) })
docker compose restart api
```

**What the participant sees:** The website loads and works fine. But Uptime Kuma shows it as down and alerts are firing.

**Diagnostic path:**
```bash
# Can you reach the health endpoint manually?
curl https://your-domain.com/health
# Returns 500 (or 404 if the URL in Kuma is wrong)

# Is the app actually broken?
# Try creating a note — it works fine

# So the health check is lying. Why?
# Check what URL Uptime Kuma is monitoring
# Check the actual /health response

docker compose logs api
# Look for health check hits — do they return 200?
```

**Fix:** Either fix the health endpoint code and restart, or fix the monitor URL in Uptime Kuma.

---

## Part 2 — Debrief (40 min, the most important part)

After everyone has fixed their scenario, go around the room.

Each person explains:

1. **What was the symptom?** (What did they see first?)
2. **What was their first guess?** (Were they right?)
3. **What commands did they run, and in what order?**
4. **What was the actual cause?**
5. **What would they check first next time?**

The facilitator asks follow-up questions:
- "You checked the logs — what exactly in the logs told you where to look next?"
- "What would you have done if the logs were empty?"
- "What's the difference between the service being down and the service being broken?"

---

## The thing you're actually teaching

It's not the specific commands. It's the mental model:

> **Start from what you can observe. Work inward from the outside.**

1. Can users reach the site? (browser, curl from outside)
2. Can Caddy reach the frontend? (logs, exec)
3. Can the frontend reach the API? (logs, exec)
4. Can the API reach the database? (logs, exec)
5. Is the database itself healthy? (logs, psql)

At each step, you're narrowing down where the break is. Once you've isolated the layer, you look at the config and logs for that specific thing.

---

## Wrap-up discussion

- What's the most important thing to do first when production is broken? (Stay calm, understand the scope — is it everything or one thing?)
- What information would you want in a runbook for this application?
- What would you do if you couldn't figure it out? (Escalate, roll back, communicate with users)
- What's the difference between a post-mortem and a blame session?

---

## Deliverable

Everyone can describe, step by step, how they diagnosed a production problem — not just what the answer was.
