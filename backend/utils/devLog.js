/**
 * Development-only logging — suppressed when NODE_ENV=production.
 */
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function devLog(...args) {
  if (!isProduction()) {
    console.log(...args);
  }
}

function devWarn(...args) {
  if (!isProduction()) {
    console.warn(...args);
  }
}

module.exports = { isProduction, devLog, devWarn };
