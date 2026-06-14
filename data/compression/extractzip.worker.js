(function() {
  var href = self.location.href || '';
  var query = '';
  var queryIndex = href.indexOf('?');
  if (queryIndex !== -1) {
    query = href.substring(queryIndex);
    href = href.substring(0, queryIndex);
  }
  var base = href.substring(0, href.lastIndexOf('/') + 1);
  importScripts(base + 'extractzip.js' + query);
})();
