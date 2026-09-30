/**
 * Unit tests for the notes router.
 *
 * Completely dependency-free — no node_modules required.
 * All third-party modules (pg, express, cors) are stubbed before any
 * application code loads, so these tests run with zero npm install.
 *
 * Run with: npm test
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');

// ── Stub third-party modules ─────────────────────────────────────────────────
// We insert fake entries into the require cache BEFORE loading any app code.
// The key must match what require() will look for — we use the path that
// Node would resolve to if the packages were installed.

let _queryFn = async () => ({ rows: [], rowCount: 0 });

function stubModule(name, exports) {
  // Use a synthetic path so require.resolve is never called
  const fakePath = path.join(__dirname, '..', '..', 'node_modules', name, 'index.js');
  require.cache[fakePath] = { id: fakePath, filename: fakePath, loaded: true, exports };
  // Also register under the bare name so require(name) finds it
  const Module = require('node:module');
  const orig   = Module._resolveFilename.bind(Module);
  Module._resolveFilename = function(req, ...rest) {
    if (req === name) return fakePath;
    return orig(req, ...rest);
  };
}

// Stub pg
stubModule('pg', {
  Pool: class FakePool {
    query(...args) { return _queryFn(...args); }
    connect()      { return Promise.resolve({ query: async () => {}, release: () => {} }); }
  },
});

// Stub cors — just a passthrough middleware
stubModule('cors', () => () => (req, res, next) => next());

// Stub express — minimal implementation sufficient for the router
function makeRouter() {
  const stack = [];
  const router = { stack };

  ['get','post','put','delete'].forEach(method => {
    router[method] = (routePath, ...handlers) => {
      stack.push({ route: { path: routePath, methods: { [method]: true }, stack: handlers.map(h => ({ handle: h })) } });
    };
  });

  return router;
}

const fakeExpress = () => {
  const app = {};
  app.use  = () => {};
  app.get  = () => {};
  app.post = () => {};
  return app;
};
fakeExpress.Router = makeRouter;
fakeExpress.json   = () => (req, res, next) => next();

stubModule('express', fakeExpress);

// ── Load app modules (picks up stubs above) ───────────────────────────────────
const { pool } = require('../db');
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

// ── Route lookup ─────────────────────────────────────────────────────────────
function getHandler(method, routePath) {
  const layer = router.stack.find(
    l => l.route &&
         l.route.methods[method] &&
         (routePath === undefined || l.route.path === routePath)
  );
  assert.ok(layer, `route ${method.toUpperCase()} ${routePath ?? '(any)'} not found`);
  return layer.route.stack[0].handle;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Notes router', () => {

  beforeEach(() => {
    _queryFn = async () => ({ rows: [], rowCount: 0 });
  });

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
    _queryFn = async () => ({ rows: [{ id: 1, title: 'Hello', content: 'World', created_at: new Date() }], rowCount: 1 });
    const res = makeRes();
    await getHandler('post')({ body: { title: 'Hello', content: 'World' }, params: {} }, res, () => {});
    assert.equal(res._status, 201);
    assert.equal(res._body.title, 'Hello');
  });

  it('PUT rejects an empty title', async () => {
    const res = makeRes();
    await getHandler('put', '/:id')({ body: { title: '  ' }, params: { id: '1' } }, res, () => {});
    assert.equal(res._status, 400);
    assert.equal(res._body.error, 'Title is required');
  });

  it('GET /:id returns 404 for a missing note', async () => {
    const res = makeRes();
    await getHandler('get', '/:id')({ params: { id: '999' } }, res, () => {});
    assert.equal(res._status, 404);
    assert.equal(res._body.error, 'Note not found');
  });

  it('DELETE /:id returns 404 for a missing note', async () => {
    const res = makeRes();
    await getHandler('delete', '/:id')({ params: { id: '999' } }, res, () => {});
    assert.equal(res._status, 404);
    assert.equal(res._body.error, 'Note not found');
  });

});
