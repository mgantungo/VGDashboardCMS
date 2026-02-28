// src/api/post/controllers/by-slug.js
'use strict';

const CMS_BASE_URL = 'https://cms-vgad.visiongroup.co.ug';

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

      // Extract Strapi ID from slug suffix (e.g. "some-article-title-18273" → 18273)
      const idMatch = slug.match(/-(\d+)$/);
      const strapiId = idMatch ? parseInt(idMatch[1]) : null;

      if (!strapiId) {
        console.log('❌ Could not extract ID from slug:', slug);
        return ctx.notFound('Article not found');
      }

      console.log('🔑 Extracted Strapi ID:', strapiId);

      // Fetch directly by Strapi ID
      let post = null;

      try {
        post = await strapi.entityService.findOne('api::post.post', strapiId, {
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
      } catch (e) {
        console.log('⚠️ findOne failed:', e.message);
      }

      if (!post) {
        console.log('❌ No article found for Strapi ID:', strapiId);
        return ctx.notFound('Article not found');
      }

      console.log('✅ Found article:', post.id, post.title);

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

      // Resolve author
      const primaryAuthor = post.authors?.length > 0 ? post.authors[0] : null;
      const authorName = primaryAuthor
        ? primaryAuthor.display_name ||
          `${primaryAuthor.first_name || ''} ${primaryAuthor.last_name || ''}`.trim() ||
          primaryAuthor.username
        : 'Harvest Money';

      // Resolve category
      const primaryCategory = post.categories?.length > 0 ? post.categories[0] : null;

      // Calculate read time
      const wordCount = (post.content || '').replace(/<[^>]*>/g, '').split(/\s+/).length;
      const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min read`;

      // Format date
      const publishedDate = post.wp_published_at || post.publishedAt || post.createdAt;
      const formattedDate = publishedDate
        ? new Date(publishedDate).toLocaleDateString('en-UG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '';

      ctx.body = {
        data: {
          id: post.id,
          slug: post.slug || slug,
          title: post.title || '',
          excerpt: (post.excerpt || '').replace(/&hellip;/g, '...').replace(/&amp;/g, '&'),
          content: post.content || '',
          image: featuredImage?.url || '',
          imageAlt: featuredImage?.alt || post.title || '',
          imageFormats: featuredImage?.formats || {},
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
        },
      };
    } catch (error) {
      console.error('❌ Error in getBySlug:', error);
      strapi.log.error('Error in getBySlug:', error);
      return ctx.internalServerError('An error occurred while fetching the article');
    }
  },
};
