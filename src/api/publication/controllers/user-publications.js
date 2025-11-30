'use strict';
module.exports = {

  /*
  *publication - categories
  */
  async findByAuthorUsername(ctx) {
    try {
      const { username } = ctx.params;

      // Validate username parameter
      if (!username) {
        return ctx.badRequest('Username parameter is required');
      }

      // Find the author by username
      const author = await strapi.db.query('api::author.author').findOne({
        where: { username },
        populate: ['publications']
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

      // Get publication IDs from the author
      const publicationIds = author.publications.map(pub => pub.id);

      // Find publications with their categories
      const publications = await strapi.db.query('api::publication.publication').findMany({
        where: {
          id: { $in: publicationIds }
        },
        populate: {
          categories: {
            select: ['id', 'name', 'slug', 'description', 'isActive', 'displayOrder', 'isFeatured']
          }
        }
      });

      // Format the response to match your desired structure
      const formattedPublications = publications.map(pub => ({
        id: pub.id,
        name: pub.name,
        slug: pub.slug,
        description: pub.description
      }));

      // Extract categories from all publications
      const allCategories = [];
      const categoryMap = new Map();
      
      publications.forEach(pub => {
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
