export default {
  config: {
    locales: ['en'],
    tutorials: false,
    notifications: { releases: false },

    // 👇 Custom Sidebar Menu
    menu: {
      sections: [
        {
          id: 'harvestmoney',
          title: 'Harvestmoney',
          links: [
            { title: 'Categories', to: '/content-manager/collectionType/api::category.category' },
            { title: 'Tags', to: '/content-manager/collectionType/api::tag.tag' },
            { title: 'Authors', to: '/content-manager/collectionType/api::author.author' },
            { title: 'Posts', to: '/content-manager/collectionType/api::post.post' },
            { title: 'Pages', to: '/content-manager/collectionType/api::page.page' },
          ],
        },
      ],
    },
  },

  bootstrap(app) {
    console.log('✅ Custom sidebar loaded successfully');
  },
};
