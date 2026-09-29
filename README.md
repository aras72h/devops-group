# Team Notes

A tiny shared notepad application used as the vehicle for a six-session DevOps course.

```
Browser
   │
   ▼
Frontend (nginx) ──► Node.js API ──► PostgreSQL
                          │
                          ▼
                        Docker
```

## Quick start (local)

```bash
git clone <repo-url>
cd team-notes
cp .env.example .env          # edit DB_PASSWORD if you like
docker compose up --build
```

Open **http://localhost:8080**.

To wipe the database and start fresh:

```bash
docker compose down -v
docker compose up
```

## Project layout

```
team-notes/
├── api/                    Node.js + Express API
│   ├── src/
│   │   ├── index.js        entry point, /health endpoint
│   │   ├── db.js           PostgreSQL connection pool
│   │   ├── notes.router.js CRUD routes for /api/notes
│   │   └── tests/          unit tests (no DB required)
│   ├── Dockerfile
│   └── package.json
├── frontend/               Static HTML + vanilla JS
│   ├── index.html
│   ├── nginx.conf          proxies /api and /health to the api container
│   └── Dockerfile
├── db/
│   └── init.sql            table creation + seed data
├── caddy/
│   └── Caddyfile           production TLS reverse proxy
├── .github/
│   └── workflows/
│       └── ci.yml          test → build → deploy pipeline
├── docker-compose.yml      local development
├── docker-compose.prod.yml production overrides
├── .env.example
└── docs/sessions/          per-session workshop guides
```

## API endpoints

| Method | Path              | Description       |
|--------|-------------------|-------------------|
| GET    | /health           | Health check      |
| GET    | /api/notes        | List all notes    |
| GET    | /api/notes/:id    | Get one note      |
| POST   | /api/notes        | Create a note     |
| PUT    | /api/notes/:id    | Update a note     |
| DELETE | /api/notes/:id    | Delete a note     |

## Sessions

| # | Topic | Guide |
|---|-------|-------|
| 1 | Git & Team Collaboration | [session-01](docs/sessions/session-01-git.md) |
| 2 | Docker | [session-02](docs/sessions/session-02-docker.md) |
| 3 | CI (GitHub Actions) | [session-03-ci](docs/sessions/session-03-ci.md) |
| 4 | Deployment | [session-04](docs/sessions/session-04-deployment.md) |
| 5 | Monitoring & Operations | [session-05](docs/sessions/session-05-monitoring.md) |
| 6 | Break It | [session-06](docs/sessions/session-06-break-it.md) |

## Roles (rotate each session)

| Role | Focus |
|------|-------|
| Developer | Application code |
| DevOps | Docker, deployment |
| CI/CD | GitHub Actions pipeline |
| Operations | Testing, monitoring, breaking things |
