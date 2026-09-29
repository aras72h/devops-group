# Task 1 — Improve the frontend design

**Assigned to:** Person 1  
**Branch name:** `person1/improve-frontend-design`  
**File to change:** `frontend/index.html`

---

## What to do

The current frontend works but looks basic. Improve the visual design while keeping it a single HTML file with no build step and no external frameworks.

You can use an AI agent (Kiro, Copilot, Codex, etc.) to help write the CSS.

---

## Step-by-step

### 1. Create a GitHub Issue

Go to the repository on GitHub → Issues → New issue.

**Title:** `Improve frontend visual design`

**Body:**
```
The current frontend is functional but plain.
Improve the CSS to make it look more polished:
- Better typography and spacing
- Improved card design for notes
- Nicer form styling
- Subtle hover/focus states
- Keep it a single HTML file, no frameworks
```

Note the issue number (e.g. #5). You'll reference it in your PR.

---

### 2. Create a branch

```bash
git checkout dev
git pull origin dev
git checkout -b person1/improve-frontend-design
```

---

### 3. Make your changes

Open `frontend/index.html` and improve the CSS. Some ideas — do as many or as few as you like:

- Better color palette (the blue `#2563eb` can stay or change)
- Add a subtle shadow to cards (`box-shadow`)
- Improve the header (gradient, better spacing)
- Animate the status dot (pulse when healthy)
- Make the empty state more inviting
- Add a character counter or visual feedback on the form
- Improve the delete confirmation (replace `confirm()` with an inline confirmation button)
- Make it look good on mobile

**Ask your AI agent:** *"Here is my index.html. Improve the CSS to make it look more professional and modern. Keep it a single file, vanilla CSS only, no frameworks."* Then paste the file in.

---

### 4. Test it locally

```bash
docker compose up --build
```

Open http://localhost:8080 and check:
- The page loads
- You can create, edit and delete notes
- Nothing is broken

---

### 5. Commit and push

```bash
git add frontend/index.html
git commit -m "style: improve frontend visual design"
git push -u origin person1/improve-frontend-design
```

---

### 6. Open a Pull Request

Go to GitHub → Pull requests → New pull request.

- **Base branch:** `dev`
- **Compare branch:** `person1/improve-frontend-design`
- **Title:** `Improve frontend visual design`
- **Description:**
  ```
  Closes #<issue number>

  What changed:
  - (describe what you actually changed)

  Tested:
  - Opened http://localhost:8080
  - Created a note ✓
  - Edited a note ✓
  - Deleted a note ✓
  ```

Request a review from one other person.

---

## Done when

- [ ] GitHub Issue created
- [ ] Branch pushed
- [ ] PR open and linked to the issue
- [ ] At least one person has reviewed it
- [ ] Merged to `dev`
