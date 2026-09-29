# Task 2 — Manual functional testing

**Assigned to:** Person 2  
**Branch name:** `person2/manual-testing-report`  
**File to create:** `docs/test-report.md`

---

## What to do

Test every feature of the application manually and write down exactly what you find. Your job is to **break things** — find anything that doesn't work, looks wrong, or behaves unexpectedly.

You don't need to write code. Your deliverable is a written test report committed to the repository.

---

## Step-by-step

### 1. Create a GitHub Issue

Go to the repository on GitHub → Issues → New issue.

**Title:** `Manual functional testing report`

**Body:**

```
Run manual tests across all functionality:
create, view, edit, delete notes.
Test on desktop and mobile (Chrome DevTools device toolbar).
Document results in docs/test-report.md.
```

Note the issue number.

---

### 2. Create a branch

```bash
git checkout dev
git pull origin dev
git checkout -b person2/manual-testing-report
```

---

### 3. Start the application

```bash
docker compose up --build
```

Wait until you see `API listening on port 3000` in the logs, then open http://localhost:8080.

---

### 4. Run through every test case

For each test below, write down: **pass**, **fail**, or **unexpected behaviour + description**.

#### Create a note

| #   | Test                                                                           | Result |
| --- | ------------------------------------------------------------------------------ | ------ |
| C1  | Fill in title and content, click Save — note appears in list                   |        |
| C2  | Fill in title only (no content), click Save — note appears                     |        |
| C3  | Leave title empty, click Save — should show an error, not save                 |        |
| C4  | Type a very long title (200+ characters) — what happens?                       |        |
| C5  | Type HTML in the title e.g. `<b>bold</b>` — does it render as HTML or as text? |        |
| C6  | Create 10 notes quickly — do they all appear?                                  |        |

#### View notes

| #   | Test                                     | Result |
| --- | ---------------------------------------- | ------ |
| V1  | Notes are listed newest first            |        |
| V2  | Refresh the page — notes are still there |        |
| V3  | The status dot in the top-right is green |        |

#### Edit a note

| #   | Test                                                          | Result |
| --- | ------------------------------------------------------------- | ------ |
| E1  | Click Edit on a note — form fills in with existing content    |        |
| E2  | Change the title, click Update — title changes in list        |        |
| E3  | Click Edit, then click Cancel — form resets, nothing saved    |        |
| E4  | Click Edit, clear the title, click Update — should show error |        |

#### Delete a note

| #   | Test                                              | Result |
| --- | ------------------------------------------------- | ------ |
| D1  | Click Delete, confirm — note disappears from list |        |
| D2  | Click Delete, cancel — note stays                 |        |

#### Responsive layout — Chrome DevTools

Run all the tests above once on desktop, then repeat the key ones on a simulated mobile screen.

To switch to mobile view in Chrome:

1. Open DevTools (`F12`)
2. Click the **Toggle device toolbar** icon (or press `Ctrl+Shift+M`)
3. Select **iPhone 12 Pro** from the device dropdown (390×844)

| #   | Test                                                 | Desktop | Mobile |
| --- | ---------------------------------------------------- | ------- | ------ |
| R1  | Page loads without horizontal scrolling              |         |        |
| R2  | Form is readable and usable                          |         |        |
| R3  | Note cards are readable                              |         |        |
| R4  | Edit and Delete buttons are tappable (not too small) |         |        |
| R5  | Create a note — form submits correctly               |         |        |
| R6  | Status dot is visible in the header                  |         |        |

If anything looks broken or cramped on mobile, describe it in the Bugs section of your report.

---

#### API directly (optional, good to try)

Open a second terminal:

```bash
# Create a note via curl
curl -s -X POST http://localhost:8080/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"curl note","content":"created via curl"}' | cat

# List notes
curl -s http://localhost:8080/api/notes | cat

# Health check
curl -s http://localhost:8080/health | cat
```

---

### 5. Write your report

Create the file `docs/test-report.md` using this template:

```markdown
# Manual Test Report

**Date:**
**Tester:**
**Application version:** (run `git rev-parse --short HEAD`)
**Environment:** Docker Compose local (http://localhost:8080)  
**Browsers tested:** Chrome desktop, Chrome DevTools mobile (iPhone 12 Pro)

## Summary

- Tests run:
- Passed:
- Failed:
- Unexpected behaviour:

## Results

(paste your filled-in tables from above)

## Bugs found

(List anything that didn't work as expected. For each bug:)

### BUG-01: (short title)

- **Steps to reproduce:**
- **Expected:**
- **Actual:**
- **Severity:** low / medium / high

## Notes

(Anything else you noticed — confusing UI, missing features, suggestions)
```

---

### 6. Commit and push

```bash
git add docs/test-report.md
git commit -m "docs: add manual testing report"
git push -u origin person2/manual-testing-report
```

---

### 7. Open a Pull Request

- **Base branch:** `dev`
- **Compare branch:** `person2/manual-testing-report`
- **Title:** `Add manual testing report`
- **Description:**

  ```
  Closes #<issue number>

  Ran manual tests across all CRUD functionality.
  Results documented in docs/test-report.md.
  (briefly mention anything notable you found)
  ```

---

## Done when

- [ ] GitHub Issue created
- [ ] Application tested end-to-end
- [ ] `docs/test-report.md` written and committed
- [ ] PR open, reviewed, merged to `dev`
