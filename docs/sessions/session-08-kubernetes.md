# Session 8 — Kubernetes: From Compose to Cluster

**Goal:** Migrate the Team Notes stack from Docker Compose to Kubernetes, understand why Kubernetes exists, and see automatic pod scaling respond to the same Locust load tests from Session 7.

**Duration:** ~3 hours (can be split across two sessions)

**Prerequisites:**

- Sessions 1–7 completed
- A VPS with at least 2 vCPU and 4 GB RAM (any hourly cloud server works — DigitalOcean, Hetzner, OVH)
- `kubectl` installed on your machine (see below)

---

## Why Kubernetes?

In Session 7 you scaled manually:

```bash
docker compose up -d --scale api=3
```

That works, but it has problems:

1. Someone had to decide when to scale — while watching Grafana at 2am
2. Scaling back down is also manual
3. If the server itself dies, everything is gone — there's no automatic recovery
4. `--scale api=3` only works on one machine; what about spreading across multiple servers?

Kubernetes solves all of this. It is an **orchestration platform** — it decides where to run your containers, restarts them when they crash, and scales them up and down based on rules you define.

The key mental shift:

> **Docker Compose:** "Run these specific containers on this machine."
> **Kubernetes:** "Make sure this application is always running. I don't care where."

---

## Core concepts (read this before touching any commands)

You need these six concepts. Everything else builds on them.

### Pod

The smallest deployable unit. Usually one container. Think `docker run`.

```
Pod: api
  └── container: node:20-alpine running src/index.js
```

You almost never create Pods directly — you let a Deployment manage them.

### Deployment

Manages a set of identical Pods. You say "I want 3 replicas of the API". Kubernetes creates 3 Pods and keeps them running. If one crashes, it replaces it automatically.

```yaml
kind: Deployment
spec:
  replicas: 3 # I want exactly 3 running at all times
  template: # this is the Pod template
    spec:
      containers:
        - name: api
          image: ghcr.io/your-org/team-notes-api:latest
```

### Service

Stable DNS name + load balancer for a set of Pods. Pods come and go (they restart, scale up/down), but the Service address stays constant.

```
api-service (ClusterIP: 10.96.0.5)
  → Pod api-xyz1 (10.244.0.3)
  → Pod api-xyz2 (10.244.0.4)
  → Pod api-xyz3 (10.244.0.5)
```

Other services talk to `api-service:3000`, not to individual Pod IPs.

### Ingress

Routes external HTTP traffic into the cluster by hostname or path. Replaces Caddy/nginx as the entry point.

```
http://notes.yourdomain.com  →  frontend Service → frontend Pods
http://grafana.yourdomain.com → grafana Service → Grafana Pod
```

### ConfigMap / Secret

Store configuration separately from the container image.

- **ConfigMap** — non-sensitive config (environment variables, config files)
- **Secret** — sensitive values (passwords, API keys) — stored base64-encoded

### HorizontalPodAutoscaler (HPA)

Watches a Deployment's CPU (or memory, or custom metrics) and automatically adjusts the replica count.

```yaml
kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef:
    name: api # which Deployment to scale
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50 # scale out when average CPU > 50%
```

When Locust sends load → API CPU climbs above 50% → HPA adds a Pod → load distributes → CPU drops → HPA scales back in after 5 minutes.

This is exactly what was done manually in Session 7, but automatic.

---

## Architecture comparison

**Session 7 (Docker Compose):**

```
Host machine
├── db container
├── api container (--scale api=3 done manually)
├── frontend container
├── prometheus container
├── grafana container
└── locust container
```

**Session 8 (Kubernetes / k3s):**

```
k3s cluster (one node for now, can add more later)
├── notes namespace
│   ├── db StatefulSet (1 pod)
│   ├── api Deployment (1–5 pods, managed by HPA)
│   └── frontend Deployment (1 pod)
├── monitoring namespace
│   ├── prometheus Deployment
│   ├── grafana Deployment
│   ├── node-exporter DaemonSet (runs on every node)
│   └── locust Deployment
└── kube-system namespace
    ├── traefik (Ingress controller, built into k3s)
    ├── metrics-server (needed for HPA)
    └── coredns (DNS)
```

The application is identical — same Docker images, same code. Only the orchestration layer changes.

---

## Part 1 — Provision the server and install k3s (30 min)

Spin up a VPS. Recommended specs: **2 vCPU, 4 GB RAM, Ubuntu 22.04**. Any cloud provider works for an hourly test.

SSH into the server:

```bash
ssh root@<server-ip>
```

### Install k3s

k3s is a single binary that installs a complete Kubernetes cluster:

```bash
curl -sfL https://get.k3s.io | sh -
```

That's it. After about 30 seconds:

```bash
# Check the cluster is up
kubectl get nodes
# NAME          STATUS   ROLES                  AGE   VERSION
# your-server   Ready    control-plane,master   30s   v1.30.x+k3s1
```

### Copy the kubeconfig to your machine

`kubectl` on your local machine needs credentials to talk to the server. On the server:

```bash
cat /etc/rancher/k3s/k3s.yaml
```

Copy that output. On your local machine, paste it into `~/.kube/config`. Change the `server:` line from `https://127.0.0.1:6443` to `https://<server-ip>:6443`.

Test from your local machine:

```bash
kubectl get nodes
# Should show the same output as on the server
```

### Install Helm

Helm is a package manager for Kubernetes — like `apt` for clusters. You'll use it to install Prometheus and Grafana without writing hundreds of lines of YAML.

```bash
# On the server
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

### Install metrics-server

k3s does not include metrics-server (which is required for HPA). Install it:

```bash
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo update
helm install metrics-server metrics-server/metrics-server \
  --namespace kube-system \
  --set args={--kubelet-insecure-tls}
```

Wait ~60 seconds, then verify it works:

```bash
kubectl top nodes
# NAME          CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
# your-server   120m         6%     1234Mi          31%
```

If you see real numbers (not `<unknown>`), metrics-server is working. **This is a prerequisite for HPA — do not proceed until this works.**

---

## Part 2 — Deploy the Team Notes app (30 min)

Clone the repo on the server:

```bash
git clone <repo-url> team-notes
cd team-notes
```

Create the application namespace:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl get namespaces
# notes and monitoring should appear
```

Deploy everything:

```bash
kubectl apply -f k8s/app/
```

Check the rollout:

```bash
kubectl get pods -n notes -w
# Watch them go from Pending → ContainerCreating → Running
# Ctrl+C when all are Running
```

Check the Ingress:

```bash
kubectl get ingress -n notes
# Shows the hostname and the IP/port Traefik is listening on
```

Add the hostname to your local hosts file (or configure DNS on the real domain):

```
<server-ip>  notes.yourdomain.com
```

Open http://notes.yourdomain.com — the app should work exactly as before.

**What just happened?**

The desired state was described in YAML files (`k8s/app/`). Kubernetes read those files and made reality match the description: created the Pods, wired up the Services, configured the Ingress. If you delete a Pod manually (`kubectl delete pod <name>`), Kubernetes immediately creates a replacement. Try it.

---

## Part 3 — The Horizontal Pod Autoscaler (30 min)

The HPA is already defined in `k8s/app/api-hpa.yaml`. Apply it:

```bash
kubectl apply -f k8s/app/api-hpa.yaml
```

Check its status:

```bash
kubectl get hpa -n notes
# NAME      REFERENCE         TARGETS   MINPODS   MAXPODS   REPLICAS
# api-hpa   Deployment/api    3%/50%    1         5         1
```

The `TARGETS` column shows `3%/50%` — current CPU is 3%, scale-out threshold is 50%. This means:

- Right now: 1 replica (the minimum)
- If CPU exceeds 50%: add replicas until average drops below 50%
- Maximum 5 replicas
- Scale back in after 5 minutes of low CPU

Open a second terminal and watch it live:

```bash
kubectl get hpa -n notes -w
```

Leave this running — it will update as the HPA acts.

---

## Part 4 — Install Prometheus and Grafana (20 min)

Add the Helm chart repository:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

Install the full monitoring stack:

```bash
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  -f k8s/monitoring/kube-prometheus-stack-values.yaml
```

This installs Prometheus, Grafana, AlertManager, node-exporter, and kube-state-metrics in one command.

Wait for everything to start (~2 minutes):

```bash
kubectl get pods -n monitoring -w
# Ctrl+C when all show Running
```

Add Grafana's hostname to your hosts file:

```
<server-ip>  grafana.yourdomain.com
```

Open http://grafana.yourdomain.com — login with `admin` / `changeme` (see `k8s/monitoring/kube-prometheus-stack-values.yaml`).

Explore the built-in dashboards: **Dashboards → Kubernetes → Pods**. This shows CPU and memory for every pod in the cluster, automatically — no configuration needed.

---

## Part 5 — Deploy Locust and run the autoscaling demo (30 min)

Deploy Locust into the monitoring namespace:

```bash
kubectl apply -f k8s/monitoring/locust/
```

Add Locust's hostname to your hosts file:

```
<server-ip>  locust.yourdomain.com
```

Open http://locust.yourdomain.com.

### The main demo

Set up your screen with three windows side by side:

1. **Left:** Locust web UI (http://locust.yourdomain.com)
2. **Center:** Grafana — Kubernetes Pods dashboard
3. **Right:** Terminal running `kubectl get hpa -n notes -w`

In Locust, start a test with **150 users / 15 spawn rate**.

Watch the sequence unfold:

1. Locust ramps to 150 users over 10 seconds
2. API pod CPU climbs in Grafana
3. After ~30 seconds, HPA notices CPU > 50%
4. HPA adds a second Pod — you see it in the terminal: `REPLICAS: 2`
5. New pod starts, takes on some load, per-pod CPU drops
6. If still above 50%, HPA adds a third pod
7. Eventually stabilises — total CPU shared across however many pods were needed

Stop Locust. Watch the reverse:

1. CPU drops below 50% on all pods
2. HPA waits 5 minutes (the default scale-in cooldown — prevents flapping)
3. Then scales back to 1 replica

**This is the payoff of Sessions 7 and 8:** the same load that required manual intervention in Session 7 is now handled automatically.

---

## Part 6 — Key differences to understand (20 min)

Work through these comparisons as a group.

### Docker Compose vs Kubernetes: vocabulary

| Docker Compose                    | Kubernetes equivalent                       | Notes                                    |
| --------------------------------- | ------------------------------------------- | ---------------------------------------- |
| `services:`                       | `Deployment` + `Service`                    | Compose merges these; k8s separates them |
| `restart: unless-stopped`         | Deployment's default behaviour              | k8s always keeps Pods running            |
| `ports:`                          | `Service` + `Ingress`                       | k8s has more explicit routing            |
| Named volume                      | `PersistentVolumeClaim`                     | k8s storage is a separate abstraction    |
| `docker compose up --scale api=3` | `kubectl scale deployment/api --replicas=3` | Or let HPA do it automatically           |
| `.env` file                       | `ConfigMap` + `Secret`                      | k8s splits sensitive from non-sensitive  |
| Service name DNS                  | Service name DNS                            | Same idea — works the same way           |

### StatefulSet vs Deployment

The database runs as a **StatefulSet**, not a Deployment. The difference:

- **Deployment** — Pods are interchangeable. If one dies, any replacement will do. Good for stateless things like the API.
- **StatefulSet** — Pods have stable identities and stable storage. `db-0` always gets the same PersistentVolumeClaim. Good for databases.

This is why you can't just run `--scale db=3` for PostgreSQL — you need proper database replication (primary + replicas), which is a separate topic.

### Why metrics-server matters for HPA

HPA asks the Kubernetes API: "what is the current CPU usage of the api Deployment?"

The Kubernetes API gets that data from metrics-server, which reads it from the kubelet (the agent running on each node).

Without metrics-server, HPA has no data and shows `<unknown>` — it can't make scaling decisions.

This is the pipeline: `kubelet → metrics-server → Kubernetes API → HPA → scale decision`.

---

## Wrap-up discussion

- What are the tradeoffs of Kubernetes vs Docker Compose? (More powerful but much more complex to operate.)
- When does Kubernetes make sense? (Multiple services, multiple nodes, need for auto-healing and auto-scaling.)
- What would a production-grade k3s setup look like? (Multiple nodes, external database, proper TLS, GitOps with FluxCD or ArgoCD.)
- What's the next step after this? (Multi-node cluster, persistent storage with proper storage classes, CI/CD that deploys to the cluster automatically.)

---

## Deliverable

The group can explain: what a Deployment is, what a Service is, what an Ingress is, why HPA needs metrics-server — and has watched HPA automatically scale the API up and back down in response to Locust load.

---

## Cleanup

Hourly VPS cost adds up. When you're done:

```bash
# Delete all resources
kubectl delete namespace notes
kubectl delete namespace monitoring

# Or just destroy the server from the cloud provider UI
```

---

## Reference: useful kubectl commands

```bash
# See everything running
kubectl get all -n notes
kubectl get all -n monitoring

# Follow pod logs (like docker compose logs -f)
kubectl logs -f deployment/api -n notes

# Get a shell inside a running pod
kubectl exec -it deployment/api -n notes -- sh

# Watch pods change in real time
kubectl get pods -n notes -w

# Describe a resource (shows events, useful for debugging)
kubectl describe pod <pod-name> -n notes
kubectl describe hpa api-hpa -n notes

# Manually scale (bypasses HPA temporarily)
kubectl scale deployment/api --replicas=3 -n notes

# Apply all YAML in a directory
kubectl apply -f k8s/app/

# Delete all resources defined in a directory
kubectl delete -f k8s/app/

# Check resource usage
kubectl top pods -n notes
kubectl top nodes
```
