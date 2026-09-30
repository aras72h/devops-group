/**
 * Unit tests for the notes router.
 *
 * No database required. pg is stubbed via Node's require cache before
 * db.js or notes.router.js load, so no real connection is ever attempted.
 *
 * Works on any Node version, no flags needed.
 *
 * Run with: npm test
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ── Stub pg before anything imports it ───────────────────────────────────────
// Node caches modules by resolved path. By inserting a fake entry under the
// 'pg' key before db.js or notes.router.js are required, those modules get
// the stub instead of the real pg driver.

let _queryFn = async () => ({ rows: [], rowCount: 0 });

const fakePool = {
  query:   (...args) => _queryFn(...args),
  connect: async () => ({
    query:   async () => {},
    release: () => {},
  }),
};

// Insert stub into the require cache under the name 'pg'
require.cache[require.resolve('pg')] = {
  id:       require.resolve('pg'),
  filename: require.resolve('pg'),
  loaded:   true,
  exports:  { Pool: class FakePool { query(...a) { return fakePool.query(...a); } } },
};

// Now it's safe to load our modules — they'll pick up the stub
const { pool } = require('../db');

// Point pool.query at our controllable _queryFn so tests can override it
pool.query = (...args) => _queryFn(...args);

const router = require('../notes.router');

// ── Response stub ─────────────────────────────────────────────────────────────
function makeRes() {
  return {
    _status: 200,
    _body:   undefined,
    status(code) { this._status = code; return this; },
    json(body)   { this._body   = body; return this; },
    end()        { return this; },
  };
}

// ── Route lookup ──────────────────────────────────────────────────────────────
function getHandler(method, routePath) {
  const layer = router.stack.find(
    (l) =>
      l.route &&
      l.route.methods[method] &&
      (routePath === undefined || l.route.path === routePath)
  );
  assert.ok(layer, `route ${method.toUpperCase()} ${routePath ?? '(any)'} not found`);
  return layer.route.stack[0].handle;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Notes router', () => {

  beforeEach(() => {
    // Safe default — returns nothing, no error
    _queryFn = async () => ({ rows: [], rowCount: 0 });
  });

  // ── POST /api/notes ─────────────────────────────────────────────────────────
  it('POST rejects an empty title', async () => {
    const res = makeRes();
    await getHandler('post')({ body: { title: '', content: 'x' }, params: {} }, res, () => {});
    assert.equal(res._status, 400);
    assert.equal(res._body.error, 'Title is required');
  });

  it('POST rejects a whitespace-only title', async () => {
    const res = makeRes();
    await getHandler('post')({ body: { title: '   ' }, params: {} }, res, () => {});
    assert.equal(res._status, 400);
    assert.equal(res._body.error, 'Title is required');
  });

  it('POST creates a note and returns 201', async () => {
    const note = { id: 1, title: 'Hello', content: 'World', created_at: new Date() };
    _queryFn = async () => ({ rows: [note], rowCount: 1 });

    const res = makeRes();
    await getHandler('post')({ body: { title: 'Hello', content: 'World' }, params: {} }, res, () => {});
    assert.equal(res._status, 201);
    assert.equal(res._body.title, 'Hello');
  });

  // ── PUT /api/notes/:id ──────────────────────────────────────────────────────
  it('PUT rejects an empty title', async () => {
    const res = makeRes();
    await getHandler('put', '/:id')({ body: { title: '  ' }, params: { id: '1' } }, res, () => {});
    assert.equal(res._status, 400);
    assert.equal(res._body.error, 'Title is required');
  });

  // ── GET /api/notes/:id ──────────────────────────────────────────────────────
  it('GET /:id returns 404 for a missing note', async () => {
    _queryFn = async () => ({ rows: [], rowCount: 0 });

    const res = makeRes();
    await getHandler('get', '/:id')({ params: { id: '999' } }, res, () => {});
    assert.equal(res._status, 404);
    assert.equal(res._body.error, 'Note not found');
  });

  // ── DELETE /api/notes/:id ───────────────────────────────────────────────────
  it('DELETE /:id returns 404 for a missing note', async () => {
    _queryFn = async () => ({ rows: [], rowCount: 0 });

    const res = makeRes();
    await getHandler('delete', '/:id')({ params: { id: '999' } }, res, () => {});
    assert.equal(res._status, 404);
    assert.equal(res._body.error, 'Note not found');
  });

});
