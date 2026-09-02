const path = require('path');
const winston = require('winston');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Ensure log directory exists
const logDir = path.join(__dirname, '../../logs/bc-monitor');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Safe stringify to handle circular references
function safeStringify(obj, indent = 0) {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return '[Circular]';
      }
      cache.add(value);
    }
    // Don't stringify large objects
    if (key === 'response' && value && typeof value === 'object') {
      return {
        status: value.status,
        statusText: value.statusText,
        data: value.data
      };
    }
    if (key === 'request' && value && typeof value === 'object') {
      return '[Request Object]';
    }
    return value;
  }, indent);
}

// Configure log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length) {
      try {
        metaStr = safeStringify(meta);
      } catch (e) {
        metaStr = '[Unable to stringify meta]';
      }
    }
    return `[${timestamp}] ${level.toUpperCase()} [${service || 'bc-monitor'}]: ${message} ${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'bc-invoice-monitor' },
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.json()
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.json()
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;
