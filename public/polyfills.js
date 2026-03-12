// Polyfills for older browsers (Kylin V10 Firefox 62, Chrome 49+)
// This file must be loaded BEFORE any other scripts in the HTML <head>
// CRITICAL: This runs before React, Vite, or any bundled code

(function() {
  'use strict';
  
  // ========== 1. globalThis polyfill (for Chrome < 71, Firefox < 65) ==========
  // Must be first as other code may depend on it
  if (typeof globalThis === 'undefined') {
    if (typeof window !== 'undefined') {
      window.globalThis = window;
    } else if (typeof global !== 'undefined') {
      global.globalThis = global;
    } else if (typeof self !== 'undefined') {
      self.globalThis = self;
    }
  }

  // ========== 2. queueMicrotask polyfill ==========
  // Uses a simple array queue with setTimeout to avoid Promise-related issues
  // in older browsers where Promise might not behave correctly
  if (typeof window !== 'undefined' && typeof window.queueMicrotask !== 'function') {
    var microTaskQueue = [];
    var scheduled = false;

    var flushMicroTasks = function() {
      scheduled = false;
      var tasks = microTaskQueue.slice();
      microTaskQueue.length = 0;

      for (var i = 0; i < tasks.length; i++) {
        try {
          tasks[i]();
        } catch (e) {
          // Re-throw errors asynchronously to not break the queue
          (function(err) {
            setTimeout(function() { throw err; }, 0);
          })(e);
        }
      }
    };

    window.queueMicrotask = function(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('queueMicrotask requires a callback function');
      }
      microTaskQueue.push(callback);
      if (!scheduled) {
        scheduled = true;
        // Use setTimeout(0) which is universally supported
        setTimeout(flushMicroTasks, 0);
      }
    };
  }

  // ========== 3. Object.fromEntries polyfill (for Firefox < 63, Chrome < 73) ==========
  if (typeof Object.fromEntries !== 'function') {
    Object.fromEntries = function(iterable) {
      var obj = {};
      if (iterable) {
        if (typeof iterable.forEach === 'function') {
          iterable.forEach(function(entry) {
            if (entry && entry.length >= 2) {
              obj[entry[0]] = entry[1];
            }
          });
        } else {
          for (var i = 0; i < iterable.length; i++) {
            var entry = iterable[i];
            if (entry && entry.length >= 2) {
              obj[entry[0]] = entry[1];
            }
          }
        }
      }
      return obj;
    };
  }

  // ========== 4. Array.prototype.flat polyfill (for Firefox < 62, Chrome < 69) ==========
  if (!Array.prototype.flat) {
    Array.prototype.flat = function(depth) {
      var flattend = [];
      var d = depth === undefined ? 1 : Number(depth);
      
      (function flatten(arr, currentDepth) {
        for (var i = 0; i < arr.length; i++) {
          if (Array.isArray(arr[i]) && currentDepth < d) {
            flatten(arr[i], currentDepth + 1);
          } else {
            flattend.push(arr[i]);
          }
        }
      })(this, 0);
      
      return flattend;
    };
  }

  // ========== 5. Array.prototype.flatMap polyfill ==========
  if (!Array.prototype.flatMap) {
    Array.prototype.flatMap = function(callback, thisArg) {
      return this.map(callback, thisArg).flat(1);
    };
  }

  // ========== 6. String.prototype.trimStart/trimEnd polyfill ==========
  if (!String.prototype.trimStart) {
    String.prototype.trimStart = function() {
      return this.replace(/^\s+/, '');
    };
  }
  if (!String.prototype.trimEnd) {
    String.prototype.trimEnd = function() {
      return this.replace(/\s+$/, '');
    };
  }

  // ========== 7. Legacy browser detection ==========
  // Detect browsers that don't support CSS Color Level 4 (space-separated hsl)
  // e.g. Firefox < 65, Chrome < 66
  (function detectLegacyBrowser() {
    try {
      var testEl = document.createElement('div');
      testEl.style.color = 'hsl(0 0% 0%)';
      // If the browser doesn't understand space-separated hsl, it ignores it
      if (!testEl.style.color) {
        document.documentElement.classList.add('legacy-browser');
        if (typeof console !== 'undefined' && console.log) {
          console.log('[Polyfills] Legacy browser detected, added .legacy-browser class');
        }
      }
    } catch (e) {
      // If classList or createElement fails, mark as legacy
      try {
        document.documentElement.className += ' legacy-browser';
      } catch (e2) {}
    }
  })();

  // Log success for debugging
  if (typeof console !== 'undefined' && console.log) {
    console.log('[Polyfills] Loaded successfully for legacy browser support');
  }
})();
