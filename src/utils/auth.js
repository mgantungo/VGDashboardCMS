'use strict';

/**
 * Validates the x-api-key header against the value stored in .env (API_SECRET_KEY).
 *
 * Usage inside any controller method:
 *   if (!validateApiKey(ctx)) return;
 *
 * @param {object} ctx - Koa context
 * @returns {boolean} true if valid, false if rejected (response already set)
 */
const validateApiKey = (ctx) => {
  const apiKey = process.env.API_SECRET_KEY;

  if (!apiKey) {
    ctx.send({ error: 'Server misconfiguration: API_SECRET_KEY is not set.' }, 500);
    return false;
  }

  const provided = ctx.request.headers['x-api-key'];

  if (!provided) {
    ctx.send({ error: 'Unauthorized: x-api-key header is missing.' }, 401);
    return false;
  }

  if (provided !== apiKey) {
    ctx.send({ error: 'Forbidden: Invalid API key.' }, 403);
    return false;
  }

  return true;
};

module.exports = { validateApiKey };
