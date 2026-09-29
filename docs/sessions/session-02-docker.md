# Session 2 — Docker

**Goal:** `docker compose up` gives everyone the same working application.

**Duration:** ~2 hours

---

## The problem Docker solves (10 min)

Ask the group: "What does 'works on my laptop' actually mean?"

- Different Node.js versions
- Different PostgreSQL versions
- Different OS behaviour
- Missing environment variables
- "I don't have PostgreSQL installed"

Docker gives everyone an identical environment regardless of their machine.

---

## Part 1 — Key concepts (20 min)

Go through these one by one. Don't lecture — ask the group what they think each one is before explaining.

**Image** — a snapshot. Like a recipe. Read-only.

**Container** — a running instance of an image. You can have many containers from one image.

**Dockerfile** — instructions for building an image. Open `api/Dockerfile` and read it together.

**Port** — a container has its own network. A port mapping (`8080:80`) punches a hole from your machine into the container.

**Volume** — a way to persist data outside the container. Without it, data disappears when the container stops.

**Environment variable** — configuration that doesn't go in code. Open `.env.example` and read it.

**Docker Compose** — a tool to define and run multi-container applications. Open `docker-compose.yml` and read it together.

---

## Part 2 — First run (20 min)

```bash
cp .env.example .env
docker compose up --build
```

Watch the output together. Point out:
- Each service prefixes its log lines with its name (`db`, `api`, `frontend`)
- The order: `db` starts first, `api` waits for `db`'s healthcheck to pass, then `frontend` starts
- The API prints "Database ready" when it connects

Open **http://localhost:8080** — the app works.

---

## Part 3 — Explore (20 min)

While the app is running, in a second terminal:

```bash
# List running containers
docker compose ps

# Tail the API logs
docker compose logs -f api

# Open a shell inside the API container
docker compose exec api sh

# From inside the container — look around:
ls
node --version
cat /etc/os-release
exit

# Connect to the database
docker compose exec db psql -U notes_user -d notes
# Inside psql:
\dt
SELECT * FROM notes;
\q
```

**Discussion:**
- Where does the data live? (In the `db_data` Docker volume)
- What happens if we stop and start?

---

## Part 4 — Stop, start, verify data persists (15 min)

```bash
docker compose down
docker compose up
```

Open the app — notes are still there. The volume survived.

Now deliberately wipe it:

```bash
docker compose down -v    # -v removes volumes
docker compose up
```

Notes are gone — database was reset. The seed data from `db/init.sql` is back.

**Discussion:** When would you want to keep data? When would you want to wipe it? (dev vs prod)

---

## Part 5 — Environment variables (15 min)

Open `.env` and change `FRONTEND_PORT` to `9090`. Restart:

```bash
docker compose down
docker compose up
```

The app is now at **http://localhost:9090**. Config changed without touching any code.

Change the port back to `8080`.

**Discussion:** Why are secrets not in the code? What goes in `.env` vs what goes in the Dockerfile?

---

## Part 6 — Container networking (15 min)

Look at `docker-compose.yml` — all services share `notes_net`.

Inside the network, containers find each other by **service name**:
- The API connects to `db:5432`, not `localhost:5432`
- nginx connects to `api:3000`

Demonstrate:

```bash
docker compose exec api sh
wget -qO- http://db:5432   # raw TCP — will fail but shows name resolves
wget -qO- http://frontend:80/health   # this works
exit
```

**Discussion:** Why can't the frontend container call `localhost:3000` to reach the API?

---

## Wrap-up discussion

- What's the difference between an image and a container?
- Why does the API container wait for the `db` healthcheck?
- What would happen if we removed the `volumes:` section from the db service?
- What would break if two services had the same port mapping?

---

## Deliverable

`docker compose up` gives everyone the same working application on any machine.
