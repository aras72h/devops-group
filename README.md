# Team Notes

A tiny shared notepad application used as the vehicle for an eight-session DevOps workshop.

```
Browser
   │
   ▼
Frontend (nginx) ──► Node.js API ──► PostgreSQL
                          │
                          ▼
                        Docker
```

---

## Quick start (local)

```bash
git clone <repo-url>
cd devops-group
cp .env.example .env          # edit passwords before first run
docker compose up --build -d
```

| URL                   | What                       |
| --------------------- | -------------------------- |
| http://localhost:8080 | The app                    |
| http://localhost:3001 | Grafana (admin / see .env) |
| http://localhost:8089 | Locust load tester         |

To wipe the database and start fresh:

```bash
docker compose down -v
docker compose up -d
```

> **Note:** If you change `DB_PASSWORD` in `.env` after the volume already exists,
> you must run `docker compose down -v` first — otherwise PostgreSQL will reject
> the new password.

---

## Architecture

### Local (Docker Compose)

```
docker-compose.yml
├── db           PostgreSQL 16
├── api          Node.js + Express (port 3000, internal)
├── frontend     nginx serving static files (port 8080)
├── node-exporter  host CPU/memory/disk metrics
├── cadvisor       per-container metrics
├── blackbox-exporter  HTTP endpoint probing
├── prometheus     metrics collection (internal)
├── grafana        dashboards (port 3001)
└── locust         load generator web UI (port 8089)
```

### Production (Docker Compose + Caddy)

```
docker-compose.yml + docker-compose.prod.yml
├── db, api, frontend   same services, pre-built images from CI
└── caddy               TLS termination + reverse proxy (ports 80/443)
```

### Session 8+ (Kubernetes / k3s)

```
k8s/
├── app/          db StatefulSet, api Deployment + HPA, frontend Deployment, Ingress
└── monitoring/   kube-prometheus-stack Helm values, Locust manifests
```

---

## Project layout

```
.
├── api/
│   ├── src/
│   │   ├── index.js          entry point, /health endpoint
│   │   ├── db.js             PostgreSQL connection pool
│   │   ├── notes.router.js   CRUD routes for /api/notes
│   │   └── tests/            unit tests (no DB required)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── index.html            static UI
│   ├── index.fa.html         Persian UI
│   ├── nginx.conf            proxies /api and /health to the API container
│   └── Dockerfile
├── db/
│   └── init.sql              table creation + seed data
├── caddy/
│   └── Caddyfile             production TLS reverse proxy config
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml    scrape config (node-exporter, cAdvisor, blackbox)
│   └── grafana/
│       ├── provisioning/     auto-provisioned datasource + dashboard loader
│       └── dashboards/       Team Notes dashboard JSON
├── locust/
│   └── locustfile.py         mixed realistic traffic (list/read/create/update)
├── k8s/
│   ├── namespace.yaml
│   ├── app/                  Kubernetes manifests for the app
│   └── monitoring/           Helm values + Locust manifests for k8s
├── .github/
│   └── workflows/
│       └── ci.yml            test → build → push pipeline
├── docker-compose.yml        local development (all services)
├── docker-compose.prod.yml   production overrides (pre-built images, Caddy)
├── .env.example              required environment variables
└── docs/sessions/            per-session guides
```

---

## API endpoints

| Method | Path           | Description    |
| ------ | -------------- | -------------- |
| GET    | /health        | Health check   |
| GET    | /api/notes     | List all notes |
| GET    | /api/notes/:id | Get one note   |
| POST   | /api/notes     | Create a note  |
| PUT    | /api/notes/:id | Update a note  |
| DELETE | /api/notes/:id | Delete a note  |

---

## Sessions

| #   | Topic                     | Guide                                                  |
| --- | ------------------------- | ------------------------------------------------------ |
| 1   | Git & Team Collaboration  | [session-01](docs/sessions/session-01-git.md)          |
| 2   | Docker                    | [session-02](docs/sessions/session-02-docker.md)       |
| 3   | CI (GitHub Actions)       | [session-03](docs/sessions/session-03-ci.md)           |
| 4   | Deployment                | [session-04](docs/sessions/session-04-deployment.md)   |
| 5   | Monitoring & Operations   | [session-05](docs/sessions/session-05-monitoring.md)   |
| 6   | Break It                  | [session-06](docs/sessions/session-06-break-it.md)     |
| 7   | Load Testing & Monitoring | [session-07](docs/sessions/session-07-load-scaling.md) |
| 8   | Kubernetes                | [session-08](docs/sessions/session-08-kubernetes.md)   |

---

## Roles (rotate each session)

| Role       | Focus                                |
| ---------- | ------------------------------------ |
| Developer  | Application code                     |
| DevOps     | Docker, deployment                   |
| CI/CD      | GitHub Actions pipeline              |
| Operations | Testing, monitoring, breaking things |
