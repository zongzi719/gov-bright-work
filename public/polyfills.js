// Polyfills for older browsers (Kylin V10)
// This file must be loaded BEFORE any other scripts

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

// queueMicrotask polyfill (for older browsers)
if (typeof queueMicrotask !== 'function') {
  window.queueMicrotask = function(callback) {
    Promise.resolve().then(callback).catch(function(err) {
      setTimeout(function() { throw err; }, 0);
    });
  };
}
