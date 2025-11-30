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

      // Step 1: Confirm that the username exists in the authors collection
      const author = await strapi.db.query('api::author.author').findOne({
        where: { username },
        select: ['id', 'username', 'email', 'display_name', 'first_name', 'last_name']
      });

      if (!author) {
        return ctx.notFound(`Author with username '${username}' not found`);
      }

      // Step 2: Independently in the publications collection, return publications for the given author
      const publications = await strapi.db.query('api::publication.publication').findMany({
        where: {
          authors: {
            username: username
          }
        },
        select: ['id', 'name', 'slug', 'description']
      });

      if (!publications || publications.length === 0) {
        return {
          data: {
            publications: [],
            categories: []
          },
          message: 'No publications found for this author'
        };
      }

      // Step 3: If the username has associated publications, get related categories of each publication
      const publicationIds = publications.map(pub => pub.id);
      
      // Get publications with their categories
      const publicationsWithCategories = await strapi.db.query('api::publication.publication').findMany({
        where: {
          id: { $in: publicationIds }
        },
        select: ['id', 'name', 'slug', 'description'],
        populate: {
          categories: {
            select: ['id', 'name', 'slug', 'description']
          }
        }
      });

      // Format publications (remove any potential duplicates)
      const uniquePublications = [];
      const seenPublicationIds = new Set();
      
      publicationsWithCategories.forEach(pub => {
        if (!seenPublicationIds.has(pub.id)) {
          seenPublicationIds.add(pub.id);
          uniquePublications.push({
            id: pub.id,
            name: pub.name,
            slug: pub.slug,
            description: pub.description
          });
        }
      });

      // Extract and format categories
      const allCategories = [];
      const seenCategoryIds = new Set();
      
      publicationsWithCategories.forEach(pub => {
        if (pub.categories && pub.categories.length > 0) {
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
