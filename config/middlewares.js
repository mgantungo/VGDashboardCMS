module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  //'strapi::cors',
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      headers: '*',
      origin: ['http://localhost:3130', 'http://localhost:3000', 'https://cio.newvision.co.ug','https://visiongroup.co.ug'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
