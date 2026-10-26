import type { Schema, Struct } from '@strapi/strapi';

export interface DesignBatchFileGroup extends Struct.ComponentSchema {
  collectionName: 'components_design_batch_file_groups';
  info: {
    description: 'One designed file and the adverts it contains \u2014 a single PDF can bundle several small adverts (classifieds, combined notices) or just one.';
    displayName: 'CIO File Group';
  };
  attributes: {
    adverts: Schema.Attribute.Relation<'manyToMany', 'api::advert.advert'>;
    file: Schema.Attribute.Media<'images' | 'files'>;
    label: Schema.Attribute.String;
    uploaded_at: Schema.Attribute.DateTime;
    uploaded_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-user.vgams-user'
    >;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'design-batch.file-group': DesignBatchFileGroup;
    }
  }
}
