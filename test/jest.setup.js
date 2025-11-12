const crypto = require('crypto');

Object.defineProperty(global, 'crypto', {
  value: {
    randomBytes: crypto.randomBytes,
    randomUUID: crypto.randomUUID || (() => {
      // Polyfill for older Node.js versions
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }),
    getRandomValues: (arr) => {
      crypto.randomBytes(arr.length).forEach((val, i) => {
        arr[i] = val;
      });
      return arr;
    },
  },
});