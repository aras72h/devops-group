"""
Team Notes — Locust load test
─────────────────────────────
Simulates realistic mixed user traffic against the Team Notes API.

Each virtual user follows this weighted task mix:
  - List all notes       (weight 5) — most common action, read-heavy
  - Read a single note   (weight 3) — drilling into a note
  - Create a note        (weight 2) — write operation
  - Update a note        (weight 1) — least common, write operation

The wait_time of 1–3 seconds between tasks simulates a real user
thinking before their next action, not a machine hammering the API.

Usage (via the web UI):
  1. Open http://localhost:4002
  2. Set "Number of users" (e.g. 50, 100, 200)
  3. Set "Spawn rate" — how many users to add per second (e.g. 10)
  4. Set "Host" to http://frontend:80  (already pre-set via --host flag)
  5. Click Start swarming
  6. Watch charts here and in Grafana side-by-side
"""

import random
from locust import HttpUser, task, between


# ── Seed data ──────────────────────────────────────────────────────────────────
# Locust workers share no state, so we keep a small in-process cache of
# note IDs that have been created during the run. This lets the read and
# update tasks work with real IDs rather than guessing.
#
# In a distributed Locust run (master + workers) each worker has its own
# cache — that's fine for our purposes.

_created_ids: list[int] = []

# A pool of realistic note content to cycle through
_NOTE_TITLES = [
    "Stand-up notes",
    "Deployment checklist",
    "Bug triage",
    "Sprint planning",
    "Architecture decision",
    "Post-mortem draft",
    "Meeting action items",
    "Q4 roadmap",
    "On-call runbook",
    "Performance observations",
]

_NOTE_CONTENTS = [
    "Discussed blocking issues. Three items need owner reassignment.",
    "Steps: pull latest, run migrations, smoke test /health endpoint.",
    "Root cause: connection pool exhausted under load. Fix: raise max_connections.",
    "Velocity review complete. Added 12 tickets to backlog for next sprint.",
    "Decided on event-driven architecture for the notifications service.",
    "Timeline reconstructed. Primary cause identified. Mitigation deployed.",
    "Owner: Alice — update Grafana dashboard by Friday.",
    "Three major features: auth v2, API rate limiting, export to CSV.",
    "Alert → check /health → inspect logs → check DB → escalate if >5 min.",
    "API p99 latency climbed to 800ms at 200 concurrent users. DB is bottleneck.",
]


class NoteUser(HttpUser):
    """
    Simulates a single human user of the Team Notes application.
    Each instance represents one concurrent user in the load test.
    """

    # Wait 1–3 seconds between tasks — simulates human reading/thinking time
    wait_time = between(1, 3)

    # The host is set via --host flag in docker-compose (http://api:3000).
    # Override here only for local testing outside of Docker.
    # host = "http://localhost:4000"

    def on_start(self):
        """
        Called once when a simulated user starts.
        Pre-populate the ID cache with existing notes so read/update
        tasks work immediately, even before any creates have run.
        """
        with self.client.get("/api/notes", catch_response=True) as resp:
            if resp.status_code == 200:
                notes = resp.json()
                for note in notes[:10]:   # only keep first 10 to avoid huge cache
                    nid = note.get("id")
                    if nid and nid not in _created_ids:
                        _created_ids.append(nid)
                resp.success()
            else:
                resp.failure(f"on_start: GET /api/notes returned {resp.status_code}")

    # ── Task: list all notes (weight 5) ──────────────────────────────────────
    @task(5)
    def list_notes(self):
        """Most common action — a user opening the app to see all notes."""
        self.client.get("/api/notes", name="GET /api/notes")

    # ── Task: read a single note (weight 3) ───────────────────────────────────
    @task(3)
    def read_note(self):
        """User clicks into a specific note to read it."""
        if not _created_ids:
            # No notes in cache yet — fall back to listing
            self.client.get("/api/notes", name="GET /api/notes")
            return
        note_id = random.choice(_created_ids)
        with self.client.get(
            f"/api/notes/{note_id}",
            name="GET /api/notes/:id",
            catch_response=True,
        ) as resp:
            if resp.status_code == 404:
                # Note was deleted by another user — remove from cache
                if note_id in _created_ids:
                    _created_ids.remove(note_id)
                resp.success()   # 404 here is expected, not a failure
            elif resp.status_code != 200:
                resp.failure(f"unexpected status {resp.status_code}")

    # ── Task: create a note (weight 2) ────────────────────────────────────────
    @task(2)
    def create_note(self):
        """User creates a new note. On success, its ID is cached for later tasks."""
        payload = {
            "title": random.choice(_NOTE_TITLES) + f" [{random.randint(1000, 9999)}]",
            "content": random.choice(_NOTE_CONTENTS),
        }
        with self.client.post(
            "/api/notes",
            json=payload,
            name="POST /api/notes",
            catch_response=True,
        ) as resp:
            if resp.status_code == 201:
                note = resp.json()
                nid = note.get("id")
                if nid:
                    _created_ids.append(nid)
                    # Keep cache from growing unbounded during a long run
                    if len(_created_ids) > 200:
                        _created_ids.pop(0)
                resp.success()
            else:
                resp.failure(f"POST /api/notes returned {resp.status_code}: {resp.text}")

    # ── Task: update a note (weight 1) ────────────────────────────────────────
    @task(1)
    def update_note(self):
        """User edits a note they created earlier."""
        if not _created_ids:
            return
        note_id = random.choice(_created_ids)
        payload = {
            "title": random.choice(_NOTE_TITLES) + f" [edited {random.randint(1, 99)}]",
            "content": random.choice(_NOTE_CONTENTS) + " (updated)",
        }
        with self.client.put(
            f"/api/notes/{note_id}",
            json=payload,
            name="PUT /api/notes/:id",
            catch_response=True,
        ) as resp:
            if resp.status_code == 404:
                if note_id in _created_ids:
                    _created_ids.remove(note_id)
                resp.success()   # race condition — another user deleted it
            elif resp.status_code != 200:
                resp.failure(f"PUT /api/notes/{note_id} returned {resp.status_code}")

    # ── Task: health check (weight 1) ─────────────────────────────────────────
    @task(1)
    def health_check(self):
        """
        Simulates an uptime monitor hitting /health in the background.
        Also validates the response shape so a broken health endpoint
        shows up as a Locust failure, not just a Grafana alert.
        """
        with self.client.get("/health", name="GET /health", catch_response=True) as resp:
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") != "ok":
                    resp.failure(f"health status is not ok: {data}")
                else:
                    resp.success()
            else:
                resp.failure(f"health returned {resp.status_code}")

