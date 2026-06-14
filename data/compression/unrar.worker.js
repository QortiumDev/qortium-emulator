(function() {
  var href = self.location.href || '';
  var query = '';
  var queryIndex = href.indexOf('?');
  if (queryIndex !== -1) {
    query = href.substring(queryIndex);
    href = href.substring(0, queryIndex);
  }
  var base = href.substring(0, href.lastIndexOf('/') + 1);
  var wasmPath = base + 'libunrar.wasm' + query;
  var dataToPass = [];

  self.Module = {
    monitorRunDependencies: function(left) {
      if (left === 0) {
        setTimeout(function() {
          unrar(dataToPass, null);
        }, 100);
      }
    },
    onRuntimeInitialized: function() {},
    locateFile: function(file) {
      return wasmPath;
    }
  };

  importScripts(base + 'libunrar.js' + query);

  function unrar(data, password) {
    var cb = function(fileName, fileSize, progress) {
      postMessage({ "t": 4, "current": progress, "total": fileSize, "name": fileName });
    };
    var rarContent = readRARContent(data.map(function(entry) {
      return {
        name: entry.name,
        content: new Uint8Array(entry.content)
      };
    }), password, cb);
    var rec = function(entry) {
      if (!entry) {
        return;
      }
      if (entry.type === "file") {
        postMessage({ "t": 2, "file": entry.fullFileName, "size": entry.fileSize, "data": entry.fileContent });
      } else if (entry.type === "dir") {
        Object.keys(entry.ls).forEach(function(key) {
          rec(entry.ls[key]);
        });
      } else {
        throw "Unknown type";
      }
    };
    rec(rarContent);
    postMessage({ "t": 1 });
    return rarContent;
  }

  onmessage = function(event) {
    dataToPass.push({ name: "test.rar", content: event.data });
  };
})();
