const express = require('express');
const cors    = require('cors');
const { init }    = require('./db');
const notesRouter = require('./notes.router');
const agent       = require('./agent');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request timing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms      = Date.now() - start;
    const isError = res.statusCode >= 500;
    agent.recordRequest(ms, isError);
    console.log(`${req.method} ${req.path} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/cluster/status', (req, res) => {
  res.json(agent.getClusterCache());
});

app.use('/api/notes', (req, res, next) => {
  const isWrite = ['POST', 'PUT', 'DELETE'].includes(req.method);
  if (isWrite && agent.isShedding()) {
    return res.status(503).json({
      error:    'Server is under high load -- write operations temporarily paused',
      shedding: true,
    });
  }
  next();
}, notesRouter);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
      try { agent.start(); } catch (err) { console.error('[agent] start failed:', err.message); }
    });
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  });
