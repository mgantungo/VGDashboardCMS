'use strict';

const SCREEN_UID = 'api::screen.screen';
const SOURCE_UID = 'api::broadcast-source.broadcast-source';

function computeStatus(screen, now) {
  if (!screen.lastSeenAt) return 'offline';
  const secondsSince = (now - new Date(screen.lastSeenAt).getTime()) / 1000;
  if (secondsSince <= (screen.staleAfter ?? 60)) return 'live';
  if (secondsSince <= (screen.offlineAfter ?? 300)) return 'stale';
  return 'offline';
}

function activeSource(screen) {
  const sources = (screen.broadcastSources || [])
    .filter((s) => s.isActive)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sources[0] || null;
}

module.exports = ({ strapi }) => ({
  /**
   * GET /api/screens/:slug/current
   * What the billboard page itself polls. Also records the check-in
   * (updates lastSeenAt) so the dashboard's status logic stays accurate
   * without needing a second request from every screen on every poll.
   */
  async current(ctx) {
    const { slug } = ctx.params;

    const screen = await strapi.documents(SCREEN_UID).findFirst({
      filters: { slug },
      populate: { broadcastSources: true },
    });

    if (!screen) {
      return ctx.notFound(`No screen found for slug "${slug}"`);
    }

    await strapi.documents(SCREEN_UID).update({
      documentId: screen.documentId,
      data: { lastSeenAt: new Date().toISOString() },
    });

    const source = activeSource(screen);

    ctx.body = {
      slug: screen.slug,
      name: screen.name,
      width: screen.width,
      height: screen.height,
      pollInterval: screen.pollInterval,
      source: source
        ? { title: source.title, type: source.type, value: source.value }
        : null,
    };
  },

  /**
   * POST /api/screens/:slug/checkin
   * Lightweight heartbeat, useful if the player wants to ping more often
   * than it re-fetches the full source (e.g. while a stream is mid-play).
   */
  async checkin(ctx) {
    const { slug } = ctx.params;

    const screen = await strapi.documents(SCREEN_UID).findFirst({
      filters: { slug },
    });

    if (!screen) {
      return ctx.notFound(`No screen found for slug "${slug}"`);
    }

    await strapi.documents(SCREEN_UID).update({
      documentId: screen.documentId,
      data: { lastSeenAt: new Date().toISOString() },
    });

    ctx.body = { ok: true, lastSeenAt: new Date().toISOString() };
  },

  /**
   * POST /api/screens/:slug/push
   * body: { title, type: 'youtube'|'hls'|'mp4', value }
   * Used by the dashboard's "Push" action. Deactivates any existing
   * sources on this screen and activates a new one.
   */
  async push(ctx) {
    const { slug } = ctx.params;
    const { title, type, value } = ctx.request.body || {};

    if (!type || !value) {
      return ctx.badRequest('type and value are required');
    }
    if (!['youtube', 'hls', 'mp4'].includes(type)) {
      return ctx.badRequest('type must be one of youtube, hls, mp4');
    }

    const screen = await strapi.documents(SCREEN_UID).findFirst({
      filters: { slug },
      populate: { broadcastSources: true },
    });

    if (!screen) {
      return ctx.notFound(`No screen found for slug "${slug}"`);
    }

    // Deactivate whatever is currently active on this screen
    const existing = screen.broadcastSources || [];
    await Promise.all(
      existing
        .filter((s) => s.isActive)
        .map((s) =>
          strapi.documents(SOURCE_UID).update({
            documentId: s.documentId,
            data: { isActive: false },
          })
        )
    );

    const maxOrder = existing.reduce((m, s) => Math.max(m, s.order ?? 0), 0);

    const created = await strapi.documents(SOURCE_UID).create({
      data: {
        title: title || 'Untitled push',
        type,
        value,
        isActive: true,
        order: maxOrder + 1,
        screen: screen.documentId,
      },
    });

    ctx.body = { ok: true, source: created };
  },

  /**
   * GET /api/screens/status
   * Everything the dashboard needs in one call: per-screen live/stale/offline
   * status plus whatever is currently active, computed server-side so the
   * dashboard doesn't duplicate the threshold logic.
   */
  async status(ctx) {
    const screens = await strapi.documents(SCREEN_UID).findMany({
      populate: { broadcastSources: true },
      sort: 'name:asc',
    });

    const now = Date.now();

    ctx.body = {
      data: screens.map((screen) => {
        const source = activeSource(screen);
        return {
          slug: screen.slug,
          name: screen.name,
          width: screen.width,
          height: screen.height,
          status: computeStatus(screen, now),
          lastSeenAt: screen.lastSeenAt || null,
          current: source
            ? { title: source.title, type: source.type, value: source.value }
            : null,
        };
      }),
    };
  },
});
