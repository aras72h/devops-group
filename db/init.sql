-- ─────────────────────────────────────────────────────────────────────────────
-- Database initialisation script
--
-- Docker runs this automatically on FIRST start (when db_data volume is empty).
-- On subsequent starts the volume already has data, so this script is skipped.
--
-- To reset everything from scratch:
--   docker compose down -v   ← removes the db_data volume
--   docker compose up        ← recreates and runs this script again
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notes (
    id         SERIAL       PRIMARY KEY,
    title      TEXT         NOT NULL,
    content    TEXT         NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- A few sample notes so the app isn't empty on first boot
INSERT INTO notes (title, content) VALUES
    ('Welcome to Team Notes',
     'This is your shared team notepad. Create, edit, and delete notes together.'),
    ('Session 1 — Git',
     'Goal: four people working on the same repository. Everyone creates a branch, opens a PR, and gets it merged.'),
    ('Session 2 — Docker',
     'Goal: docker compose up gives everyone the same environment. No more "works on my laptop".');
