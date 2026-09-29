# Session 3 — CI (GitHub Actions)

**Goal:** A bad change doesn't simply disappear into `dev`.

**Duration:** ~2 hours

---

## The problem CI solves (10 min)

Ask the group: "What could go wrong between writing code and it running in production?"

- Someone merges code that crashes on startup
- A function that used to work breaks because of a change elsewhere
- A config mistake makes the Docker build fail
- Nobody noticed because nobody ran the tests

CI (Continuous Integration) runs automated checks on every push. The pipeline is the last line of defence before code reaches other people.

---

## Part 1 — Read the workflow file (20 min)

Open `.github/workflows/ci.yml` together.

Walk through each section:

**Triggers:**
```yaml
on:
  push:
    branches: [dev]
  pull_request:
    branches: [dev]
```
Every push and every PR targeting `dev` triggers the pipeline.

**Job 1 — test:**
- Checks out the code
- Installs Node.js
- Runs `npm install` then `npm test`
- No database, no Docker — fast

**Job 2 — build:**
- Only runs on a real push (not PRs from forks)
- Builds both Docker images
- Pushes them to GitHub Container Registry (GHCR)
- Tags with both the git SHA and `latest`

**Job 3 — deploy:**
- SSHes into the VPS
- Pulls the new images
- Restarts the stack

**Discussion:**
- Why does `build` only run after `test` passes? (`needs: test`)
- Why do we tag with the git SHA? (Immutable — you can always roll back to a specific commit)
- What are GitHub Secrets and why do we need them?

---

## Part 2 — Run the tests locally (15 min)

```bash
cd api
npm install
npm test
```

Read the output together. The tests use Node's built-in test runner — no extra framework.

Open `api/src/tests/notes.test.js`. Read it. Notice:
- No real database — the PostgreSQL pool is mocked
- Tests check input validation (missing title → 400) and not-found (no rows → 404)
- These run in milliseconds

**Discussion:** What can't these tests catch? (Things that require a real database, integration between services)

---

## Part 3 — Watch a pipeline run (15 min)

Make a small, harmless change on a branch:

```bash
git checkout -b ci-demo
# e.g. add a comment to api/src/index.js
git add api/src/index.js
git commit -m "demo: trigger CI pipeline"
git push -u origin ci-demo
```

Open a PR on GitHub. Watch the checks appear on the PR page. Click through to the Actions tab and watch the jobs run in real time.

Everyone should follow along on their own screen.

---

## Part 4 — Break the pipeline (30 min)

This is the important part. **Intentionally introduce a failing change.**

One person does this (the "Developer" role for this session):

```bash
git checkout -b break-ci
```

Open `api/src/notes.router.js`. Find the POST handler and remove the title validation:

```js
// DELETE these lines:
if (!title || title.trim() === '') {
  return res.status(400).json({ error: 'Title is required' });
}
```

Push and open a PR:

```bash
git add api/src/notes.router.js
git commit -m "feat: allow notes without titles"
git push -u origin break-ci
```

**Everyone watches the CI pipeline fail** on the `test` job.

Read the error output together. Identify exactly which test failed and why.

---

## Part 5 — Fix it (15 min)

The Developer restores the validation:

```bash
# put the validation back in notes.router.js
git add api/src/notes.router.js
git commit -m "fix: restore title validation"
git push
```

Watch the pipeline go green. Merge the PR.

**Discussion:**
- What would have happened without CI? (The broken code goes to `dev`, eventually to production)
- Who is responsible for a failing pipeline — the person who wrote the code, or the person who merged it?
- When is it acceptable to merge a failing pipeline? (Almost never — but sometimes you fix forward)

---

## Part 6 — GitHub Secrets (15 min)

Walk through what secrets are needed and where they go:

1. Go to the repository → Settings → Secrets and variables → Actions
2. You need these secrets for the full pipeline to work:

| Secret | Value |
|--------|-------|
| `GHCR_TOKEN` | GitHub PAT with `write:packages` scope |
| `VPS_HOST` | IP of the production server |
| `VPS_USER` | SSH username on the server |
| `VPS_SSH_KEY` | Contents of the private SSH key |
| `DB_PASSWORD` | PostgreSQL password used in production |

The `deploy` job is for Session 4 — skip it for now by commenting it out.

**Discussion:** Why not put the SSH key in the Dockerfile? Why not commit the `.env` file?

---

## Wrap-up discussion

- What is the difference between CI and CD?
- What makes a good test? (Fast, isolated, tells you exactly what broke)
- What would you add to this pipeline next? (Linting, security scanning, integration tests)
- Is 100% test coverage a useful goal?

---

## Deliverable

A broken change pushed to a PR causes the pipeline to fail visibly, before anyone can merge it.
