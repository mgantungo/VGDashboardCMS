'use strict';
module.exports = {

  /*
  *publication - categories
  */
  async findByAuthorUsername(ctx) {
    try {
      const { username } = ctx.params;

      if (!username) {
        return ctx.badRequest('Username parameter is required');
      }

      // Single query to get everything with proper population
      const author = await strapi.db.query('api::author.author').findOne({
        where: { username },
        select: ['id', 'username', 'email', 'display_name', 'first_name', 'last_name'],
        populate: {
          publications: {
            select: ['id', 'name', 'slug', 'description'],
            populate: {
              categories: {
                select: ['id', 'name', 'slug', 'description']
              }
            }
          }
        }
      });

      if (!author) {
        return ctx.notFound(`Author with username '${username}' not found`);
      }

      if (!author.publications || author.publications.length === 0) {
        return {
          data: {
            publications: [],
            categories: []
          },
          message: 'No publications found for this author'
        };
      }

      // Remove duplicate publications
      const publicationMap = new Map();
      const allCategories = [];
      const categoryMap = new Map();

      author.publications.forEach(pub => {
        if (!publicationMap.has(pub.id)) {
          publicationMap.set(pub.id, {
            id: pub.id,
            name: pub.name,
            slug: pub.slug,
            description: pub.description
          });
        }

        // Process categories for this publication
        if (pub.categories) {
          pub.categories.forEach(category => {
            if (!categoryMap.has(category.id)) {
              categoryMap.set(category.id, true);
              allCategories.push({
                id: category.id,
                name: category.name,
                slug: category.slug,
                publicationId: pub.id
              });
            }
          });
        }
      });

      const uniquePublications = Array.from(publicationMap.values());

      return {
        data: {
          publications: uniquePublications,
          categories: allCategories
        },
        meta: {
          author: {
            id: author.id,
            username: author.username,
            name: author.display_name || `${author.first_name} ${author.last_name}`,
            email: author.email
          },
          totalPublications: uniquePublications.length,
          totalCategories: allCategories.length
        }
      };

    } catch (error) {
      strapi.log.error('Error in findByAuthorUsername:', error);
      return ctx.internalServerError('An error occurred while fetching publications');
    }
  }
}
