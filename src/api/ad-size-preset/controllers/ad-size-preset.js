'use strict';

/**
 * ad-size-preset controller — standard Strapi actions so presets can be
 * managed in the admin panel (Content Manager). Copy Desk reads the list
 * through GET /copy-desk/size-presets, which needs no API permission.
 */
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::ad-size-preset.ad-size-preset');
