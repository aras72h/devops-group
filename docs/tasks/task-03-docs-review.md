# Task 3 — Review the README

**Assigned to:** Person 3  
**Branch name:** `person3/docs-review`  
**File to update:** `README.md`

---

## What to do

Read the README as if you've never seen this project before. Run the quick start commands. Fix anything that is wrong, unclear, or missing. Your job is to be the first real reader — the person who follows the instructions without any prior knowledge.

---

## Step-by-step

### 1. Create a GitHub Issue

Go to the repository on GitHub → Issues → New issue.

**Title:** `Review and fix README`

**Body:**

```
Read the README from scratch, run the quick start commands,
and fix anything that is wrong, unclear, or missing.
```

Note the issue number.

---

### 2. Create a branch

```bash
git checkout dev
git pull origin dev
git checkout -b person3/docs-review
```

---

### 3. Review the README

Open `README.md` and go through each section.

#### Quick start

Run every command exactly as written:

```bash
git clone <repo-url>
cd team-notes
cp .env.example .env
docker compose up --build
```

- [ ] Does it work without any extra steps?
- [ ] Is the URL correct? (`http://localhost:8080`)
- [ ] Is the "wipe the database" command correct?

#### Project layout

- [ ] Does the file tree match what's actually on disk?
- [ ] Are the descriptions accurate?

#### API endpoints table

Test each one with curl:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/notes
curl -X POST http://localhost:8080/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"test","content":"hello"}'
```

- [ ] Are the methods and paths correct?
- [ ] Do the descriptions match what they actually do?

#### Sessions table and Roles table

- [ ] Are the links to session guides correct?
- [ ] Does anything look outdated or wrong?

#### General

- [ ] Any typos?
- [ ] Anything confusing that should be reworded?
- [ ] Anything missing that someone new would need to know?

---

### 4. Fix what you find

Edit `README.md` directly. If you can't fix something (e.g. a command that requires the production server), just add a note explaining the limitation.

---

### 5. Commit and push

```bash
git add README.md
git commit -m "docs: fix and clarify README after review"
git push -u origin person3/docs-review
```

If you found nothing to fix, still commit with a note so there's a record.

---

### 6. Open a Pull Request

- **Base branch:** `dev`
- **Compare branch:** `person3/docs-review`
- **Title:** `Review and fix README`
- **Description:**

  ```
  Closes #<issue number>

  Changes made:
  - (list each thing you fixed or clarified)

  Commands verified:
  - docker compose up --build ✓
  - curl /health ✓
  - (etc.)
  ```

---

## Done when

- [ ] GitHub Issue created
- [ ] Quick start commands run and verified
- [ ] README fixed and committed
- [ ] PR open, reviewed, merged to `dev`
