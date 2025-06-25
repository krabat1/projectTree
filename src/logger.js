let level = 0;

export function setLogLevel(lvl) {
  level = lvl;
}

/*export const logger = {
  step(...args) { if (level >= 0) console.log('🔷', ...args); },
  trace(...args) { if (level >= 2) console.debug('🔍', ...args); },
  warn(...args) { if (level >= 0) console.warn('⚠️', ...args); },
  error(...args) { console.error('❌', ...args); }
};*/

/**
 * @typedef {Object} Logger
 * @property {(...args: any[]) => void} step
 * @property {(...args: any[]) => void} trace
 * @property {(...args: any[]) => void} warn
 * @property {(...args: any[]) => void} error
 */
/** @type {Logger} */
export const logger = {
    step: (...args) => { if (level >= 1) console.log(prefix('step', ...args), ...args) },
    trace: (...args) => { if (level >= 2) console.log(prefix('trace', ...args), ...args) },
    warn: (...args) => console.warn(prefix('warn', ...args), ...args),
    error: (...args) => console.error(prefix('error', ...args), ...args)
};

/** @type {Record<string, string>} */
const LOG_PREFIXES = {
    'step': '🟡 ',
    'trace': '🔍 ',
    'warn': '⚠️ ',
    'error': '❌ ',
    'default': '❓ '
};

/** @function
 * @name prefix
 * @param {string} prop 
 * @param  {any[]} args
 * @returns {string}
 */
function prefix(prop, ...args) {
    const prefixValue = LOG_PREFIXES[prop] || LOG_PREFIXES.default;
    if(prefixValue === '❓ ') console.warn('⚠️ ', `Unknown log level: ${prop}, using default prefix`);
    return args[0] === '' ? '' : prefixValue;
}
