# Session 4 — Deployment

**Goal:** Anyone can access the application from the Internet.

**Duration:** ~2 hours

---

## Before the session (facilitator)

You need:
- A VPS running Debian 12 (the production server at 94.101.181.37)
- A domain name with an A record pointing to the VPS IP
- Docker installed on the VPS (see setup steps below)

---

## VPS setup (one-time, facilitator does this before the session)

SSH into the server:

```bash
ssh root@94.101.181.37
```

Install Docker:

```bash
apt update && apt upgrade -y
apt install -y curl git

curl -fsSL https://get.docker.com | sh

# Add a non-root deploy user
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# Create the project directory
mkdir -p /home/deploy/team-notes
chown deploy:deploy /home/deploy/team-notes
```

Switch to the deploy user and clone the repo:

```bash
su - deploy
git clone https://github.com/your-org/team-notes.git ~/team-notes
cd ~/team-notes
cp .env.example .env
# Edit .env — set DB_PASSWORD to something real
nano .env
```

Set up the SSH key for CI:

```bash
# On the server as deploy user:
ssh-keygen -t ed25519 -C "ci-deploy" -f ~/.ssh/ci_deploy -N ""
cat ~/.ssh/ci_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/ci_deploy        # copy this — it goes into GitHub Secrets as VPS_SSH_KEY
```

---

## Part 1 — SSH basics (15 min)

Everyone SSHes into the server (facilitator shares a temporary password or adds their keys):

```bash
ssh deploy@94.101.181.37
```

Key concepts:
- **SSH** = Secure Shell. Encrypted terminal session over the network.
- **Public/private key pair** — the private key stays on your machine, the public key goes on the server. Never share the private key.
- **`~/.ssh/authorized_keys`** — list of public keys allowed to log in.

```bash
# On the server: explore
whoami
uname -a
df -h      # disk usage
free -m    # memory
```

---

## Part 2 — First manual deployment (30 min)

Everyone follows along as the facilitator deploys for the first time.

```bash
cd ~/team-notes

# Edit caddy/Caddyfile — replace notes.example.com with your real domain
nano caddy/Caddyfile

# Create the production .env
cp .env.example .env
nano .env   # set DB_PASSWORD, REGISTRY, IMAGE_TAG=latest
```

For the first deploy we'll build images on the server (before CI is set up):

```bash
docker compose up --build -d
```

Check everything is running:

```bash
docker compose ps
docker compose logs
```

Open the domain in a browser — it should show the app over **HTTPS**.

Watch Caddy obtain the TLS certificate in real time:

```bash
docker compose logs -f caddy
```

**Discussion:**
- What is HTTPS? Why does it matter?
- What did Caddy do automatically? (ACME challenge, Let's Encrypt)
- Why don't we expose the database port to the internet?

---

## Part 3 — Environment variables and secrets on the server (20 min)

Look at the `.env` file on the server:

```bash
cat ~/team-notes/.env
```

Discuss:
- The `.env` file is on the server, not in the repository
- The database password is only in `.env` and in the GitHub Secret `DB_PASSWORD`
- If someone gets read access to the repository, they still don't have the password

**Never do this:**
```bash
# BAD — password in the command, saved in shell history
docker run -e DB_PASSWORD=mysecret ...
```

**Do this instead:**
```bash
# GOOD — password in .env file, not in command history
docker compose --env-file .env up
```

---

## Part 4 — Automated deployment with CI (20 min)

Now wire up the GitHub Actions deploy job.

Add the secrets to the repository (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `94.101.181.37` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Contents of `~/.ssh/ci_deploy` on the server |
| `GHCR_TOKEN` | GitHub PAT with `write:packages` |
| `DB_PASSWORD` | The password from `.env` on the server |

Make a small change, push to `dev`, and watch the pipeline deploy automatically.

```bash
git checkout -b auto-deploy-demo
# make a trivial change, e.g. edit the page title in frontend/index.html
git add frontend/index.html
git commit -m "demo: test automated deployment"
git push -u origin auto-deploy-demo
# open PR, merge
```

Watch the Actions tab. After the deploy job finishes, refresh the live site.

**Discussion:** What is the difference between CI and CD? (CI = integrate and test, CD = deliver to production)

---

## Part 5 — Useful server commands (15 min)

Go through these together on the live server:

```bash
# See what's running
docker compose ps

# Follow all logs
docker compose logs -f

# Follow just one service
docker compose logs -f api

# Restart one service without touching the others
docker compose restart api

# Check resource usage
docker stats

# See disk usage by Docker
docker system df
```

---

## Wrap-up discussion

- What is a reverse proxy? Why do we need Caddy in front of nginx?
- What would happen if the server rebooted? (Services have `restart: always` — they come back automatically)
- What's the difference between `docker compose stop` and `docker compose down`?
- What would you do if you deployed a bad version? (Roll back: `IMAGE_TAG=<previous-sha> docker compose up -d`)

---

## Deliverable

The application is live at `https://your-domain.com` and a push to `dev` automatically deploys it.
