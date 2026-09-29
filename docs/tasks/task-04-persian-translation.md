# Task 4 — Translate frontend to Persian with Vazir typeface

**Assigned to:** Person 4  
**Branch name:** `person4/persian-translation`  
**Files to change:** `frontend/index.fa.html` (already created as a starting point)

---

## What to do

A Persian version of the frontend has been started for you at `frontend/index.fa.html`. Your job is to:

1. Review it, fix any translation issues
2. Make sure the Vazir typeface loads and looks right
3. Test it works correctly in RTL
4. Decide whether to make it the default (`index.html`) or keep both versions

---

## Step-by-step

### 1. Create a GitHub Issue

Go to the repository on GitHub → Issues → New issue.

**Title:** `Translate frontend to Persian (RTL) with Vazir typeface`

**Body:**
```
Add a Persian (Farsi) version of the frontend.
- Translate all UI text
- Use Vazir typeface (rastikerdar/vazirmatn)
- Correct RTL layout
- Persian date formatting
```

Note the issue number.

---

### 2. Create a branch

```bash
git checkout dev
git pull origin dev
git checkout -b person4/persian-translation
```

---

### 3. Review the existing translation

Open `frontend/index.fa.html` and check everything listed below.

#### Text to verify

| Location | English original | Persian translation | Correct? |
|----------|-----------------|---------------------|----------|
| Page title | Team Notes | یادداشت‌های تیم | |
| Header | Team Notes | یادداشت‌های تیم | |
| Form heading | New note | یادداشت جدید | |
| Title label | Title | عنوان | |
| Content label | Content | متن | |
| Title placeholder | What's this note about? | موضوع یادداشت چیست؟ | |
| Content placeholder | Write something… | بنویسید… | |
| Save button | Save note | ذخیره | |
| Cancel button | Cancel | انصراف | |
| Edit button | Edit | ویرایش | |
| Delete button | Delete | حذف | |
| Edit form heading | Edit note | ویرایش یادداشت | |
| Update button | Update note | به‌روزرسانی | |
| Empty state | No notes yet… | هنوز یادداشتی وجود ندارد… | |
| Delete confirm | Delete this note? | این یادداشت حذف شود؟ | |
| Health: ok | API is healthy | سرویس در دسترس است | |
| Health: error | API error | خطا در سرویس | |
| Health: down | Cannot reach API | سرویس در دسترس نیست | |

Fix anything that reads unnaturally in Persian.

#### RTL layout to check

- [ ] Text flows right to left
- [ ] Form labels are on the right
- [ ] Buttons are aligned correctly
- [ ] Note cards look good
- [ ] The status dot is on the correct side of the header

#### Vazir typeface

The font loads from jsDelivr CDN:
```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
/>
```

If you don't have internet access locally, you can download the font files and serve them from the `frontend/` folder instead. Check if the font is loading in browser DevTools (Network tab).

---

### 4. Test it locally

```bash
docker compose up --build
```

The Persian file is `frontend/index.fa.html`. To test it, you have two options:

**Option A — Serve it as a second page**

Update `frontend/nginx.conf` to also serve `/fa` pointing to `index.fa.html`:

```nginx
location /fa {
    root   /usr/share/nginx/html;
    try_files /index.fa.html =404;
}
```

Then copy the file into place in the Dockerfile:
```dockerfile
COPY index.fa.html /usr/share/nginx/html/index.fa.html
```

Access it at http://localhost:8080/fa

**Option B — Replace the default (if the team agrees)**

Rename `index.fa.html` to `index.html` (backup the English version first):

```bash
mv frontend/index.html frontend/index.en.html
mv frontend/index.fa.html frontend/index.html
```

Then update the Dockerfile if needed.

**Discuss with the team which option to use before you merge.**

---

### 5. Things to check while testing

- [ ] Page loads at the correct URL
- [ ] Vazir font is applied (compare to system font — it should look visibly different)
- [ ] Create a note with Persian text — it displays correctly
- [ ] Edit a note — form fills in correctly
- [ ] Delete a note — confirm dialog shows in Persian
- [ ] Dates display in Persian numerals (`fa-IR` locale)
- [ ] Status dot shows the correct Persian message on hover

---

### 6. Commit and push

```bash
git add frontend/
git commit -m "feat: add Persian translation with Vazir typeface"
git push -u origin person4/persian-translation
```

---

### 7. Open a Pull Request

- **Base branch:** `dev`
- **Compare branch:** `person4/persian-translation`
- **Title:** `Add Persian (RTL) frontend with Vazir typeface`
- **Description:**
  ```
  Closes #<issue number>

  - Translated all UI text to Persian
  - Added Vazir typeface (Vazirmatn v33)
  - RTL layout with dir="rtl" on <html>
  - Persian date formatting with fa-IR locale
  - Serving at: (describe where — /fa or replaces default)

  Tested:
  - Font loads ✓
  - RTL layout correct ✓
  - Create / edit / delete notes in Persian ✓
  ```

---

## Notes on Vazir

The font is from [rastikerdar/vazirmatn](https://github.com/rastikerdar/vazirmatn) — a well-maintained open source Persian font. We use `Vazirmatn` (the variable version). If you want to switch to a local copy instead of CDN:

```bash
# Download from GitHub releases and put in frontend/fonts/
```

Then update the `@font-face` references in the HTML.

---

## Done when

- [ ] GitHub Issue created
- [ ] Persian text reviewed and corrected
- [ ] Vazir font loading and visible
- [ ] RTL layout correct
- [ ] Tested end-to-end (create, edit, delete)
- [ ] PR open, reviewed, merged to `dev`
