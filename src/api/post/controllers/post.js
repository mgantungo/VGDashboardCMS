//'use strict';

/**
 * post controller
 */

//const { createCoreController } = require('@strapi/strapi').factories;

//module.exports = createCoreController('api::post.post');
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::post.post', ({ strapi }) => ({
  async updateFeaturedImages(ctx) {
    try {
      const postService = strapi.service('api::post.post');
      const result = await postService.updateFeaturedImages();
      
      ctx.send(result);
    } catch (error) {
      ctx.throw(500, error);
    }
  }
}));
