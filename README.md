# Team Notes

A collaborative note-taking app with a full DevOps stack — containerised, automatically tested, deployed to production via CI/CD, and observable with Prometheus and Grafana.

---

## Stack

| Layer                   | Technology                                      |
| ----------------------- | ----------------------------------------------- |
| API                     | Node.js + Express                               |
| Database                | PostgreSQL 16                                   |
| Frontend                | Nginx serving static HTML/JS                    |
| Reverse proxy (prod)    | Caddy (automatic TLS)                           |
| Monitoring              | Prometheus + Grafana + node-exporter + cAdvisor |
| Load testing            | Locust                                          |
| Container orchestration | Docker Compose (dev/prod), k3s (Kubernetes)     |
| CI/CD                   | GitHub Actions                                  |

---

## Quick start

```bash
git clone <repo-url>
cd devops-group
cp .env.example .env      # set DB_PASSWORD before first run
docker compose up --build -d
```

| URL                   | Service |
| --------------------- | ------- |
| http://localhost:8080 | App     |
| http://localhost:3001 | Grafana |
| http://localhost:8089 | Locust  |

> If you change `DB_PASSWORD` in `.env` after the volume already exists, run
> `docker compose down -v` first to wipe the old volume before bringing it back up.

---

## Architecture

### Local (Docker Compose)

```
┌─────────────────────────────────────────────────────┐
│  docker-compose.yml                                 │
│                                                     │
│  frontend (nginx :8080)                             │
│      └── proxies /api/* and /health → api:3000      │
│                                                     │
│  api (Node.js :3000)                                │
│      └── connects to db:5432                        │
│                                                     │
│  db (PostgreSQL :5432)                              │
│                                                     │
│  node-exporter  ─┐                                  │
│  cadvisor        ├─► prometheus → grafana (:3001)   │
│  blackbox        ┘                                  │
│                                                     │
│  locust (:8089) ──► api:3000                        │
└─────────────────────────────────────────────────────┘
```

### Production (Docker Compose + Caddy)

Pre-built images from CI are pulled and started with production overrides. Caddy handles TLS termination on ports 80/443 and reverse proxies to the frontend container.

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes (k3s)

Manifests in `k8s/` deploy the full stack to a k3s cluster with a HorizontalPodAutoscaler on the API (scales 1→5 replicas at 50% CPU). The monitoring stack is installed via the `kube-prometheus-stack` Helm chart.

---

## Project layout

```
.
├── api/
│   ├── src/
│   │   ├── index.js            entry point, /health endpoint
│   │   ├── db.js               PostgreSQL connection pool
│   │   ├── notes.router.js     CRUD routes for /api/notes
│   │   └── tests/              unit tests
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── index.html              English UI
│   ├── index.fa.html           Persian (RTL) UI
│   ├── nginx.conf              proxies /api and /health to the API
│   └── Dockerfile
├── db/
│   └── init.sql                schema + seed data
├── caddy/
│   └── Caddyfile               TLS reverse proxy config
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml      scrape config
│   └── grafana/
│       ├── provisioning/       auto-provisioned datasource + dashboard
│       └── dashboards/         Team Notes dashboard JSON
├── locust/
│   └── locustfile.py           mixed read/write traffic simulation
├── k8s/
│   ├── namespace.yaml
│   ├── app/                    Kubernetes manifests (db, api, frontend, HPA, Ingress)
│   └── monitoring/             Helm values + Locust manifests
├── .github/
│   └── workflows/
│       └── ci.yml              test → build → push → deploy pipeline
├── docker-compose.yml          local development
├── docker-compose.prod.yml     production overrides
└── .env.example                required environment variables
```

---

## API

| Method | Path           | Description    |
| ------ | -------------- | -------------- |
| GET    | /health        | Health check   |
| GET    | /api/notes     | List all notes |
| GET    | /api/notes/:id | Get one note   |
| POST   | /api/notes     | Create a note  |
| PUT    | /api/notes/:id | Update a note  |
| DELETE | /api/notes/:id | Delete a note  |

---

## CI/CD pipeline

Every push to `dev` runs three jobs in sequence:

1. **test** — runs unit tests with Node's built-in test runner (no database required)
2. **build** — builds Docker images and pushes to GHCR tagged with the git SHA
3. **deploy** — SSHes into the production VPS and restarts the stack with the new images

Pull requests only run the `test` job — no build or deploy.

Required GitHub Secrets: `GHCR_TOKEN`, `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `DB_PASSWORD`.

---

## Monitoring

Prometheus scrapes node-exporter (host metrics), cAdvisor (container metrics), and the blackbox exporter (HTTP probe on `/health` and `/api/notes`). Grafana auto-provisions the datasource and a pre-built dashboard on startup.

To add application-level metrics (request rate, latency histograms), install `prom-client` in the API and expose a `/metrics` endpoint, then add a scrape job pointing to `api:3000`.

---

## Load testing

Open http://localhost:8089, set the number of concurrent users and spawn rate, and start. The locustfile simulates realistic mixed traffic: list notes (×5), read a note (×3), create a note (×2), update a note (×1).

To find the breaking point, ramp users up gradually while watching the Grafana dashboard. The database connection pool typically saturates before the API CPU does.

To scale horizontally:

```bash
docker compose up -d --scale api=3
```

---

## Kubernetes

See `k8s/` for manifests. Prerequisites on the target node:

```bash
# Install k3s
curl -sfL https://get.k3s.io | sh -

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install metrics-server (required for HPA)
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm install metrics-server metrics-server/metrics-server \
  --namespace kube-system --set args={--kubelet-insecure-tls}

# Deploy the app
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/app/

# Install Prometheus + Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f k8s/monitoring/kube-prometheus-stack-values.yaml

# Deploy Locust
kubectl apply -f k8s/monitoring/locust/
```
