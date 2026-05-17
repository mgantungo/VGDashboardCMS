'use strict';

async function resolveSfaProfile(ctx, strapi) {
  const sfaProfileDocumentId = ctx.request.body?.sfaProfileDocumentId
    || (ctx.is('multipart') && ctx.request.body?.sfaProfileDocumentId);

  if (!sfaProfileDocumentId) {
    ctx.forbidden('sfaProfileDocumentId is required in the request body.');
    return null;
  }

  const profile = await strapi.documents('api::sfa-agent-profile.sfa-agent-profile').findOne({
    documentId: sfaProfileDocumentId,
    populate: ['vgams_sales_person', 'unit'],
  });

  if (!profile) {
    ctx.forbidden('SFA profile not found.');
    return null;
  }

  if (!profile.is_active) {
    ctx.forbidden('Your SFA profile is inactive. Contact an administrator.');
    return null;
  }

  if (!profile.vgams_sales_person?.isActive) {
    ctx.forbidden('Your sales person account is no longer active.');
    return null;
  }

  return {
    profile,
    salesPerson:    profile.vgams_sales_person,
    role:           profile.sfa_role,
    unitDocumentId: profile.unit?.documentId || null,
  };
}

module.exports = { resolveSfaProfile };
