import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const bridgeSource = fs.readFileSync(path.join(root, 'qortium-qortal-bridge.js'), 'utf8');
const playerSource = fs.readFileSync(path.join(root, 'player.html'), 'utf8');

function response(status, contentType = 'application/octet-stream', jsonValue = null, textValue = '') {
  let canceled = false;
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key) => key.toLowerCase() === 'content-type' ? contentType : null },
    json: async () => jsonValue,
    text: async () => textValue,
    body: { cancel: async () => { canceled = true; } },
    get canceled() { return canceled; }
  };
}

function loadBridge({ qortalRequest, qdnRequest, fetchImpl }) {
  const window = {};
  if (qortalRequest) window.qortalRequest = qortalRequest;
  if (qdnRequest) window.qdnRequest = qdnRequest;
  const context = {
    window,
    URL,
    URLSearchParams,
    fetch: fetchImpl || (() => { throw new Error('unexpected HTTP fallback'); })
  };
  window.parent = window;
  window.top = window;
  vm.runInNewContext(bridgeSource, context);
  return window.qortiumQortal;
}

test('Home 2 generic Qortal actions preserve coordinates and provenance', async () => {
  const calls = [];
  const api = loadBridge({
    qortalRequest: async (request) => {
      calls.push(request);
      if (request.action === 'GET_QDN_RESOURCE_URL') return { url: 'home://qortal/resource' };
      return request.action === 'FETCH_QDN_RESOURCE' ? { body: 'BASE64', encoding: 'base64' } : [];
    },
    qdnRequest: async () => { throw new Error('wrong protocol'); }
  });

  await api.searchResources({ service: 'METADATA', name: 'Synthetic', query: 'NES', limit: 2 });
  await api.getResourceStatus({ service: 'FILES', name: 'Synthetic', identifier: 'demo', build: true });
  await api.fetchResource({ service: 'FILES', name: 'Synthetic', identifier: 'demo', path: 'rom.nes', maxBytes: 1234 });
  assert.equal(await api.getResourceUrl({ service: 'FILES', name: 'Synthetic', identifier: 'demo', path: 'rom.nes' }), 'home://qortal/resource');
  assert.deepEqual(calls.map((request) => request.action), [
    'SEARCH_QDN_RESOURCES',
    'GET_QDN_RESOURCE_STATUS',
    'FETCH_QDN_RESOURCE',
    'GET_QDN_RESOURCE_URL'
  ]);
  assert.equal(calls[2].path, 'rom.nes');
  assert.equal(calls[2].maxBytes, 1234);
});

test('bridge rejection and invalid URL never cross protocol or fall back to HTTP', async () => {
  let qdnCalls = 0;
  let fetchCalls = 0;
  const api = loadBridge({
    qortalRequest: async (request) => {
      if (request.action === 'GET_QDN_RESOURCE_URL') return null;
      throw new Error('UNSUPPORTED_PROTOCOL');
    },
    qdnRequest: async () => { qdnCalls += 1; return []; },
    fetchImpl: async () => { fetchCalls += 1; return response(200, 'application/json', []); }
  });

  await assert.rejects(() => api.getResourceStatus({ service: 'FILES', name: 'Synthetic' }), /UNSUPPORTED_PROTOCOL/);
  await assert.rejects(() => api.getResourceUrl({ service: 'FILES', name: 'Synthetic' }), /invalid URL/);
  assert.equal(qdnCalls, 0);
  assert.equal(fetchCalls, 0);
});

test('legacy qdnRequest is used only when qortalRequest is absent, with no HTTP downgrade', async () => {
  const calls = [];
  const api = loadBridge({
    qdnRequest: async (request) => {
      calls.push(request);
      return { status: 'READY' };
    },
    fetchImpl: async () => { throw new Error('HTTP fallback is forbidden'); }
  });
  assert.deepEqual(await api.getResourceStatus({ service: 'FILES', name: 'Synthetic' }), { status: 'READY' });
  assert.equal(calls[0].action, 'GET_QORTAL_RESOURCE_STATUS');

  const rejectingApi = loadBridge({
    qdnRequest: async () => { throw new Error('legacy host rejection'); },
    fetchImpl: async () => { throw new Error('HTTP fallback is forbidden'); }
  });
  await assert.rejects(() => rejectingApi.getResourceStatus({ service: 'FILES', name: 'Synthetic' }), /legacy host rejection/);
});

test('standalone browser uses HTTP only when neither bridge exists', async () => {
  const requests = [];
  const api = loadBridge({
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.includes('/search?')) return response(200, 'application/json', [{ name: 'Synthetic' }]);
      return response(200, 'text/plain', null, 'BODY');
    }
  });
  assert.deepEqual(await api.searchResources({ service: 'METADATA', query: 'NES' }), [{ name: 'Synthetic' }]);
  assert.equal(await api.fetchResource({ service: 'FILES', name: 'Synthetic', path: 'rom.nes' }), 'BODY');
  assert.equal(requests.length, 2);
});

function playerFunction(name, followingName) {
  const start = playerSource.indexOf('        async function ' + name);
  const end = playerSource.indexOf('        function ' + followingName, start);
  return playerSource.slice(start, end).trim();
}

const htmlFallbackFunction = playerSource.slice(
  playerSource.indexOf('        function isHtmlFallbackResponse'),
  playerSource.indexOf('        function readQdnStatusCode')
).trim();
const urlAssetFunction = playerFunction('urlAssetExists', 'isHtmlFallbackResponse');

test('asset probe retries HEAD 403 with ranged GET and cancels the body', async () => {
  const calls = [];
  const ranged = response(206);
  const context = {
    fetch: async (url, init) => {
      calls.push({ url, init });
      return calls.length === 1 ? response(403) : ranged;
    }
  };
  vm.runInNewContext(htmlFallbackFunction, context);
  const exists = vm.runInNewContext('(' + urlAssetFunction + ')', context);
  assert.equal(await exists('data/loader.js'), true);
  assert.deepEqual(calls.map((call) => call.init.method), ['HEAD', 'GET']);
  assert.equal(calls[1].init.headers.Range, 'bytes=0-0');
  assert.equal(ranged.canceled, true);
});

test('asset probe treats HEAD 404 and HTML fallback as absent', async () => {
  const html = response(200, 'text/html');
  const statuses = [
    { calls: [], responses: [response(404)] },
    { calls: [], responses: [response(403), html] }
  ];
  for (const scenario of statuses) {
    const context = {
      fetch: async (url, init) => {
        scenario.calls.push({ url, init });
        return scenario.responses.shift();
      }
    };
    vm.runInNewContext(htmlFallbackFunction, context);
    const exists = vm.runInNewContext('(' + urlAssetFunction + ')', context);
    assert.equal(await exists('data/loader.js'), false);
  }
  assert.equal(statuses[0].calls.length, 1);
  assert.equal(statuses[1].calls.length, 2);
  assert.equal(html.canceled, true);
});
