// src/api/post/controllers/by-slug.js
'use strict';

const CMS_BASE_URL = 'https://cms-vgad.visiongroup.co.ug';

/** Build absolute image URL */
const resolveImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${CMS_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

module.exports = {
  async getBySlug(ctx) {
    try {
      const { slug } = ctx.params;

      if (!slug) {
        return ctx.badRequest('Slug parameter is required');
      }

      console.log('🔍 Fetching article by slug:', slug);

      // Extract wp_id from slug suffix (e.g. "some-article-title-18273" → 18273)
      const wpIdMatch = slug.match(/-(\d+)$/);
      const wpId = wpIdMatch ? parseInt(wpIdMatch[1]) : null;

      let post = null;

      // Strategy 1: Try exact slug match first
      const bySlug = await strapi.entityService.findMany('api::post.post', {
        filters: { slug: slug },
        limit: 1,
        populate: {
          featured_image: {
            fields: ['url', 'alternativeText', 'formats', 'ext', 'mime', 'size'],
          },
          authors: {
            fields: ['id', 'username', 'display_name', 'first_name', 'last_name'],
          },
          categories: {
            fields: ['id', 'name', 'slug'],
          },
          tags: {
            fields: ['id', 'name', 'slug'],
          },
        },
      });

      if (bySlug && bySlug.length > 0) {
        post = bySlug[0];
        console.log('✅ Found by slug field, id:', post.id);
      }

      // Strategy 2: Fall back to wp_id match
      if (!post && wpId) {
        const byWpId = await strapi.entityService.findMany('api::post.post', {
          filters: { wp_id: wpId },
          sort: { id: 'desc' }, // Take highest ID if duplicates
          limit: 1,
          populate: {
            featured_image: {
              fields: ['url', 'alternativeText', 'formats', 'ext', 'mime', 'size'],
            },
            authors: {
              fields: ['id', 'username', 'display_name', 'first_name', 'last_name'],
            },
            categories: {
              fields: ['id', 'name', 'slug'],
            },
            tags: {
              fields: ['id', 'name', 'slug'],
            },
          },
        });

        if (byWpId && byWpId.length > 0) {
          post = byWpId[0];
          console.log('✅ Found by wp_id:', wpId, '→ strapi id:', post.id);
        }
      }

      if (!post) {
        console.log('❌ No article found for slug:', slug);
        return ctx.notFound('Article not found');
      }

      // Resolve featured image
      let featuredImage = null;
      if (post.featured_image) {
        const img = post.featured_image;
        const formats = {};

        if (img.formats) {
          Object.entries(img.formats).forEach(([key, fmt]) => {
            formats[key] = {
              url: resolveImageUrl(fmt.url),
              width: fmt.width,
              height: fmt.height,
            };
          });
        }

        featuredImage = {
          url: resolveImageUrl(img.url),
          alt: img.alternativeText || '',
          formats,
        };
      }

      // Resolve author name
      const primaryAuthor =
        post.authors && post.authors.length > 0 ? post.authors[0] : null;
      const authorName = primaryAuthor
        ? primaryAuthor.display_name ||
          `${primaryAuthor.first_name || ''} ${primaryAuthor.last_name || ''}`.trim() ||
          primaryAuthor.username
        : 'Harvest Money';

      // Resolve category
      const primaryCategory =
        post.categories && post.categories.length > 0 ? post.categories[0] : null;

      // Calculate read time from content
      const wordCount = (post.content || '').replace(/<[^>]*>/g, '').split(/\s+/).length;
      const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min read`;

      // Format publish date
      const publishedDate = post.wp_published_at || post.publishedAt || post.createdAt;
      const formattedDate = publishedDate
        ? new Date(publishedDate).toLocaleDateString('en-UG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '';

      const formatted = {
        id: post.id,
        wpId: post.wp_id,
        slug: post.slug || slug,
        title: post.title || '',
        excerpt: (post.excerpt || '').replace(/&hellip;/g, '...').replace(/&amp;/g, '&'),
        content: post.content || '',
        image: featuredImage?.url || '',
        imageFormats: featuredImage?.formats || {},
        imageAlt: featuredImage?.alt || post.title || '',
        category: primaryCategory?.name || '',
        categorySlug: primaryCategory?.slug || '',
        readTime,
        date: formattedDate,
        author: authorName,
        authors: (post.authors || []).map((a) => ({
          id: a.id,
          username: a.username,
          name:
            a.display_name ||
            `${a.first_name || ''} ${a.last_name || ''}`.trim() ||
            a.username,
        })),
        tags: (post.tags || []).map((t) => t.name),
        isPremium: post.isPremium || false,
        isPublished: !!post.publishedAt,
        publishedAt: publishedDate,
      };

      ctx.body = { data: formatted };
    } catch (error) {
      console.error('❌ Error in getBySlug:', error);
      strapi.log.error('Error in getBySlug:', error);
      return ctx.internalServerError('An error occurred while fetching the article');
    }
  },
};
