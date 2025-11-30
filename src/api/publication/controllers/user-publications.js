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

      // Step 1: Confirm if username exists in authors
      const author = await strapi.db.query('api::author.author').findOne({
        where: { username },
        select: ['id', 'username', 'email', 'display_name', 'first_name', 'last_name']
      });

      if (!author) {
        return ctx.notFound(`Author with username '${username}' not found`);
      }

      // Step 2: Get unique publications for this author using distinct
      const authorPublications = await strapi.db.query('api::author.author').findOne({
        where: { username },
        populate: {
          publications: {
            select: ['id', 'name', 'slug', 'description']
          }
        }
      });

      if (!authorPublications.publications || authorPublications.publications.length === 0) {
        return {
          data: {
            publications: [],
            categories: []
          },
          message: 'No publications found for this author'
        };
      }

      const publicationIds = authorPublications.publications.map(pub => pub.id);

      // Step 3: Get publications with categories using distinct to avoid duplicates
      const publications = await strapi.entityService.findMany('api::publication.publication', {
        filters: {
          id: { $in: publicationIds }
        },
        fields: ['id', 'name', 'slug', 'description'],
        populate: {
          categories: {
            fields: ['id', 'name', 'slug', 'description'],
            // Use distinct to avoid duplicate categories
            filters: {
              $distinct: true
            }
          }
        }
      });

      // Step 4: Format the response
      const formattedPublications = publications.map(pub => ({
        id: pub.id,
        name: pub.name,
        slug: pub.slug,
        description: pub.description
      }));

      // Extract categories with distinct values using Set
      const allCategories = [];
      const seenCategoryIds = new Set();

      publications.forEach(pub => {
        if (pub.categories) {
          pub.categories.forEach(category => {
            if (!seenCategoryIds.has(category.id)) {
              seenCategoryIds.add(category.id);
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

      return {
        data: {
          publications: formattedPublications,
          categories: allCategories
        },
        meta: {
          author: {
            id: author.id,
            username: author.username,
            name: author.display_name || `${author.first_name} ${author.last_name}`,
            email: author.email
          },
          totalPublications: formattedPublications.length,
          totalCategories: allCategories.length
        }
      };

    } catch (error) {
      strapi.log.error('Error in findByAuthorUsername:', error);
      return ctx.internalServerError('An error occurred while fetching publications');
    }
  }
}
