import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function extractFunction(name) {
  const marker = `      function ${name}(`;
  const start = indexSource.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}() in index.html`);
  const bodyStart = indexSource.indexOf('{', start + marker.length);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = bodyStart; index < indexSource.length; index += 1) {
    const character = indexSource[index];
    const next = indexSource[index + 1];
    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = '';
      }
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
    } else if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
    } else if (character === "'" || character === '"' || character === '`') {
      quote = character;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return indexSource.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}() in index.html`);
}

const routeFunctionNames = [
  'safeDecodeRouteSegment',
  'normalizeQdnBasePath',
  'getEncodedQdnBasePath',
  'normalizeAppRelativePath',
  'getCurrentAppRelativePath',
  'normalizeDeepLinkRouteType',
  'parseDeepLinkRoutePath',
  'normalizeSystemId',
  'readHashRouteState',
  'readQdnesRouteState',
  'setStoredQdnesRouteState',
  'clearQdnesRouteSearchParams',
  'buildQdnesUrlFromRouteState',
  'commitQdnesRouteState',
  'getSystemConfig',
  'getDeepLinkRouteIdentity',
  'isCurrentRunningDeepLinkRoute',
  'restoreCurrentRunningDeepLinkRoute',
];

function createHarness(url, overrides = {}) {
  const parsed = new URL(url);
  const writes = [];
  let currentHistoryState = Object.prototype.hasOwnProperty.call(overrides, 'initialHistoryState')
    ? overrides.initialHistoryState
    : null;
  const location = {
    hash: parsed.hash,
    href: parsed.href,
    pathname: parsed.pathname,
    protocol: parsed.protocol,
    search: parsed.search,
  };
  const updateLocation = (next) => {
    const updated = new URL(next, parsed.origin);
    location.hash = updated.hash;
    location.href = updated.href;
    location.pathname = updated.pathname;
    location.search = updated.search;
  };
  const context = {
    URL,
    URLSearchParams,
    console,
    document: { querySelector: () => null },
    SYSTEM_CONFIGS: {
      nes: { defaultCore: 'fceumm' },
      snes: { defaultCore: 'snes9x' },
    },
    DEEP_LINK_ROUTE_QUERY_KEYS: ['fileIdentifier', 'filePublisher', 'core'],
    activeGameUrl: '',
    activeSystemId: 'nes',
    currentQdnSelection: null,
    setActiveSystem() {},
    setSelectedCore() { return true; },
    setVisiblePage() {},
    updateCoreUi() {},
    window: {
      history: {
        get state() {
          return currentHistoryState;
        },
        pushState(_state, _title, next) {
          currentHistoryState = _state;
          writes.push({ mode: 'push', url: String(next) });
          updateLocation(next);
        },
        replaceState(_state, _title, next) {
          currentHistoryState = _state;
          writes.push({ mode: 'replace', url: String(next) });
          updateLocation(next);
        },
      },
      location,
      ...overrides,
    },
  };
  vm.createContext(context);
  vm.runInContext(
    `${routeFunctionNames.map(extractFunction).join('\n')}\n` +
      `globalThis.routes = { ${routeFunctionNames.join(', ')} };`,
    context,
  );
  return {
    context,
    location,
    routes: context.routes,
    writes,
    get historyState() {
      return currentHistoryState;
    },
  };
}

test('reads the live QDN path instead of a stale injected startup path', () => {
  const { routes } = createHarness(
    'https://node.example/render/APP/Emulator/Emulator/ROM/New%20Publisher/new-id',
    {
      _qdnBase: '/render/APP/Emulator/Emulator/',
      _qdnPath: 'ROM/Old%20Publisher/old-id',
    },
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(routes.readQdnesRouteState())),
    {
      kind: 'deep-link',
      routeType: 'ROM',
      metadataName: 'New Publisher',
      metadataIdentifier: 'new-id',
      systemId: 'nes',
      filePublisher: '',
      fileIdentifier: '',
      core: '',
    },
  );
});

test('deep-link codec preserves host query keys and unknown fragments', () => {
  const { routes } = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?qdnHomeBridge=token&theme=dark&future=kept&fileIdentifier=old&core=old#section-4',
    { _qdnBase: '/render/APP/Emulator/Emulator/' },
  );

  assert.equal(
    routes.buildQdnesUrlFromRouteState({
      kind: 'deep-link',
      routeType: 'Mod',
      metadataName: 'Alice Smith',
      metadataIdentifier: 'game/id',
      filePublisher: 'Publisher',
      fileIdentifier: 'file-id',
      core: 'mesen',
      systemId: 'nes',
    }),
    '/render/APP/Emulator/Emulator/Mod/Alice%20Smith/game%2Fid?qdnHomeBridge=token&theme=dark&future=kept&fileIdentifier=file-id&filePublisher=Publisher&core=mesen#section-4',
  );
});

test('home and system routes use their app-owned fragments', () => {
  const { routes } = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?theme=dark#section-4',
    { _qdnBase: '/render/APP/Emulator/Emulator/' },
  );

  assert.equal(
    routes.buildQdnesUrlFromRouteState({ kind: 'system', systemId: 'snes' }),
    '/render/APP/Emulator/Emulator/?theme=dark#snes',
  );
  assert.equal(
    routes.buildQdnesUrlFromRouteState({ kind: 'home', systemId: 'home' }),
    '/render/APP/Emulator/Emulator/?theme=dark#home',
  );
});

test('route commits push, replace, deduplicate, and never write during traversal', () => {
  const { routes, writes } = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?theme=dark#home',
    { _qdnBase: '/render/APP/Emulator/Emulator/' },
  );

  routes.commitQdnesRouteState({ kind: 'system', systemId: 'nes' }, 'push');
  routes.commitQdnesRouteState({ kind: 'system', systemId: 'nes' }, 'push');
  routes.commitQdnesRouteState({ kind: 'system', systemId: 'snes' }, 'replace');
  routes.commitQdnesRouteState({ kind: 'home', systemId: 'home' }, 'none');

  assert.deepEqual(writes, [
    { mode: 'push', url: '/render/APP/Emulator/Emulator/?theme=dark#nes' },
    { mode: 'replace', url: '/render/APP/Emulator/Emulator/?theme=dark#snes' },
  ]);
});

test('route commits preserve the embedding host history.state sentinel', () => {
  const harness = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?theme=dark#home',
    { _qdnBase: '/render/APP/Emulator/Emulator/', initialHistoryState: { host: 'sentinel' } },
  );

  harness.routes.commitQdnesRouteState({ kind: 'system', systemId: 'nes' }, 'push');
  assert.deepEqual(harness.historyState, { host: 'sentinel' });
});

test('the running-game guard matches the exact deep-link file and core identity', () => {
  const { context, routes } = createHarness(
    'https://node.example/render/APP/Emulator/Emulator/ROM/Alice/game?fileIdentifier=file-1&filePublisher=Alice&core=mesen',
    { _qdnBase: '/render/APP/Emulator/Emulator/' },
  );
  context.activeGameUrl = 'blob:running-game';
  context.currentQdnSelection = {
    routeType: 'ROM',
    metadataName: 'Alice',
    metadataIdentifier: 'game',
    filePublisher: 'Alice',
    fileIdentifier: 'file-1',
    core: 'mesen',
    systemId: 'nes',
  };

  const current = {
    kind: 'deep-link',
    routeType: 'ROM',
    metadataName: 'Alice',
    metadataIdentifier: 'game',
    filePublisher: 'Alice',
    fileIdentifier: 'file-1',
    core: 'mesen',
    systemId: 'nes',
  };
  assert.equal(routes.isCurrentRunningDeepLinkRoute(current), true);
  assert.equal(routes.isCurrentRunningDeepLinkRoute({ ...current, fileIdentifier: 'file-2' }), false);
  assert.equal(routes.isCurrentRunningDeepLinkRoute({ ...current, core: 'fceumm' }), false);
});

test('restoring the exact running route does not reset the active system or player', () => {
  const { context, routes } = createHarness(
    'https://node.example/render/APP/Emulator/Emulator/ROM/Alice/game',
    { _qdnBase: '/render/APP/Emulator/Emulator/' },
  );
  const calls = [];
  context.activeSystemId = 'nes';
  context.currentQdnSelection = { systemId: 'nes' };
  context.setActiveSystem = (...args) => calls.push(['setActiveSystem', ...args]);
  context.setVisiblePage = (...args) => calls.push(['setVisiblePage', ...args]);
  context.setSelectedCore = (...args) => {
    calls.push(['setSelectedCore', ...args]);
    return true;
  };
  context.updateCoreUi = () => calls.push(['updateCoreUi']);

  routes.restoreCurrentRunningDeepLinkRoute({
    kind: 'deep-link',
    routeType: 'ROM',
    metadataName: 'Alice',
    metadataIdentifier: 'game',
    systemId: 'nes',
  });

  assert.deepEqual(calls, [
    ['setVisiblePage', 'systems'],
    ['setSelectedCore', 'fceumm'],
    ['updateCoreUi'],
  ]);
});

test('the app binds one popstate rehydration path without a duplicate hashchange path', () => {
  assert.match(indexSource, /addEventListener\('popstate'/);
  assert.doesNotMatch(indexSource, /addEventListener\('hashchange'/);
  assert.match(indexSource, /bootstrapDeepLinkRoute\(routeState, 'none'/);
});
