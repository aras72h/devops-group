/**
 * Unit tests for the notes router logic.
 *
 * These tests do NOT need a real database — they mock the pool so the
 * CI pipeline can run them without spinning up PostgreSQL.
 *
 * Run with:  npm test
 */

const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ── Minimal mock of pg pool ──────────────────────────────────────────────────
let mockQueryResult = { rows: [], rowCount: 0 };

mock.module('pg', {
  namedExports: {
    Pool: class {
      query() {
        return Promise.resolve(mockQueryResult);
      }
      connect() {
        return Promise.resolve({
          query: () => Promise.resolve(),
          release: () => {},
        });
      }
    },
  },
});

// Import after mock is in place
const { pool } = require('../db');

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRes() {
  const res = {
    _status: 200,
    _body: undefined,
    status(code) { this._status = code; return this; },
    json(body)   { this._body = body; return this; },
    end()        { return this; },
  };
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Notes validation', () => {
  it('rejects a note with no title (POST)', async () => {
    // Dynamically import the router to pick up the mocked module
    const router = require('../notes.router');

    // Find the POST handler (stack entry where method === 'post' or layer route POST)
    const postLayer = router.stack.find(
      (l) => l.route && l.route.methods.post
    );
    assert.ok(postLayer, 'POST route should exist');

    const handler = postLayer.route.stack[0].handle;
    const req = { body: { title: '', content: 'hello' }, params: {} };
    const res = makeRes();

    await handler(req, res, () => {});
    assert.equal(res._status, 400);
    assert.equal(res._body.error, 'Title is required');
  });

  it('rejects a note update with no title (PUT)', async () => {
    const router = require('../notes.router');

    const putLayer = router.stack.find(
      (l) => l.route && l.route.methods.put
    );
    assert.ok(putLayer, 'PUT route should exist');

    const handler = putLayer.route.stack[0].handle;
    const req = { body: { title: '  ' }, params: { id: '1' } };
    const res = makeRes();

    await handler(req, res, () => {});
    assert.equal(res._status, 400);
    assert.equal(res._body.error, 'Title is required');
  });

  it('returns 404 when note is not found (GET /:id)', async () => {
    mockQueryResult = { rows: [], rowCount: 0 };
    const router = require('../notes.router');

    const getOneLayer = router.stack.find(
      (l) => l.route && l.route.path === '/:id' && l.route.methods.get
    );
    assert.ok(getOneLayer, 'GET /:id route should exist');

    const handler = getOneLayer.route.stack[0].handle;
    const req = { params: { id: '999' } };
    const res = makeRes();

    await handler(req, res, () => {});
    assert.equal(res._status, 404);
  });

  it('returns 404 when deleting a non-existent note (DELETE /:id)', async () => {
    mockQueryResult = { rows: [], rowCount: 0 };
    const router = require('../notes.router');

    const deleteLayer = router.stack.find(
      (l) => l.route && l.route.methods.delete
    );
    assert.ok(deleteLayer, 'DELETE route should exist');

    const handler = deleteLayer.route.stack[0].handle;
    const req = { params: { id: '999' } };
    const res = makeRes();

    await handler(req, res, () => {});
    assert.equal(res._status, 404);
  });
});
