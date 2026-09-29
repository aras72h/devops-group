const { Router } = require('express');
const { pool } = require('./db');

const router = Router();

// GET /api/notes — list all notes, newest first
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM notes ORDER BY created_at DESC'
  );
  res.json(rows);
});

// GET /api/notes/:id — get one note
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM notes WHERE id = $1',
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Note not found' });
  res.json(rows[0]);
});

// POST /api/notes — create a note
router.post('/', async (req, res) => {
  const { title, content = '' } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *',
    [title.trim(), content.trim()]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/notes/:id — update a note
router.put('/:id', async (req, res) => {
  const { title, content } = req.body;
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }
  const { rows } = await pool.query(
    `UPDATE notes
        SET title = $1, content = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *`,
    [title.trim(), (content || '').trim(), req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Note not found' });
  res.json(rows[0]);
});

// DELETE /api/notes/:id — delete a note
router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM notes WHERE id = $1',
    [req.params.id]
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Note not found' });
  res.status(204).end();
});

module.exports = router;
