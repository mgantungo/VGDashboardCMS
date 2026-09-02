'use strict';
module.exports = {

  /*
  *publication - categories
  */
   async findByAuthorUsername(ctx) {
    const { username } = ctx.params;

    try {
      // 1. Confirm that the username exists in the authors collection
      const author = await strapi.db.query('api::author.author').findOne({
        where: { username },
        select: ['id', 'username', 'display_name']
      });

      if (!author) {
        return ctx.notFound('Author not found');
      }

      // 2. If the username exists, find publications where this author is referenced
      const publications = await strapi.db.query('api::publication.publication').findMany({
        where: {
          authors: {
            id: author.id
          }
        },
        select: ['id', 'name', 'slug', 'description'],
        populate: {
          categories: {
            select: ['id', 'name', 'slug', 'description'],
            where: {
              isActive: true
            }
          }
        }
      });

      // Transform the data
      const result = publications.map(publication => ({
        id: publication.id,
        name: publication.name,
        slug: publication.slug,
        description: publication.description,
        categories: publication.categories.map(category => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description
        }))
      }));

      return {
        author: {
          id: author.id,
          username: author.username,
          display_name: author.display_name
        },
        publications: result
      };

    } catch (error) {
      strapi.log.error('Error in findByAuthorUsername:', error);
      return ctx.internalServerError('Something went wrong');
    }
  }
}
