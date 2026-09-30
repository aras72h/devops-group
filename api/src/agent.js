/**
 * agent.js — replica stress signal loop
 *
 * Each API replica runs this as a background process.
 * Every WRITE_INTERVAL ms it writes its current stats to a shared
 * volume as a plain JSON file:
 *
 *   /agent-data/<replica-id>.json
 *
 * It then reads every other replica's file and decides whether the
 * cluster as a whole is stressed enough to start shedding writes.
 *
 * The shared volume (agent_data) is mounted by all API replicas in
 * docker-compose.yml — the filesystem IS the message board.
 * No external service required.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const AGENT_DIR      = process.env.AGENT_DIR || '/agent-data';
const WRITE_INTERVAL = 5_000;   // ms between ticks

// Thresholds that mark a replica as stressed
const SHED_P95_MS     = 800;    // p95 response time (ms)
const SHED_ERROR_RATE = 0.05;   // 5% 5xx rate
const SHED_QUORUM     = 0.5;    // fraction of stressed replicas that triggers shedding

// Unique identity — Docker Compose sets HOSTNAME to the container name
const REPLICA_ID = process.env.HOSTNAME || `replica-${process.pid}`;
const MY_FILE    = path.join(AGENT_DIR, `${REPLICA_ID}.json`);

// ── Request stats — written by the request middleware in index.js ─────────────
const stats = {
  requests: 0,
  errors:   0,
  samples:  [],   // rolling window of response times, last 200
};

function recordRequest(durationMs, isError) {
  stats.requests++;
  if (isError) stats.errors++;
  stats.samples.push(durationMs);
  if (stats.samples.length > 200) stats.samples.shift();
}

// ── Load-shed flag — read by the write guard in index.js ──────────────────────
let shedding = false;
function isShedding() { return shedding; }

// ── Cluster cache — served by GET /api/cluster/status ────────────────────────
let clusterCache = { replicas: [], shedding: false, updatedAt: null };
function getClusterCache() { return clusterCache; }

// ── Percentile helper ─────────────────────────────────────────────────────────
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

// ── Build this replica's status object ───────────────────────────────────────
function computeStatus() {
  const total   = stats.requests;
  const errRate = total > 0 ? stats.errors / total : 0;
  const sorted  = [...stats.samples].sort((a, b) => a - b);
  const p50     = percentile(sorted, 50);
  const p95     = percentile(sorted, 95);

  // Reset window for next tick
  stats.requests = 0;
  stats.errors   = 0;

  const stressed = p95 > SHED_P95_MS || errRate > SHED_ERROR_RATE;

  let message;
  if (p95 > SHED_P95_MS && errRate > SHED_ERROR_RATE)
    message = `🔴 ${REPLICA_ID}: p95=${p95}ms err=${(errRate*100).toFixed(1)}% — shedding writes`;
  else if (p95 > SHED_P95_MS)
    message = `🟡 ${REPLICA_ID}: p95=${p95}ms — latency elevated`;
  else if (errRate > SHED_ERROR_RATE)
    message = `🟡 ${REPLICA_ID}: err=${(errRate*100).toFixed(1)}% — errors rising`;
  else
    message = `🟢 ${REPLICA_ID}: p95=${p95}ms — healthy`;

  return {
    id:         REPLICA_ID,
    timestamp:  new Date().toISOString(),
    rps:        Math.round(total / (WRITE_INTERVAL / 1000)),
    p50_ms:     Math.round(p50),
    p95_ms:     Math.round(p95),
    error_rate: parseFloat(errRate.toFixed(4)),
    stressed,
    shedding,
    message,
  };
}

// ── Write own status file ─────────────────────────────────────────────────────
function publishStatus(status) {
  try {
    fs.mkdirSync(AGENT_DIR, { recursive: true });
    fs.writeFileSync(MY_FILE, JSON.stringify(status, null, 2), 'utf8');
  } catch (err) {
    console.error('[agent] write failed:', err.message);
  }
}

// ── Read all replica files ────────────────────────────────────────────────────
function readCluster() {
  const statuses = [];
  try {
    const files = fs.readdirSync(AGENT_DIR).filter(f => f.endsWith('.json'));
    const staleMs = WRITE_INTERVAL * 3;

    for (const file of files) {
      try {
        const raw  = fs.readFileSync(path.join(AGENT_DIR, file), 'utf8');
        const data = JSON.parse(raw);
        const age  = Date.now() - new Date(data.timestamp).getTime();
        if (age < staleMs) statuses.push(data);
      } catch {
        // malformed or being written — skip
      }
    }
  } catch (err) {
    console.error('[agent] read failed:', err.message);
  }
  return statuses;
}

// ── Shed decision ─────────────────────────────────────────────────────────────
function evaluateShedding(replicas) {
  if (replicas.length === 0) { shedding = false; return; }
  const stressed = replicas.filter(r => r.stressed).length;
  const prev     = shedding;
  shedding       = (stressed / replicas.length) > SHED_QUORUM;
  if (shedding !== prev) {
    console.log(`[agent] shedding ${shedding ? 'ON' : 'OFF'} — ${stressed}/${replicas.length} stressed`);
  }
}

// ── Main tick ─────────────────────────────────────────────────────────────────
function tick() {
  const status  = computeStatus();
  publishStatus(status);

  const replicas = readCluster();
  evaluateShedding(replicas);

  clusterCache = { replicas, shedding, updatedAt: new Date().toISOString() };
}

// ── Start ─────────────────────────────────────────────────────────────────────
function start() {
  console.log(`[agent] starting — id=${REPLICA_ID} dir=${AGENT_DIR}`);
  fs.mkdirSync(AGENT_DIR, { recursive: true });

  // Stagger slightly so replicas don't all write at the same instant
  const jitter = Math.random() * 2000;
  setTimeout(() => {
    tick();
    setInterval(tick, WRITE_INTERVAL);
  }, jitter);
}

module.exports = { start, recordRequest, isShedding, getClusterCache };
