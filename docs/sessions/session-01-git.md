# Session 1 — Git & Team Collaboration

**Goal:** Four people actually work on the same codebase.

**Duration:** ~2 hours

---

## Setup (facilitator, before the session)

1. Create the GitHub repository and push the initial code to `dev`.
2. Add all four participants as collaborators (Settings → Collaborators).
3. Protect the `dev` branch: require at least one PR review before merging.

---

## Part 1 — Everyone clones and runs the app (20 min)

Each person:

```bash
git clone https://github.com/your-org/team-notes.git
cd team-notes
cp .env.example .env
```

Run it without Docker to see what they're working with:

```bash
cd api
npm install
# (needs a local PostgreSQL — or skip to Session 2 for Docker)
npm run dev
```

**Discussion:** What is a repository? What did `git clone` actually do?

---

## Part 2 — Feature branches (30 min)

Each person picks one small change from the list below and creates a branch:

```bash
git checkout -b your-name/your-change
```

Suggested changes (one per person):

| Person | Change |
|--------|--------|
| A | Add your name to `README.md` under a "Contributors" section |
| B | Add a comment to `api/src/notes.router.js` explaining what `RETURNING *` does |
| C | Change the placeholder text in the `<textarea>` in `frontend/index.html` |
| D | Add a second seed note to `db/init.sql` |

Make the change, then:

```bash
git add <file>
git commit -m "brief description of what you changed"
git push -u origin your-name/your-change
```

**Discussion:** Why not commit directly to `dev`? What is a branch actually?

---

## Part 3 — Pull Requests and reviews (30 min)

Each person opens a Pull Request on GitHub targeting `dev`.

PR checklist:
- Title describes *what* changed, not *how* (e.g. "Add contributors section to README", not "edited README.md")
- Description explains *why*

Then: each person reviews someone else's PR.

A review isn't just "LGTM". Look for:
- Does the change do what the title says?
- Is anything unclear or confusing?
- Would a future person understand this?

Approve and merge.

**Discussion:** What is a PR actually for? It's not just a gate — it's a communication tool.

---

## Part 4 — Deliberate merge conflict (30 min)

This is the important one. Everyone should experience a conflict before production forces it on them.

**Person A and Person B** both edit the same line in `README.md` at the same time.

1. Both checkout a new branch from the current `dev`:
   ```bash
   git checkout dev
   git pull
   git checkout -b conflict-demo-a   # Person A
   git checkout -b conflict-demo-b   # Person B
   ```

2. Both edit the first line of `README.md` — differently. Commit and push.

3. Person A opens a PR and merges first.

4. Person B opens a PR — GitHub now shows a conflict.

5. Person B resolves it locally:
   ```bash
   git checkout dev
   git pull
   git checkout conflict-demo-b
   git merge dev
   # edit the conflicted file, remove the <<<<<<< markers, keep the right content
   git add README.md
   git commit -m "resolve merge conflict"
   git push
   ```

6. PR is now mergeable. Merge it.

**Discussion:** What causes a conflict? How do you avoid them? (Short-lived branches, communicate, pull often.)

---

## Wrap-up discussion

- Why branches instead of committing straight to `dev`?
- What would a real team's workflow look like? (feature branches, release branches, hotfixes)
- Who reviews what? Does seniority matter?
- What would a bad PR look like? What would a good one look like?

---

## Deliverable

Everyone has successfully pushed a change that is now on the `dev` branch.
