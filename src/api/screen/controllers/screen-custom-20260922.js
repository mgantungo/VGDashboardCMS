'use strict';

const SCREEN_UID = 'api::screen.screen';
const SOURCE_UID = 'api::broadcast-source.broadcast-source';

// How long to trust a fetched external broadcast key before re-fetching.
// Keeps multiple screens sharing the same feed URL from hammering it,
// and keeps a single screen's own poll cycle cheap. Also used by
// detectSource below, which shares this cache/helper.
const EXTERNAL_FEED_CACHE_TTL_MS = 30 * 1000;
const externalFeedCache = new Map(); // url -> { data, expiresAt }

// Where "Fetch live ID" defaults to if the caller doesn't specify a url —
// the same feed the original PHP script polled for the live broadcast key.
const DEFAULT_DETECT_URL = 'https://adverts.newvisionapp.com/adverts/items/live_broadcast';

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

function extractStatus(item) {
  // The original PHP script only ever read broadcast_id/title, so we
  // don't know the real field name (if any) the API uses to mark a
  // broadcast "live"/"active". Pass through whichever of these exists,
  // if any, so the dashboard can show it — otherwise null, and the
  // admin just picks by title.
  return item.status ?? item.active ?? item.is_live ?? item.live ?? null;
}

/**
 * Fetches the live broadcast key from an external feed like
 * https://adverts.newvisionapp.com/adverts/items/live_broadcast
 * Expects the same shape the original PHP script relied on:
 *   { data: [ { broadcast_id, title, ... } ] }
 * Cached briefly per URL so several screens (or repeated polls) sharing
 * the same feed don't each trigger a fresh outbound request.
 */
async function fetchExternalBroadcast(url) {
  const cached = externalFeedCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${sep}sort=-id&limit=1`);

  if (!res.ok) {
    throw new Error(`External feed responded ${res.status}`);
  }

  const json = await res.json();
  const broadcast = json?.data?.[0];

  const result = broadcast
    ? { broadcastId: broadcast.broadcast_id, title: broadcast.title }
    : null;

  externalFeedCache.set(url, { data: result, expiresAt: Date.now() + EXTERNAL_FEED_CACHE_TTL_MS });
  return result;
}

/**
 * Decides what a screen should currently be showing.
 * Priority: live external feed (if enabled + configured + reachable) →
 * falls back to whatever was manually pushed/set as the active
 * Broadcast Source if the feed is off, unset, or the fetch fails.
 */
async function resolveSource(screen, strapi) {
  if (screen.externalFeedEnabled && screen.externalFeedUrl) {
    try {
      const broadcast = await fetchExternalBroadcast(screen.externalFeedUrl);
      if (broadcast?.broadcastId) {
        return {
          title: broadcast.title || screen.name,
          type: 'youtube',
          value: broadcast.broadcastId,
        };
      }
      // Feed reachable but returned nothing — fall through to static source
    } catch (err) {
      strapi.log.warn(
        `[screen] external feed fetch failed for "${screen.slug}": ${err.message}`
      );
      // fall through to static source below
    }
  }

  const source = activeSource(screen);
  return source ? { title: source.title, type: source.type, value: source.value } : null;
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueSlug(strapi, name) {
  const base = slugify(name) || 'screen';
  let slug = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await strapi.documents(SCREEN_UID).findFirst({ filters: { slug } })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
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

    const source = await resolveSource(screen, strapi);

    ctx.body = {
      slug: screen.slug,
      name: screen.name,
      width: screen.width,
      height: screen.height,
      pollInterval: screen.pollInterval,
      source,
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
   * sources on this screen, activates a new one, and turns off the
   * external feed for this screen so the push actually sticks instead
   * of being overwritten on the next poll.
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

    await strapi.documents(SCREEN_UID).update({
      documentId: screen.documentId,
      data: { externalFeedEnabled: false },
    });

    ctx.body = { ok: true, source: created };
  },

  /**
   * GET /api/screens/detect-source?url=<optional feed url>
   * Calls the live broadcast feed (defaults to the newvisionapp
   * adverts API — same one the original PHP script polled) and reads
   * back { broadcast_id, title } from the most recent entry. Powers the
   * dashboard's "Fetch live ID" button so you don't have to manually
   * copy an ID out of anywhere before pushing/registering it.
   */
  async detectSource(ctx) {
    const url = ctx.query.url || DEFAULT_DETECT_URL;

    if (!/^https?:\/\//i.test(url)) {
      return ctx.badRequest('url must start with http:// or https://');
    }

    let broadcast;
    try {
      broadcast = await fetchExternalBroadcast(url);
    } catch (err) {
      return ctx.badRequest(`Could not reach ${url}: ${err.message}`);
    }

    if (!broadcast?.broadcastId) {
      return ctx.notFound(`No live broadcast found at ${url}`);
    }

    ctx.body = {
      type: 'youtube',
      value: broadcast.broadcastId,
      title: broadcast.title || null,
      sourceUrl: url,
    };
  },

  /**
   * GET /api/screens/live-sources?url=<optional feed url>&limit=<n>
   * Like detectSource, but returns the N most recent entries instead of
   * just the top one — for when more than one broadcast might be
   * relevant at once, so the dashboard can show each by title and let
   * you push the right id to the right screen instead of only ever
   * getting whatever happens to be newest.
   *
   * NOTE: the original PHP script only ever read broadcast_id/title off
   * this feed, so there's no confirmed field marking an entry as
   * currently "live"/"active" — each item's `status` is passed through
   * as-is if the API happens to include one (null otherwise). If you
   * know the actual field name, tell me and I'll filter on it properly
   * instead of just listing the N most recent by id.
   */
  async listLiveSources(ctx) {
    const url = ctx.query.url || DEFAULT_DETECT_URL;
    const limit = Math.min(Number(ctx.query.limit) || 10, 50);

    if (!/^https?:\/\//i.test(url)) {
      return ctx.badRequest('url must start with http:// or https://');
    }

    let json;
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}sort=-id&limit=${limit}`);
      if (!res.ok) throw new Error(`Feed responded ${res.status}`);
      json = await res.json();
    } catch (err) {
      return ctx.badRequest(`Could not reach ${url}: ${err.message}`);
    }

    const items = json?.data || [];

    ctx.body = {
      data: items
        .filter((item) => item.broadcast_id)
        .map((item) => ({
          value: item.broadcast_id,
          title: item.title || item.broadcast_id,
          status: extractStatus(item),
        })),
    };
  },

  /**
   * POST /api/screens/register
   * body: { name, location?, width, height,
   *         externalFeedUrl?,                     // OR
   *         streamType?: 'youtube'|'hls'|'mp4', streamValue?, streamTitle? }
   * Used by the dashboard's "Add Screen" form. slug is generated from
   * name (and de-duplicated) — never supplied or hardcoded by the client.
   * Every field describing the actual stream is optional: a screen can be
   * created with nothing playing yet and given a source later via /push
   * or by setting externalFeedUrl in the admin.
   */
  async register(ctx) {
    const {
      name,
      location,
      width,
      height,
      externalFeedUrl,
      streamType,
      streamValue,
      streamTitle,
    } = ctx.request.body || {};

    if (!name || !width || !height) {
      return ctx.badRequest('name, width and height are required');
    }
    if (streamType && !['youtube', 'hls', 'mp4'].includes(streamType)) {
      return ctx.badRequest('streamType must be one of youtube, hls, mp4');
    }

    const slug = await uniqueSlug(strapi, name);
    const hasManualStream = Boolean(streamType && streamValue);

    const screen = await strapi.documents(SCREEN_UID).create({
      data: {
        name,
        slug,
        location: location || '',
        width: Number(width),
        height: Number(height),
        pollInterval: 300,
        staleAfter: 60,
        offlineAfter: 300,
        externalFeedUrl: externalFeedUrl || null,
        // A manual stream provided at creation time takes priority over
        // an external feed, same rule /push uses.
        externalFeedEnabled: Boolean(externalFeedUrl) && !hasManualStream,
      },
    });

    let source = null;
    if (hasManualStream) {
      source = await strapi.documents(SOURCE_UID).create({
        data: {
          title: streamTitle || name,
          type: streamType,
          value: streamValue,
          isActive: true,
          order: 1,
          screen: screen.documentId,
        },
      });
    }

    ctx.body = { ok: true, screen, source };
  },

  /**
   * GET /api/screens/status
   * Everything the dashboard needs in one call. Two separate signals:
   *  - broadcastStatus: 'live' | 'offline' — is there actually an active
   *    source assigned right now (external feed or manual push)? This is
   *    what the dashboard's main badge should reflect — a freshly pushed
   *    screen is live immediately, it doesn't need to wait on a check-in.
   *  - connectionStatus: 'live' | 'stale' | 'offline' — is the physical
   *    device itself still polling, derived from lastSeenAt vs.
   *    staleAfter/offlineAfter. Useful to show separately (e.g. "last
   *    seen 2m ago") but shouldn't drive the main LIVE/OFFLINE badge.
   */
  async status(ctx) {
    const screens = await strapi.documents(SCREEN_UID).findMany({
      populate: { broadcastSources: true },
      sort: 'name:asc',
    });

    const now = Date.now();

    const data = await Promise.all(
      screens.map(async (screen) => {
        const current = await resolveSource(screen, strapi);
        return {
          slug: screen.slug,
          name: screen.name,
          width: screen.width,
          height: screen.height,
          broadcastStatus: current ? 'live' : 'offline',
          connectionStatus: computeStatus(screen, now),
          lastSeenAt: screen.lastSeenAt || null,
          usingExternalFeed: Boolean(screen.externalFeedEnabled && screen.externalFeedUrl),
          current,
        };
      })
    );

    ctx.body = { data };
  },
});
