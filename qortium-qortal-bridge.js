(function () {
  var DEFAULT_QORTAL_API_URL = 'https://ext-node.qortal.link';

  var BRIDGE_ACTIONS = {
    generic: {
      search: 'SEARCH_QDN_RESOURCES',
      status: 'GET_QDN_RESOURCE_STATUS',
      fetch: 'FETCH_QDN_RESOURCE',
      url: 'GET_QDN_RESOURCE_URL'
    },
    legacy: {
      search: 'SEARCH_QORTAL_RESOURCES',
      status: 'GET_QORTAL_RESOURCE_STATUS',
      fetch: 'FETCH_QORTAL_RESOURCE',
      url: 'GET_QORTAL_RESOURCE_URL'
    }
  };

  var SEARCH_RESOURCE_QUERY_FIELDS = {
    default: 'default',
    description: 'description',
    exactMatchNames: 'exactmatchnames',
    excludeBlocked: 'excludeblocked',
    followedOnly: 'followedonly',
    identifier: 'identifier',
    includeMetadata: 'includemetadata',
    includeStatus: 'includestatus',
    keywords: 'keywords',
    limit: 'limit',
    mode: 'mode',
    name: 'name',
    nameListFilter: 'namefilter',
    names: 'name',
    offset: 'offset',
    prefix: 'prefix',
    query: 'query',
    reverse: 'reverse',
    service: 'service',
    title: 'title'
  };

  function getQortalApiBaseUrl() {
    var configured = '';
    if (typeof window.EMULATOR_QORTAL_API_URL === 'string') {
      configured = window.EMULATOR_QORTAL_API_URL;
    }
    if (!configured && typeof window.QORTIUM_EMULATOR_QORTAL_API_URL === 'string') {
      configured = window.QORTIUM_EMULATOR_QORTAL_API_URL;
    }
    return (configured || DEFAULT_QORTAL_API_URL).replace(/\/+$/, '');
  }

  function getQortalRequest() {
    if (typeof window.qortalRequest === 'function') {
      return window.qortalRequest;
    }
    try {
      if (window.parent && typeof window.parent.qortalRequest === 'function') {
        return window.parent.qortalRequest;
      }
    } catch (error) {
      // Ignore cross-origin access errors.
    }
    try {
      if (window.top && typeof window.top.qortalRequest === 'function') {
        return window.top.qortalRequest;
      }
    } catch (error) {
      // Ignore cross-origin access errors.
    }
    return null;
  }

  function getQdnRequest() {
    if (typeof window.qdnRequest === 'function') {
      return window.qdnRequest;
    }
    try {
      if (window.parent && typeof window.parent.qdnRequest === 'function') {
        return window.parent.qdnRequest;
      }
    } catch (error) {
      // Ignore cross-origin access errors.
    }
    try {
      if (window.top && typeof window.top.qdnRequest === 'function') {
        return window.top.qdnRequest;
      }
    } catch (error) {
      // Ignore cross-origin access errors.
    }
    return null;
  }

  function normalizePath(path) {
    var raw = typeof path === 'string' ? path : '';
    return raw.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  }

  function appendResourceQuery(url, request) {
    var path = normalizePath(request.path || request.filepath);
    if (path) {
      url.searchParams.set('filepath', path);
    }
    ['encoding', 'rebuild', 'async', 'attachment'].forEach(function (key) {
      var value = request[key];
      if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  function buildResourcePath(request) {
    var service = encodeURIComponent(String(request.service || ''));
    var name = encodeURIComponent(String(request.name || ''));
    var identifier = request.identifier ? '/' + encodeURIComponent(String(request.identifier)) : '';
    var url = new URL('/arbitrary/' + service + '/' + name + identifier, getQortalApiBaseUrl());
    appendResourceQuery(url, request);
    return url.pathname + url.search;
  }

  function buildStatusPath(request) {
    var service = encodeURIComponent(String(request.service || ''));
    var name = encodeURIComponent(String(request.name || ''));
    var identifier = request.identifier ? '/' + encodeURIComponent(String(request.identifier)) : '';
    var url = new URL('/arbitrary/resource/status/' + service + '/' + name + identifier, getQortalApiBaseUrl());
    if (typeof request.build !== 'undefined') {
      url.searchParams.set('build', String(Boolean(request.build)));
    }
    return url.pathname + url.search;
  }

  function appendSearchValue(queryParams, key, value) {
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        appendSearchValue(queryParams, key, item);
      });
      return;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      queryParams.append(key, String(value));
      return;
    }
    if (typeof value === 'string' && value.trim()) {
      queryParams.append(key, value.trim());
    }
  }

  function buildSearchPath(request) {
    var queryParams = new URLSearchParams();

    Object.keys(SEARCH_RESOURCE_QUERY_FIELDS).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(request, key)) {
        appendSearchValue(queryParams, SEARCH_RESOURCE_QUERY_FIELDS[key], request[key]);
      }
    });

    return '/arbitrary/resources/search?' + queryParams.toString();
  }

  async function requestBridge(genericAction, legacyAction, payload) {
    var qortalRequest = getQortalRequest();
    if (qortalRequest) {
      return {
        present: true,
        result: await qortalRequest(Object.assign({ action: genericAction }, payload || {}))
      };
    }
    var qdnRequest = getQdnRequest();
    if (qdnRequest) {
      return {
        present: true,
        result: await qdnRequest(Object.assign({ action: legacyAction }, payload || {}))
      };
    }
    return { present: false, result: null };
  }

  async function fetchJson(path) {
    var response = await fetch(getQortalApiBaseUrl() + path, {
      headers: { accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error('Qortal node request failed with HTTP ' + response.status + '.');
    }
    return response.json();
  }

  async function fetchText(path) {
    var response = await fetch(getQortalApiBaseUrl() + path);
    if (!response.ok) {
      throw new Error('Qortal resource request failed with HTTP ' + response.status + '.');
    }
    return response.text();
  }

  function readUrlResult(result) {
    if (typeof result === 'string') {
      return result;
    }
    if (result && typeof result.url === 'string') {
      return result.url;
    }
    if (result && typeof result.href === 'string') {
      return result.href;
    }
    return '';
  }

  function readResourceContent(result) {
    if (typeof result === 'string') {
      return result;
    }
    if (result && typeof result.content === 'string') {
      return result.content;
    }
    if (result && typeof result.body === 'string') {
      return result.body;
    }
    if (result && typeof result.data === 'string') {
      return result.data;
    }
    return '';
  }

  async function searchResources(request) {
    var bridge = await requestBridge(BRIDGE_ACTIONS.generic.search, BRIDGE_ACTIONS.legacy.search, request);
    if (bridge.present) {
      return bridge.result;
    }
    return fetchJson(buildSearchPath(request || {}));
  }

  async function getResourceStatus(request) {
    var bridge = await requestBridge(BRIDGE_ACTIONS.generic.status, BRIDGE_ACTIONS.legacy.status, request);
    if (bridge.present) {
      return bridge.result;
    }
    return fetchJson(buildStatusPath(request || {}));
  }

  async function fetchResource(request) {
    var bridge = await requestBridge(BRIDGE_ACTIONS.generic.fetch, BRIDGE_ACTIONS.legacy.fetch, request);
    if (bridge.present) {
      return bridge.result;
    }
    return fetchText(buildResourcePath(request || {}));
  }

  async function fetchResourceContent(request) {
    var result = await fetchResource(request || {});
    var content = readResourceContent(result);
    if (!content) {
      throw new Error('Qortal resource response did not include content.');
    }
    return content;
  }

  async function getResourceUrl(request) {
    var bridge = await requestBridge(BRIDGE_ACTIONS.generic.url, BRIDGE_ACTIONS.legacy.url, request);
    if (!bridge.present) {
      return getQortalApiBaseUrl() + buildResourcePath(request || {});
    }
    var url = readUrlResult(bridge.result);
    if (url) {
      return url;
    }
    throw new Error('Qortal resource bridge returned an invalid URL.');
  }

  window.qortiumQortal = {
    ACTIONS: BRIDGE_ACTIONS,
    DEFAULT_QORTAL_API_URL: DEFAULT_QORTAL_API_URL,
    SEARCH_QUERY_FIELDS: SEARCH_RESOURCE_QUERY_FIELDS,
    fetchResource: fetchResource,
    fetchResourceContent: fetchResourceContent,
    getApiBaseUrl: getQortalApiBaseUrl,
    getResourceStatus: getResourceStatus,
    getResourceUrl: getResourceUrl,
    searchResources: searchResources
  };
})();
