import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const playerSource = readFileSync(new URL('../player.html', import.meta.url), 'utf8');
const bridgeSource = readFileSync(new URL('../qortium-qortal-bridge.js', import.meta.url), 'utf8');

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

function extractBetween(startMarker, endMarker) {
  const start = indexSource.indexOf(startMarker);
  assert.notEqual(start, -1, `missing "${startMarker}" in index.html`);
  const end = indexSource.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing "${endMarker}" after start marker in index.html`);
  return indexSource.slice(start, end);
}

const developersConstantsSource = extractBetween(
  "var DEVELOPERS_VIEW_PARAM = 'view';",
  'function normalizeDevelopersViewParam(',
);

const developersFunctionNames = [
  'normalizeDevelopersViewParam',
  'normalizeDevelopersSectionId',
  'readDevelopersViewState',
  'buildDevelopersNavigationUrl',
  'commitDevelopersViewState',
  'canonicalizeDevelopersViewParam',
  'scrollToDevelopersSection',
  'copyDevelopersExampleTextFallback',
  'copyDevelopersExampleText',
];

function createHarness(url, overrides = {}) {
  const parsed = new URL(url);
  const writes = [];
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
  const historyState = {
    value: Object.prototype.hasOwnProperty.call(overrides, 'initialHistoryState')
      ? overrides.initialHistoryState
      : null,
  };
  const elements = overrides.elements || new Map();
  const context = {
    URL,
    URLSearchParams,
    Promise,
    console,
    document: {
      getElementById(id) {
        return elements.has(id) ? elements.get(id) : null;
      },
      execCommand: overrides.execCommand,
      createElement: overrides.createElement || (() => ({
        style: {},
        setAttribute() {},
        select() {},
      })),
      body: overrides.body || { appendChild() {}, removeChild() {} },
    },
    window: {
      navigator: overrides.navigator,
      history: {
        get state() {
          return historyState.value;
        },
        pushState(state, _title, next) {
          historyState.value = state;
          writes.push({ mode: 'push', url: String(next), state });
          updateLocation(next);
        },
        replaceState(state, _title, next) {
          historyState.value = state;
          writes.push({ mode: 'replace', url: String(next), state });
          updateLocation(next);
        },
      },
      location,
    },
  };
  vm.createContext(context);
  vm.runInContext(
    `${developersConstantsSource}\n${developersFunctionNames.map(extractFunction).join('\n')}\n` +
      `globalThis.dev = { ${developersFunctionNames.join(', ')} };`,
    context,
  );
  return { context, location, dev: context.dev, writes, elements, historyState };
}

test('normalizeDevelopersViewParam accepts the canonical id and its aliases only', () => {
  const { dev } = createHarness('https://node.example/render/APP/Emulator/Emulator');
  assert.equal(dev.normalizeDevelopersViewParam('developers'), 'developers');
  assert.equal(dev.normalizeDevelopersViewParam('Developers'), 'developers');
  assert.equal(dev.normalizeDevelopersViewParam(' developer '), 'developers');
  assert.equal(dev.normalizeDevelopersViewParam('REFERENCE'), 'developers');
  assert.equal(dev.normalizeDevelopersViewParam('home'), '');
  assert.equal(dev.normalizeDevelopersViewParam(''), '');
  assert.equal(dev.normalizeDevelopersViewParam(null), '');
});

test('normalizeDevelopersSectionId whitelists known ids only', () => {
  const { dev } = createHarness('https://node.example/render/APP/Emulator/Emulator');
  assert.equal(dev.normalizeDevelopersSectionId('bridge-actions'), 'bridge-actions');
  assert.equal(dev.normalizeDevelopersSectionId('Bridge-Actions'), 'bridge-actions');
  assert.equal(dev.normalizeDevelopersSectionId('made-up-section'), '');
  assert.equal(dev.normalizeDevelopersSectionId(''), '');
});

test('readDevelopersViewState resolves the alias, defaults an unknown section, and stays inert without view=', () => {
  const withAlias = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?view=developer&section=bridge-actions',
  );
  assert.deepEqual(JSON.parse(JSON.stringify(withAlias.dev.readDevelopersViewState())), {
    isDevelopers: true,
    sectionId: 'bridge-actions',
  });

  const unknownSection = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?view=reference&section=nonexistent',
  );
  assert.deepEqual(JSON.parse(JSON.stringify(unknownSection.dev.readDevelopersViewState())), {
    isDevelopers: true,
    sectionId: 'overview',
  });

  const noView = createHarness('https://node.example/render/APP/Emulator/Emulator?theme=dark');
  assert.deepEqual(JSON.parse(JSON.stringify(noView.dev.readDevelopersViewState())), { isDevelopers: false, sectionId: '' });
});

test('buildDevelopersNavigationUrl only touches view/section and preserves everything else exactly', () => {
  const { dev } = createHarness(
    'https://node.example/render/APP/Emulator/Emulator/ROM/Alice/game?theme=dark&keywords=a&keywords=b&fileIdentifier=xyz#section-9',
  );

  assert.equal(
    dev.buildDevelopersNavigationUrl({ isDevelopers: true, sectionId: 'overview' }),
    '/render/APP/Emulator/Emulator/ROM/Alice/game?theme=dark&keywords=a&keywords=b&fileIdentifier=xyz&view=developers&section=overview#section-9',
  );

  const closing = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?theme=dark&view=reference&section=bridge-actions&keywords=a#frag',
  );
  assert.equal(
    closing.dev.buildDevelopersNavigationUrl({ isDevelopers: false }),
    '/render/APP/Emulator/Emulator?theme=dark&keywords=a#frag',
  );
});

test('commitDevelopersViewState preserves the exact existing history.state, including primitives and null', () => {
  const nullState = createHarness('https://node.example/render/APP/Emulator/Emulator?theme=dark', {
    initialHistoryState: null,
  });
  nullState.dev.commitDevelopersViewState({ isDevelopers: true, sectionId: 'overview' }, 'push');
  assert.deepEqual(nullState.writes, [
    { mode: 'push', url: '/render/APP/Emulator/Emulator?theme=dark&view=developers&section=overview', state: null },
  ]);
  assert.equal(nullState.historyState.value, null);

  const primitiveState = createHarness('https://node.example/render/APP/Emulator/Emulator?theme=dark', {
    initialHistoryState: 42,
  });
  primitiveState.dev.commitDevelopersViewState({ isDevelopers: true, sectionId: 'overview' }, 'push');
  assert.equal(primitiveState.writes[0].state, 42);
  assert.equal(primitiveState.historyState.value, 42);

  const objectState = { fromHost: true };
  const objectHarness = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?theme=dark&view=developers&section=overview',
    { initialHistoryState: objectState },
  );
  objectHarness.dev.commitDevelopersViewState({ isDevelopers: false }, 'replace');
  assert.equal(objectHarness.writes[0].mode, 'replace');
  assert.equal(objectHarness.writes[0].state, objectState);
});

test('commitDevelopersViewState is a no-op when the target URL already matches', () => {
  const { dev, writes } = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?theme=dark&view=developers&section=overview',
  );
  dev.commitDevelopersViewState({ isDevelopers: true, sectionId: 'overview' }, 'push');
  assert.deepEqual(writes, []);
});

test('canonicalizeDevelopersViewParam rewrites aliases via replaceState and preserves other params/hash/state', () => {
  const objectState = { fromHost: 7 };
  const { dev, writes, location, historyState } = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?theme=dark&view=Reference#kept',
    { initialHistoryState: objectState },
  );
  const changed = dev.canonicalizeDevelopersViewParam();
  assert.equal(changed, true);
  assert.deepEqual(writes, [
    { mode: 'replace', url: '/render/APP/Emulator/Emulator?theme=dark&view=developers#kept', state: objectState },
  ]);
  assert.equal(location.search, '?theme=dark&view=developers');
  assert.equal(location.hash, '#kept');
  assert.equal(historyState.value, objectState);
});

test('canonicalizeDevelopersViewParam normalizes an invalid or mixed-case section only when Developers is active', () => {
  const invalid = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?view=developers&section=not-a-section#kept',
  );
  assert.equal(invalid.dev.canonicalizeDevelopersViewParam(), true);
  assert.equal(invalid.location.search, '?view=developers&section=overview');
  assert.equal(invalid.location.hash, '#kept');

  const mixedCase = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?view=reference&section=Bridge-Actions',
  );
  assert.equal(mixedCase.dev.canonicalizeDevelopersViewParam(), true);
  assert.equal(mixedCase.location.search, '?view=developers&section=bridge-actions');

  const inert = createHarness(
    'https://node.example/render/APP/Emulator/Emulator?section=not-a-section',
  );
  assert.equal(inert.dev.canonicalizeDevelopersViewParam(), false);
  assert.deepEqual(inert.writes, []);
});

test('canonicalizeDevelopersViewParam is a no-op when already canonical or absent', () => {
  const canonical = createHarness('https://node.example/render/APP/Emulator/Emulator?view=developers');
  assert.equal(canonical.dev.canonicalizeDevelopersViewParam(), false);
  assert.deepEqual(canonical.writes, []);

  const absent = createHarness('https://node.example/render/APP/Emulator/Emulator?theme=dark');
  assert.equal(absent.dev.canonicalizeDevelopersViewParam(), false);
  assert.deepEqual(absent.writes, []);
});

test('scrollToDevelopersSection only scrolls the reference container, never the whole document', () => {
  assert.doesNotMatch(extractFunction('scrollToDevelopersSection'), /scrollIntoView/);

  const container = { offsetTop: 100, scrollTop: 0, contains: (node) => node === target };
  const target = { offsetTop: 500 };
  const elements = new Map([
    ['developersReferenceContainer', container],
    ['dev-section-overview', target],
  ]);
  const { dev } = createHarness('https://node.example/render/APP/Emulator/Emulator', { elements });

  assert.equal(dev.scrollToDevelopersSection('not-a-real-section'), false);
  assert.equal(container.scrollTop, 0);

  assert.equal(dev.scrollToDevelopersSection('overview'), true);
  assert.equal(container.scrollTop, 400);
});

test('scrollToDevelopersSection requires containment and returns false when either element is missing', () => {
  const strayTarget = { offsetTop: 10 };
  const container = { offsetTop: 0, scrollTop: 0, contains: () => false };
  const elements = new Map([
    ['developersReferenceContainer', container],
    ['dev-section-overview', strayTarget],
  ]);
  const { dev } = createHarness('https://node.example/render/APP/Emulator/Emulator', { elements });
  assert.equal(dev.scrollToDevelopersSection('overview'), false);
  assert.equal(container.scrollTop, 0);
});

test('copyDevelopersExampleTextFallback uses a hidden textarea and execCommand, reporting the real result', () => {
  const appended = [];
  const removed = [];
  const textarea = { style: {}, setAttribute() {}, select() {}, value: '' };
  const succeeding = createHarness('https://node.example/render/APP/Emulator/Emulator', {
    createElement: () => textarea,
    body: { appendChild: (el) => appended.push(el), removeChild: (el) => removed.push(el) },
    execCommand: () => true,
  });
  assert.equal(succeeding.dev.copyDevelopersExampleTextFallback('example text'), true);
  assert.equal(textarea.value, 'example text');
  assert.deepEqual(appended, [textarea]);
  assert.deepEqual(removed, [textarea]);

  const failing = createHarness('https://node.example/render/APP/Emulator/Emulator', {
    createElement: () => ({ style: {}, setAttribute() {}, select() {} }),
    body: { appendChild() {}, removeChild() {} },
    execCommand: () => {
      throw new Error('denied');
    },
  });
  assert.equal(failing.dev.copyDevelopersExampleTextFallback('example text'), false);
});

test('copyDevelopersExampleText prefers the Clipboard API and only falls back when it is unavailable or fails', async () => {
  let fallbackExecCommandCalls = 0;
  const withClipboard = createHarness('https://node.example/render/APP/Emulator/Emulator', {
    navigator: { clipboard: { writeText: async () => {} } },
    execCommand: () => {
      fallbackExecCommandCalls += 1;
      return true;
    },
  });
  const succeeded = await withClipboard.dev.copyDevelopersExampleText('hello');
  assert.equal(succeeded, true);
  assert.equal(fallbackExecCommandCalls, 0);

  const rejectingClipboard = createHarness('https://node.example/render/APP/Emulator/Emulator', {
    navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } },
    execCommand: () => true,
  });
  assert.equal(await rejectingClipboard.dev.copyDevelopersExampleText('hello'), true);

  const noClipboard = createHarness('https://node.example/render/APP/Emulator/Emulator', {
    navigator: {},
    execCommand: () => false,
  });
  assert.equal(await noClipboard.dev.copyDevelopersExampleText('hello'), false);
});

test('the TOC and workspace toggle preserve modifier-click semantics instead of always intercepting', () => {
  const tocSource = extractFunction('bindDevelopersTocLink');
  assert.match(tocSource, /metaKey/);
  assert.match(tocSource, /ctrlKey/);
  const workspaceSource = extractFunction('bindDevelopersWorkspace');
  assert.match(workspaceSource, /developersButton/);
  assert.match(workspaceSource, /developersCloseButton/);
});

test('setVisiblePage stays a pure cosmetic toggle and never touches the player frame', () => {
  const source = extractFunction('setVisiblePage');
  assert.doesNotMatch(source, /gameFrame/);
  assert.doesNotMatch(source, /\.src\s*=/);
  assert.match(source, /developers/);
});

test('the developers workspace layers onto the single popstate path without a second listener', () => {
  const popstateOccurrences = indexSource.match(/addEventListener\('popstate'/g) || [];
  assert.equal(popstateOccurrences.length, 1);
  assert.doesNotMatch(indexSource, /addEventListener\('hashchange'/);
  assert.match(indexSource, /handleRouteNavigationChange\(\)\.then\(function\(\) \{/);
  assert.match(indexSource, /renderDevelopersSection\(developersViewState\.sectionId\)/);
});

test('clearQdnesRouteSearchParams reads the shared deep-link query key list instead of duplicating literals', () => {
  const source = extractFunction('clearQdnesRouteSearchParams');
  assert.match(source, /DEEP_LINK_ROUTE_QUERY_KEYS/);
  assert.doesNotMatch(source, /'filePublisher'/);
});

test('the display-settings schema exposed for documentation is derived from the live appearance arrays, not a duplicate', () => {
  assert.match(
    indexSource,
    /window\.__qdnesDisplaySettingsSchema = \{\s*themes: THEMES,\s*textSizes: SIZES,\s*accents: ACCENTS,\s*uiStyles: UI_STYLES\s*\};/,
  );
});

test('the documentation list renderer reads live constants/bridge exports instead of hardcoding them', () => {
  const source = extractFunction('renderDevelopersDocumentationLists');
  assert.match(source, /bridge\.ACTIONS/);
  assert.match(source, /bridge\.SEARCH_QUERY_FIELDS/);
  assert.match(source, /getDevelopersDisplaySettingsSchema\(\)/);
  assert.doesNotMatch(source, /SEARCH_QORTAL_RESOURCES/);
});

test('appearance UI styles include fun in the launcher, the player, and their stylesheets', () => {
  assert.match(indexSource, /var UI_STYLES = \['classic', 'modern', 'fun'\];/);
  assert.match(playerSource, /var UI_STYLES = \['classic', 'modern', 'fun'\];/);
  assert.match(indexSource, /:root\[data-ui='fun'\]/);
  assert.match(playerSource, /:root\[data-ui='fun'\]/);
});

test('the Developers overlay suppresses deep-link bootstrap while it owns the initial view', () => {
  const startAppSource = indexSource.slice(indexSource.indexOf('async function startApp()'));
  assert.match(startAppSource, /var bootDevelopersViewState = readDevelopersViewState\(\)/);
  assert.match(startAppSource, /!bootDevelopersViewState\.isDevelopers && initialRoute\.kind === 'deep-link'/);
  assert.match(indexSource, /if \(readDevelopersViewState\(\)\.isDevelopers\) \{/);
  assert.match(indexSource, /canonicalizeDevelopersViewParam\(\);/);
});

test('cosmetic display delivery accepts desktop self, native null and parent but rejects unrelated frames', () => {
  for (const source of [indexSource, playerSource]) {
    const start = source.indexOf('function isTrustedDisplaySettingsEvent(');
    const end = source.indexOf('\n        }', start) + 10;
    const win = { parent: {} };
    const accepts = vm.runInNewContext('(' + source.slice(start, end) + ')', { window: win });
    assert.equal(accepts(null), false);
    assert.equal(accepts({ source: null }), true);
    assert.equal(accepts({ source: win }), true);
    assert.equal(accepts({ source: win.parent }), true);
    assert.equal(accepts({ source: {} }), false);
    win.parent = win;
    assert.equal(accepts({ source: win }), true);
  }
});

test('copy examples expose live success and failure feedback', () => {
  assert.match(indexSource, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(indexSource, /data-copy-state/);
  assert.match(indexSource, /Copy failed/);
});

test('the bridge exports its action names and search fields once, and the four calls reuse them', () => {
  assert.match(bridgeSource, /var BRIDGE_ACTIONS = \{/);
  assert.doesNotMatch(bridgeSource, /requestBridge\('SEARCH_QORTAL_RESOURCES'/);
  assert.match(bridgeSource, /requestBridge\(BRIDGE_ACTIONS\.generic\.search, BRIDGE_ACTIONS\.legacy\.search/);
  assert.match(bridgeSource, /ACTIONS: BRIDGE_ACTIONS/);
  assert.match(bridgeSource, /SEARCH_QUERY_FIELDS: SEARCH_RESOURCE_QUERY_FIELDS/);
});

test('the Developers workspace body is always English/LTR regardless of the active Home language', () => {
  assert.match(indexSource, /<section class="developers-page"[^>]*lang="en"[^>]*dir="ltr"/);
});

test('the Developers reference container whitelists TOC ids via getElementById and containment', () => {
  const source = extractFunction('scrollToDevelopersSection');
  assert.match(source, /normalizeDevelopersSectionId/);
  assert.match(source, /getElementById/);
  assert.match(source, /container\.contains\(target\)/);
});

test('inert metadata example is accepted by the actual NES ROM reference filter', () => {
  const start = indexSource.indexOf('var DEVELOPERS_METADATA_EXAMPLE =');
  const end = indexSource.indexOf('\n      var gameFrame', start);
  const context = vm.createContext({ getActiveSystemConfig: () => ({ localExtensions: ['nes'] }) });
  vm.runInContext(indexSource.slice(start, end) + '\n' +
    ['getFileReferenceExtension', 'isSystemFileReference', 'extractRomFiles'].map(extractFunction).join('\n'), context);
  const files = vm.runInContext('extractRomFiles(DEVELOPERS_METADATA_EXAMPLE)', context);
  assert.equal(files.length, 1);
  assert.equal(files[0].identifier, 'example-game.nes');
  assert.equal(files[0].isHeader, true);
});
