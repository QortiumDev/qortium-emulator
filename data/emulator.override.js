(function() {
  if (!window.EJS_COMPRESSION) {
    return;
  }

  var proto = window.EJS_COMPRESSION.prototype;
  var originalDecompressFile = proto.decompressFile;

  function resolveWorkerPath(instance, path) {
    var fileName = path.split('/').pop();
    if (instance && instance.EJS && instance.EJS.config && instance.EJS.config.filePaths) {
      var mapped = instance.EJS.config.filePaths[fileName];
      if (typeof mapped === 'string') {
        return mapped;
      }
    }
    var base = '';
    if (instance && instance.EJS && instance.EJS.config && typeof instance.EJS.config.dataPath === 'string') {
      base = instance.EJS.config.dataPath;
    }
    if (base && !base.endsWith('/')) {
      base += '/';
    }
    return base + path;
  }

  proto.decompressFile = function(method, data, updateMsg, fileCbFunc) {
    var workerPath = null;
    if (method === '7z') {
      workerPath = 'compression/extract7z.worker.js';
    } else if (method === 'zip') {
      workerPath = 'compression/extractzip.worker.js';
    } else if (method === 'rar') {
      workerPath = 'compression/unrar.worker.js';
    }

    if (!workerPath) {
      return originalDecompressFile.call(this, method, data, updateMsg, fileCbFunc);
    }

    var workerUrl = resolveWorkerPath(this, workerPath);
    return new Promise(function(resolve) {
      var worker = null;
      var files = {};
      var settled = false;
      var watchdogTimer = 0;
      var workerTimeoutMs = 60000;

      function armWatchdog() {
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
        }
        watchdogTimer = setTimeout(function() {
          fallback.call(this, 'timeout', null);
        }.bind(this), workerTimeoutMs);
      }

      function cleanup() {
        if (watchdogTimer) {
          clearTimeout(watchdogTimer);
          watchdogTimer = 0;
        }
        if (worker) {
          worker.onmessage = null;
          worker.onerror = null;
          if (typeof worker.onmessageerror !== 'undefined') {
            worker.onmessageerror = null;
          }
          try {
            worker.terminate();
          } catch (terminateError) {
            // Ignore termination errors.
          }
          worker = null;
        }
      }

      function finish(value) {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      }

      function fallback(reason, error) {
        if (settled) {
          return;
        }
        try {
          if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn('Emulator compression worker fallback (' + reason + '):', error || '(no details)');
          }
        } catch (warnError) {
          // Ignore logging errors.
        }
        try {
          finish(originalDecompressFile.call(this, method, data, updateMsg, fileCbFunc));
        } catch (fallbackError) {
          finish({});
        }
      }

      try {
        worker = new Worker(workerUrl);
      } catch (err) {
        fallback.call(this, 'create-failed', err);
        return;
      }

      armWatchdog.call(this);

      worker.onmessage = function(event) {
        armWatchdog.call(this);
        if (!event.data) {
          return;
        }
        if (event.data.t === 4) {
          var pg = event.data;
          var num = Math.floor(pg.current / pg.total * 100);
          if (!isNaN(num) && typeof updateMsg === 'function') {
            var progress = ' ' + num.toString() + '%';
            updateMsg(progress, true);
          }
        }
        if (event.data.t === 2) {
          if (typeof fileCbFunc === 'function') {
            fileCbFunc(event.data.file, event.data.data);
            files[event.data.file] = true;
          } else {
            files[event.data.file] = event.data.data;
          }
        }
        if (event.data.t === 1) {
          finish(files);
        }
      };

      worker.onerror = function(event) {
        fallback.call(this, 'worker-error', event);
      }.bind(this);

      if (typeof worker.onmessageerror !== 'undefined') {
        worker.onmessageerror = function(event) {
          fallback.call(this, 'message-error', event);
        }.bind(this);
      }

      try {
        worker.postMessage(data);
      } catch (postError) {
        fallback.call(this, 'post-failed', postError);
      }
    }.bind(this));
  };

  if (window.EmulatorJS && window.EmulatorJS.prototype) {
    var emulatorProto = window.EmulatorJS.prototype;
    var originalInitGameCore = emulatorProto.initGameCore;
    var originalGetBaseFileName = typeof emulatorProto.getBaseFileName === 'function'
      ? emulatorProto.getBaseFileName
      : null;

    function copyBinary(value) {
      if (value instanceof Uint8Array) {
        return value.slice(0);
      }
      if (value instanceof ArrayBuffer) {
        return value.slice(0);
      }
      return value || null;
    }

    emulatorProto.initGameCore = function(js, wasm, thread) {
      this.__qdnesCoreBundle = {
        wasm: copyBinary(wasm),
        thread: copyBinary(thread)
      };
      if (!js || !wasm) {
        console.warn('Emulator core bootstrap received missing JS/WASM payload.', {
          hasJs: Boolean(js),
          hasWasm: Boolean(wasm)
        });
      }
      // Keep Emulator blob-free core bootstrap (works reliably with QDN app CSP).
      if (js && (js instanceof Uint8Array || js instanceof ArrayBuffer)) {
        var decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
        var jsText = '';
        if (decoder) {
          jsText = decoder.decode(js instanceof Uint8Array ? js : new Uint8Array(js));
        } else {
          var bytes = js instanceof Uint8Array ? js : new Uint8Array(js);
          for (var i = 0; i < bytes.length; i++) {
            jsText += String.fromCharCode(bytes[i]);
          }
        }
        var script = document.createElement('script');
        script.textContent = jsText;
        document.body.appendChild(script);
        this.initModule(wasm, thread);
        return;
      }
      originalInitGameCore.call(this, js, wasm, thread);
    };

    if (originalGetBaseFileName) {
      emulatorProto.getBaseFileName = function(forceFromConfig) {
        if (forceFromConfig && this && this.config) {
          var gameName = typeof this.config.gameName === 'string' ? this.config.gameName : '';
          var gameUrl = typeof this.config.gameUrl === 'string' ? this.config.gameUrl : '';
          if (gameName && gameUrl && gameUrl !== 'game') {
            var invalidChars = /[#<$+%>!`&*'|{}\/\\?"=@:^\r\n]/gi;
            var normalizedGameName = gameName.replace(invalidChars, '').trim();
            var gameNameHasExtension = normalizedGameName.lastIndexOf('.') > 0;
            var gameUrlBase = gameUrl.split('/').pop().split('#')[0].split('?')[0];
            var gameUrlHasExtension = gameUrlBase.lastIndexOf('.') > 0;
            if (gameNameHasExtension && !gameUrlHasExtension) {
              return normalizedGameName;
            }
          }
        }
        return originalGetBaseFileName.call(this, forceFromConfig);
      };
    }

    emulatorProto.qdnesReloadGame = function(gameUrl, gameTitle, romFilename) {
      var self = this;
      if (typeof gameUrl !== 'string' || !gameUrl) {
        return Promise.reject(new Error('Missing game URL for hot reload.'));
      }
      if (self.__qdnesReloadPromise) {
        return self.__qdnesReloadPromise;
      }
      self.__qdnesReloadPromise = new Promise(function(resolve, reject) {
        var bundle = self.__qdnesCoreBundle || {};
        if (!bundle.wasm) {
          reject(new Error('Missing cached core bundle.'));
          return;
        }

        self.config.gameUrl = gameUrl;
        var runtimeName = '';
        if (typeof romFilename === 'string' && romFilename) {
          runtimeName = romFilename;
        } else if (typeof gameTitle === 'string' && gameTitle) {
          runtimeName = gameTitle;
        }
        if (runtimeName) {
          self.config.gameName = runtimeName;
        }

        self.started = false;
        self.failedToStart = false;
        self.paused = true;
        if (self.resetTimeout) {
          clearTimeout(self.resetTimeout);
        }
        self.resetTimeout = null;

        if (self.textElem && self.textElem.parentNode) {
          self.textElem.parentNode.removeChild(self.textElem);
        }
        self.textElem = null;
        if (typeof self.createText === 'function') {
          self.createText();
        }

        var suspendPromise = Promise.resolve();
        try {
          if (
            self.Module &&
            self.Module.AL &&
            self.Module.AL.currentCtx &&
            self.Module.AL.currentCtx.audioCtx &&
            typeof self.Module.AL.currentCtx.audioCtx.suspend === 'function'
          ) {
            suspendPromise = Promise.resolve(self.Module.AL.currentCtx.audioCtx.suspend());
          }
        } catch (error) {
          console.warn('Emulator hot reload audio suspend failed:', error);
        }

        try {
          if (self.gameManager && typeof self.gameManager.toggleMainLoop === 'function') {
            self.gameManager.toggleMainLoop(0);
          }
        } catch (error) {
          console.warn('Emulator hot reload loop stop failed:', error);
        }

        try {
          if (typeof self.callEvent === 'function') {
            self.callEvent('exit');
          }
        } catch (error) {
          console.warn('Emulator hot reload exit call failed:', error);
        }

        Promise.race([
          suspendPromise,
          new Promise(function(resolveSuspendTimeout) {
            setTimeout(resolveSuspendTimeout, 400);
          })
        ]).finally(function() {
          setTimeout(function() {
            try {
              if (self.Module && typeof self.Module.abort === 'function') {
                self.Module.abort();
              }
            } catch (error) {
              // Abort may throw by design in emscripten runtimes.
            }
            try {
              self.initModule(copyBinary(bundle.wasm), copyBinary(bundle.thread));
            } catch (error) {
              reject(error);
              return;
            }

            var startedAt = Date.now();
            var timeoutMs = 25000;
            function waitForStart() {
              if (self.started) {
                resolve();
                return;
              }
              if (self.failedToStart) {
                reject(new Error('Hot reload failed to start.'));
                return;
              }
              if (Date.now() - startedAt > timeoutMs) {
                reject(new Error('Hot reload timed out.'));
                return;
              }
              setTimeout(waitForStart, 50);
            }
            waitForStart();
          }, 1300);
        });
      }).finally(function() {
        self.__qdnesReloadPromise = null;
      });
      return self.__qdnesReloadPromise;
    };
  }
})();
