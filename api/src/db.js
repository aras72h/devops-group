const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'notes',
  user: process.env.DB_USER || 'notes_user',
  password: process.env.DB_PASSWORD || 'notes_pass',
});

// Test the connection and create table if it doesn't exist
async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id        SERIAL PRIMARY KEY,
        title     TEXT    NOT NULL,
        content   TEXT    NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Database ready');
  } finally {
    client.release();
  }
}

module.exports = { pool, init };
