// Polyfills for older browsers (Kylin V10)
// This file must be loaded BEFORE any other scripts

(function() {
  'use strict';
  
  // globalThis polyfill (for Chrome < 71, Firefox < 65)
  if (typeof globalThis === 'undefined') {
    if (typeof window !== 'undefined') {
      window.globalThis = window;
    } else if (typeof global !== 'undefined') {
      global.globalThis = global;
    } else if (typeof self !== 'undefined') {
      self.globalThis = self;
    }
  }

  // queueMicrotask polyfill using MessageChannel (safer than Promise)
  if (typeof window !== 'undefined' && typeof window.queueMicrotask !== 'function') {
    var microTaskQueue = [];
    var executing = false;
    
    function executeMicroTasks() {
      executing = true;
      while (microTaskQueue.length > 0) {
        var callback = microTaskQueue.shift();
        try {
          callback();
        } catch (e) {
          setTimeout(function() { throw e; }, 0);
        }
      }
      executing = false;
    }
    
    window.queueMicrotask = function(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('queueMicrotask requires a callback function');
      }
      microTaskQueue.push(callback);
      if (!executing) {
        setTimeout(executeMicroTasks, 0);
      }
    };
  }
})();
