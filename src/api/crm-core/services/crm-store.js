'use strict';

/**
 * Thin wrapper over the Strapi 5 Document Service (writes and normal reads)
 * and the Query Engine (bulk, read-only aggregation queries).
 * All relations are referenced by documentId.
 */
const { notFound } = require('../utils/crm-helpers');

module.exports = ({ strapi }) => ({
  docs(uid) {
    return strapi.documents(uid);
  },

  find(uid, { filters, populate, sort, limit = 500, start = 0, fields } = {}) {
    return strapi.documents(uid).findMany({ filters, populate, sort, limit, start, fields });
  },

  first(uid, { filters, populate, sort, fields } = {}) {
    return strapi.documents(uid).findFirst({ filters, populate, sort, fields });
  },

  one(uid, documentId, { populate, fields } = {}) {
    if (!documentId) return null;
    return strapi.documents(uid).findOne({ documentId, populate, fields });
  },

  async must(uid, documentId, opts = {}, what = 'Record') {
    const doc = await this.one(uid, documentId, opts);
    if (!doc) notFound(what);
    return doc;
  },

  count(uid, filters) {
    return strapi.documents(uid).count({ filters });
  },

  create(uid, data, populate) {
    return strapi.documents(uid).create({ data, populate });
  },

  update(uid, documentId, data, populate) {
    return strapi.documents(uid).update({ documentId, data, populate });
  },

  remove(uid, documentId) {
    return strapi.documents(uid).delete({ documentId });
  },

  /** Read-only bulk query through the Query Engine (no default page limit). */
  rows(uid, { where, select, populate, orderBy, limit, offset } = {}) {
    return strapi.db.query(uid).findMany({ where, select, populate, orderBy, limit, offset });
  },

  rowCount(uid, where) {
    return strapi.db.query(uid).count({ where });
  },

  hasModel(uid) {
    return Boolean(strapi.contentTypes[uid]);
  },
});
