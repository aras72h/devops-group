const express = require('express');
const cors = require('cors');
const { init } = require('./db');
const notesRouter = require('./notes.router');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request logger — prints every request to stdout so it shows in docker compose logs
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} → ${res.statusCode}`);
  });
  next();
});

// Health check — used by Docker, monitoring, and CI smoke tests
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/notes', notesRouter);

// Global error handler — keeps 500s from leaking stack traces to clients
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to DB first, then start listening
init()
  .then(() => {
    app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  });
