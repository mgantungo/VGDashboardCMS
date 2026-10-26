import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAccessLogAccessLog extends Struct.CollectionTypeSchema {
  collectionName: 'access_logs';
  info: {
    displayName: 'Asset Management Access Log';
    pluralName: 'access-logs';
    singularName: 'access-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    Action: Schema.Attribute.Enumeration<['Check in', 'Check out']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Check in'>;
    anomalies: Schema.Attribute.Relation<'oneToMany', 'api::anomaly.anomaly'>;
    Anomaly: Schema.Attribute.Boolean & Schema.Attribute.Required;
    company_asset: Schema.Attribute.Relation<
      'manyToOne',
      'api::company-asset.company-asset'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::access-log.access-log'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    staff: Schema.Attribute.Relation<
      'manyToOne',
      'api::staff-table.staff-table'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAdvertDailyScheduleAdvertDailySchedule
  extends Struct.CollectionTypeSchema {
  collectionName: 'advert_daily_schedules';
  info: {
    displayName: 'CIO Advert Daily Schedule';
    pluralName: 'advert-daily-schedules';
    singularName: 'advert-daily-schedule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    adverts: Schema.Attribute.Relation<'manyToMany', 'api::advert.advert'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_published: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::advert-daily-schedule.advert-daily-schedule'
    > &
      Schema.Attribute.Private;
    media: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    page: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    publishedAt: Schema.Attribute.DateTime;
    run_date: Schema.Attribute.Date & Schema.Attribute.Required;
    run_time: Schema.Attribute.JSON;
    source_batches: Schema.Attribute.Relation<
      'manyToMany',
      'api::design-batch.design-batch'
    >;
    source_file_group_id: Schema.Attribute.Integer;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAdvertAdvert extends Struct.CollectionTypeSchema {
  collectionName: 'adverts';
  info: {
    displayName: 'CIO Advert';
    pluralName: 'adverts';
    singularName: 'advert';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    ad_size: Schema.Attribute.String & Schema.Attribute.Required;
    ad_type: Schema.Attribute.Enumeration<['full_color', 'black_white']> &
      Schema.Attribute.DefaultTo<'full_color'>;
    advert_daily_schedules: Schema.Attribute.Relation<
      'manyToMany',
      'api::advert-daily-schedule.advert-daily-schedule'
    >;
    advert_title: Schema.Attribute.String & Schema.Attribute.Required;
    approved_by_manager: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    attachments: Schema.Attribute.Media<'images' | 'files' | 'videos', true>;
    base_price: Schema.Attribute.Decimal & Schema.Attribute.Required;
    bc_reference_number: Schema.Attribute.String;
    bc_share_success: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    client_reference_no: Schema.Attribute.String;
    comments: Schema.Attribute.Relation<'oneToMany', 'api::comment.comment'>;
    contact_email: Schema.Attribute.String;
    contact_number: Schema.Attribute.String;
    contact_person: Schema.Attribute.String;
    cost_stream: Schema.Attribute.String;
    created_by_clerk: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    design_batches: Schema.Attribute.Relation<
      'manyToMany',
      'api::design-batch.design-batch'
    >;
    discount: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    end_date: Schema.Attribute.Date;
    frequency: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    handled_at: Schema.Attribute.DateTime;
    handled_by_designer: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-user.vgams-user'
    >;
    hasRun: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    invoice: Schema.Attribute.Relation<'oneToOne', 'api::invoice.invoice'>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    isApproved: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    isCanceled: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    isClosed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    isPaid: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    isScheduled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::advert.advert'
    > &
      Schema.Attribute.Private;
    market_sector: Schema.Attribute.String;
    office_location: Schema.Attribute.String;
    pager_pages: Schema.Attribute.Relation<
      'manyToMany',
      'api::pager-page.pager-page'
    >;
    payment_method: Schema.Attribute.Enumeration<
      ['cash', 'credit', 'pdc', 'bank_transfer', 'mobile_money']
    > &
      Schema.Attribute.Required;
    product: Schema.Attribute.Relation<'manyToOne', 'api::product.product'>;
    publish_onweb: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    publishedAt: Schema.Attribute.DateTime;
    publishing_dates: Schema.Attribute.JSON;
    rate_card: Schema.Attribute.Relation<
      'manyToOne',
      'api::rate-card.rate-card'
    >;
    reference_number: Schema.Attribute.UID<''>;
    revenue_stream: Schema.Attribute.String;
    reviewed_by_editor: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    section_commission: Schema.Attribute.String;
    special_instructions: Schema.Attribute.Text;
    start_date: Schema.Attribute.Date & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<
      [
        'draft',
        'pending_review',
        'editor_approved',
        'editor_rejected',
        'manager_approved',
        'manager_rejected',
        'published',
      ]
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    surcharge: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    total_amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vgams_sales_persons: Schema.Attribute.Relation<
      'manyToMany',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    vgams_user: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-user.vgams-user'
    >;
    workflow_history: Schema.Attribute.Relation<
      'oneToMany',
      'api::workflow-log.workflow-log'
    >;
  };
}

export interface ApiAnomalyAnomaly extends Struct.CollectionTypeSchema {
  collectionName: 'anomalies';
  info: {
    displayName: 'Asset Management Anomaly';
    pluralName: 'anomalies';
    singularName: 'anomaly';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    access_log: Schema.Attribute.Relation<
      'manyToOne',
      'api::access-log.access-log'
    >;
    company_asset: Schema.Attribute.Relation<
      'manyToOne',
      'api::company-asset.company-asset'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    detected_at: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::anomaly.anomaly'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    resolved: Schema.Attribute.Boolean & Schema.Attribute.Required;
    staff: Schema.Attribute.Relation<
      'manyToOne',
      'api::staff-table.staff-table'
    >;
    type: Schema.Attribute.Enumeration<
      [
        'Unauthorized access',
        'Late checkout',
        'Wrong checkout location',
        'Invalid information',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Invalid information'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiApiListingApiListing extends Struct.CollectionTypeSchema {
  collectionName: 'api_listings';
  info: {
    displayName: 'API LISTING';
    pluralName: 'api-listings';
    singularName: 'api-listing';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    active: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    callback: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    grouping: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::api-listing.api-listing'
    > &
      Schema.Attribute.Private;
    location: Schema.Attribute.String;
    method: Schema.Attribute.Enumeration<['POST', 'GET', 'PUT', 'DELETE']>;
    private: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    public: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    publishedAt: Schema.Attribute.DateTime;
    purpose: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String;
    usage: Schema.Attribute.Text;
  };
}

export interface ApiAuthorAuthor extends Struct.CollectionTypeSchema {
  collectionName: 'authors';
  info: {
    category: 'Harvestmoney';
    description: 'WordPress Authors';
    displayName: 'Author';
    pluralName: 'authors';
    singularName: 'author';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    accessToken: Schema.Attribute.Password;
    accountstatus: Schema.Attribute.Enumeration<
      ['active', 'suspended', 'deleted']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    avatar_url: Schema.Attribute.String;
    bio: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    display_name: Schema.Attribute.String;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    first_name: Schema.Attribute.String & Schema.Attribute.Required;
    last_name: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::author.author'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password & Schema.Attribute.Private;
    posts: Schema.Attribute.Relation<'manyToMany', 'api::post.post'>;
    publications: Schema.Attribute.Relation<
      'manyToMany',
      'api::publication.publication'
    >;
    publishedAt: Schema.Attribute.DateTime;
    tokenGeneratedAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    wp_id: Schema.Attribute.Integer & Schema.Attribute.Unique;
  };
}

export interface ApiBcDatasetBcDataset extends Struct.CollectionTypeSchema {
  collectionName: 'bc_datasets';
  info: {
    displayName: 'BC-DATASET';
    pluralName: 'bc-datasets';
    singularName: 'bc-dataset';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    Add_Currency_Credit_Amount: Schema.Attribute.BigInteger;
    Add_Currency_Debit_Amount: Schema.Attribute.BigInteger;
    Additional_Currency_Amount: Schema.Attribute.BigInteger;
    Amount: Schema.Attribute.BigInteger;
    Business_Unit_Code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    Credit_Amount: Schema.Attribute.BigInteger;
    Debit_Amount: Schema.Attribute.BigInteger;
    Dimension_Set_ID: Schema.Attribute.BigInteger;
    Document_Date: Schema.Attribute.Date;
    Document_No: Schema.Attribute.String;
    Document_Type: Schema.Attribute.String;
    Entry_No: Schema.Attribute.BigInteger;
    G_L_Account_Name: Schema.Attribute.String;
    G_L_Account_No: Schema.Attribute.BigInteger;
    Gen_Bus_Posting_Group: Schema.Attribute.String;
    Gen_Posting_Type: Schema.Attribute.String;
    Gen_Prod_Posting_Group: Schema.Attribute.String;
    IC_Partner_Code: Schema.Attribute.String;
    Job_No: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::bc-dataset.bc-dataset'
    > &
      Schema.Attribute.Private;
    Posting_Date: Schema.Attribute.Date;
    publishedAt: Schema.Attribute.DateTime;
    Reason_Code: Schema.Attribute.String;
    Source_Code: Schema.Attribute.String;
    Tax_Area_Code: Schema.Attribute.String;
    Tax_Group_Code: Schema.Attribute.String;
    Tax_Liable: Schema.Attribute.Boolean;
    Transaction_No: Schema.Attribute.BigInteger;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    Use_Tax: Schema.Attribute.Boolean;
    VAT_Amount: Schema.Attribute.BigInteger;
    VAT_Bus_Posting_Group: Schema.Attribute.String;
    VAT_Prod_Posting_Group: Schema.Attribute.String;
  };
}

export interface ApiBroadcastSourceBroadcastSource
  extends Struct.CollectionTypeSchema {
  collectionName: 'broadcast_sources';
  info: {
    description: 'A single video source (Twitch/YouTube/HLS/MP4) that can be assigned to a screen.';
    displayName: 'Broadcast Source';
    pluralName: 'broadcast-sources';
    singularName: 'broadcast-source';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::broadcast-source.broadcast-source'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    screen: Schema.Attribute.Relation<'manyToOne', 'api::screen.screen'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<['twitch', 'youtube', 'hls', 'mp4']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'twitch'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ApiCampaignAttendenceCampaignAttendence
  extends Struct.CollectionTypeSchema {
  collectionName: 'campaign_attendences';
  info: {
    displayName: 'CampaignAttendence';
    pluralName: 'campaign-attendences';
    singularName: 'campaign-attendence';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    campaigns: Schema.Attribute.Relation<
      'manyToMany',
      'api::campaign.campaign'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email;
    fullName: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::campaign-attendence.campaign-attendence'
    > &
      Schema.Attribute.Private;
    phone: Schema.Attribute.String & Schema.Attribute.Required;
    processes: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    promoCode: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    uniqueSecret: Schema.Attribute.UID & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCampaignCampaign extends Struct.CollectionTypeSchema {
  collectionName: 'campaigns';
  info: {
    displayName: 'Campaigns';
    pluralName: 'campaigns';
    singularName: 'campaign';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    campaign_attendences: Schema.Attribute.Relation<
      'manyToMany',
      'api::campaign-attendence.campaign-attendence'
    >;
    campaignName: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    endDate: Schema.Attribute.Date;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::campaign.campaign'
    > &
      Schema.Attribute.Private;
    owner: Schema.Attribute.Enumeration<
      [
        'Bukedde',
        'New Vision',
        'Epaper',
        'Vision Shop',
        'Vision Courier',
        'Bukedde Radio',
        'XFM',
        'ETOP',
        'Kabalega FM',
        'TV West',
        'Wan Luo',
      ]
    > &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'campaignName'> & Schema.Attribute.Required;
    startDate: Schema.Attribute.Date;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCategoryCategory extends Struct.CollectionTypeSchema {
  collectionName: 'categories';
  info: {
    category: 'Harvestmoney';
    description: 'WordPress Categories';
    displayName: 'Category';
    pluralName: 'categories';
    singularName: 'category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'api::category.category'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    displayOrder: Schema.Attribute.Integer;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    isFeatured: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::category.category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    parent: Schema.Attribute.Relation<'manyToOne', 'api::category.category'>;
    posts: Schema.Attribute.Relation<'manyToMany', 'api::post.post'>;
    publications: Schema.Attribute.Relation<
      'manyToMany',
      'api::publication.publication'
    >;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    wp_id: Schema.Attribute.Integer & Schema.Attribute.Unique;
  };
}

export interface ApiClientClient extends Struct.CollectionTypeSchema {
  collectionName: 'clients';
  info: {
    displayName: 'CIO Client';
    pluralName: 'clients';
    singularName: 'client';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    address: Schema.Attribute.Text;
    adverts: Schema.Attribute.Relation<'oneToMany', 'api::advert.advert'>;
    bc_no: Schema.Attribute.String;
    clientTin: Schema.Attribute.String;
    company_name: Schema.Attribute.String & Schema.Attribute.Required;
    contact_person: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    credit_approved: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    credit_limit: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    email: Schema.Attribute.Email;
    invoices: Schema.Attribute.Relation<'oneToMany', 'api::invoice.invoice'>;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::client.client'
    > &
      Schema.Attribute.Private;
    payment_terms: Schema.Attribute.Enumeration<
      ['cash', 'credit_7', 'credit_15', 'credit_30', 'pdc']
    > &
      Schema.Attribute.DefaultTo<'cash'>;
    phone: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'0700000000'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCommentComment extends Struct.CollectionTypeSchema {
  collectionName: 'comments';
  info: {
    displayName: 'CIO Comment';
    pluralName: 'comments';
    singularName: 'comment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    advert: Schema.Attribute.Relation<'manyToOne', 'api::advert.advert'>;
    author: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    comment_text: Schema.Attribute.Text & Schema.Attribute.Required;
    comment_type: Schema.Attribute.Enumeration<
      ['general', 'approval', 'rejection', 'revision_request']
    > &
      Schema.Attribute.DefaultTo<'general'>;
    created_at: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::comment.comment'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCompanyAssetCompanyAsset
  extends Struct.CollectionTypeSchema {
  collectionName: 'company_assets';
  info: {
    displayName: 'Asset Management Company Asset';
    pluralName: 'company-assets';
    singularName: 'company-asset';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    access_logs: Schema.Attribute.Relation<
      'oneToMany',
      'api::access-log.access-log'
    >;
    anomalies: Schema.Attribute.Relation<'oneToMany', 'api::anomaly.anomaly'>;
    asset_id: Schema.Attribute.UID & Schema.Attribute.Required;
    asset_status: Schema.Attribute.Enumeration<
      ['Assigned', 'Available', 'Damaged']
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::company-asset.company-asset'
    > &
      Schema.Attribute.Private;
    office: Schema.Attribute.Relation<'manyToOne', 'api::office.office'>;
    publishedAt: Schema.Attribute.DateTime;
    serial_number: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    staff: Schema.Attribute.Relation<
      'manyToOne',
      'api::staff-table.staff-table'
    >;
    tag_number: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    type: Schema.Attribute.Enumeration<
      ['Laptop', 'Monitor', 'Camera', 'Car', 'Telephone']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Laptop'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCostStreamCostStream extends Struct.CollectionTypeSchema {
  collectionName: 'cost_streams';
  info: {
    displayName: 'CIO Cost Stream';
    pluralName: 'cost-streams';
    singularName: 'cost-stream';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::cost-stream.cost-stream'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    products: Schema.Attribute.Relation<'oneToMany', 'api::product.product'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmApprovalPolicyCrmApprovalPolicy
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_approval_policies';
  info: {
    description: 'Thresholds are data: discount % bands, margin floor, payment-term days, third-party and credit flags.';
    displayName: 'CRM Approval Policy';
    pluralName: 'crm-approval-policies';
    singularName: 'crm-approval-policy';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approver_role: Schema.Attribute.Enumeration<
      [
        'salesperson',
        'product_manager',
        'supervisor',
        'senior_manager',
        'executive',
        'project_manager',
        'finance',
        'procurement',
        'admin',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'supervisor'>;
    business_unit: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-business-unit.crm-business-unit'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-approval-policy.crm-approval-policy'
    > &
      Schema.Attribute.Private;
    max_value: Schema.Attribute.Decimal;
    min_value: Schema.Attribute.Decimal;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    sla_hours: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<24>;
    sort: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    trigger_type: Schema.Attribute.Enumeration<
      [
        'discount',
        'low_margin',
        'payment_terms',
        'third_party',
        'credit',
        'contract_variation',
        'change_request',
        'early_closure',
        'lpo_exception',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'discount'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmApprovalRequestCrmApprovalRequest
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_approval_requests';
  info: {
    displayName: 'CRM Approval Request';
    pluralName: 'crm-approval-requests';
    singularName: 'crm-approval-request';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approver: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    approver_role: Schema.Attribute.Enumeration<
      [
        'salesperson',
        'product_manager',
        'supervisor',
        'senior_manager',
        'executive',
        'project_manager',
        'finance',
        'procurement',
        'admin',
      ]
    > &
      Schema.Attribute.DefaultTo<'supervisor'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decided_at: Schema.Attribute.DateTime;
    decision: Schema.Attribute.Enumeration<
      ['pending', 'approved', 'rejected', 'returned', 'cancelled']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    detail: Schema.Attribute.String;
    due_at: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-approval-request.crm-approval-request'
    > &
      Schema.Attribute.Private;
    policy: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-approval-policy.crm-approval-policy'
    >;
    publishedAt: Schema.Attribute.DateTime;
    reason: Schema.Attribute.Text;
    requested_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    sla_hours: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<24>;
    subject_id: Schema.Attribute.String;
    subject_type: Schema.Attribute.String;
    trigger_type: Schema.Attribute.Enumeration<
      [
        'discount',
        'low_margin',
        'payment_terms',
        'third_party',
        'credit',
        'contract_variation',
        'change_request',
        'early_closure',
        'lpo_exception',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'discount'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-version.crm-proposal-version'
    >;
  };
}

export interface ApiCrmAuditLogCrmAuditLog extends Struct.CollectionTypeSchema {
  collectionName: 'crm_audit_logs';
  info: {
    description: 'Append-only. Written by the CRM API; not editable from the CRM UI.';
    displayName: 'CRM Audit Log';
    pluralName: 'crm-audit-logs';
    singularName: 'crm-audit-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    actor: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    actor_user_id: Schema.Attribute.Integer;
    after: Schema.Attribute.JSON;
    before: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ip: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-audit-log.crm-audit-log'
    > &
      Schema.Attribute.Private;
    occurred_at: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
    target_id: Schema.Attribute.String;
    target_uid: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmBaselineCrmBaseline extends Struct.CollectionTypeSchema {
  collectionName: 'crm_baselines';
  info: {
    displayName: 'CRM Baseline Snapshot';
    pluralName: 'crm-baselines';
    singularName: 'crm-baseline';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    change_request: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-change-request.crm-change-request'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    label: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-baseline.crm-baseline'
    > &
      Schema.Attribute.Private;
    project: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-project.crm-project'
    >;
    publishedAt: Schema.Attribute.DateTime;
    snapshot: Schema.Attribute.JSON;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workstream: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-workstream.crm-workstream'
    >;
  };
}

export interface ApiCrmBillingItemCrmBillingItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_billing_items';
  info: {
    displayName: 'CRM Billing Item';
    pluralName: 'crm-billing-items';
    singularName: 'crm-billing-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    contract: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-contract.crm-contract'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    due_date: Schema.Attribute.Date;
    invoice: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-invoice.crm-invoice'
    >;
    label: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-billing-item.crm-billing-item'
    > &
      Schema.Attribute.Private;
    lpo_exception_approved: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    milestone: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-milestone.crm-milestone'
    >;
    project: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-project.crm-project'
    >;
    publishedAt: Schema.Attribute.DateTime;
    state: Schema.Attribute.Enumeration<
      [
        'not_billed',
        'requested',
        'invoiced',
        'part_paid',
        'paid',
        'overdue',
        'cancelled',
      ]
    > &
      Schema.Attribute.DefaultTo<'not_billed'>;
    trigger_type: Schema.Attribute.Enumeration<
      ['milestone', 'monthly', 'event', 'completion', 'upfront']
    > &
      Schema.Attribute.DefaultTo<'completion'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workstream: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-workstream.crm-workstream'
    >;
  };
}

export interface ApiCrmBusinessUnitCrmBusinessUnit
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_business_units';
  info: {
    displayName: 'CRM Business Unit';
    pluralName: 'crm-business-units';
    singularName: 'crm-business-unit';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    head: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-business-unit.crm-business-unit'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmChangeRequestCrmChangeRequest
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_change_requests';
  info: {
    displayName: 'CRM Change Request';
    pluralName: 'crm-change-requests';
    singularName: 'crm-change-request';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approver: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    change_type: Schema.Attribute.Enumeration<
      [
        'extension',
        'scope_change',
        'cancellation',
        'early_closure',
        'price_change',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'extension'>;
    client_accepted: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    cost_impact: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decided_at: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-change-request.crm-change-request'
    > &
      Schema.Attribute.Private;
    new_end_date: Schema.Attribute.Date;
    price_impact: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    project: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-project.crm-project'
    >;
    publishedAt: Schema.Attribute.DateTime;
    reason: Schema.Attribute.Text;
    requested_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    state: Schema.Attribute.Enumeration<
      ['pending', 'approved', 'rejected', 'applied']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workstream: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-workstream.crm-workstream'
    >;
  };
}

export interface ApiCrmClientAssignmentCrmClientAssignment
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_client_assignments';
  info: {
    description: 'Who looks after which client, in which role, from when to when.';
    displayName: 'CRM Client Assignment';
    pluralName: 'crm-client-assignments';
    singularName: 'crm-client-assignment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assigned_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    business_unit: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-business-unit.crm-business-unit'
    >;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    end_date: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-client-assignment.crm-client-assignment'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    reason: Schema.Attribute.String;
    role: Schema.Attribute.Enumeration<
      ['account_lead', 'relationship_owner', 'associated_seller']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'associated_seller'>;
    sales_person: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    start_date: Schema.Attribute.Date;
    state: Schema.Attribute.Enumeration<['active', 'ended']> &
      Schema.Attribute.DefaultTo<'active'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmClientProfileCrmClientProfile
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_client_profiles';
  info: {
    description: 'CRM-only fields for an existing client (status, category, duplicate key). One per client.';
    displayName: 'CRM Client Profile';
    pluralName: 'crm-client-profiles';
    singularName: 'crm-client-profile';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    category: Schema.Attribute.Enumeration<
      ['corporate', 'sme', 'government', 'ngo', 'agency', 'individual']
    > &
      Schema.Attribute.DefaultTo<'corporate'>;
    client: Schema.Attribute.Relation<'oneToOne', 'api::client.client'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dedupe_key: Schema.Attribute.String;
    industry: Schema.Attribute.String;
    last_contact_at: Schema.Attribute.DateTime;
    lifecycle: Schema.Attribute.Enumeration<
      ['prospect', 'active', 'dormant', 'closed']
    > &
      Schema.Attribute.DefaultTo<'prospect'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-client-profile.crm-client-profile'
    > &
      Schema.Attribute.Private;
    merged_into: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-client-profile.crm-client-profile'
    >;
    notes: Schema.Attribute.Text;
    parent: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-client-profile.crm-client-profile'
    >;
    publishedAt: Schema.Attribute.DateTime;
    region: Schema.Attribute.String;
    source: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmCommissionDisputeCrmCommissionDispute
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_commission_disputes';
  info: {
    displayName: 'CRM Commission Dispute';
    pluralName: 'crm-commission-disputes';
    singularName: 'crm-commission-dispute';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    claimant: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decided_at: Schema.Attribute.DateTime;
    decided_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    decision: Schema.Attribute.Text;
    entry: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-commission-entry.crm-commission-entry'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-commission-dispute.crm-commission-dispute'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    reason: Schema.Attribute.Text;
    state: Schema.Attribute.Enumeration<['open', 'upheld', 'rejected']> &
      Schema.Attribute.DefaultTo<'open'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmCommissionEntryCrmCommissionEntry
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_commission_entries';
  info: {
    displayName: 'CRM Commission Entry';
    pluralName: 'crm-commission-entries';
    singularName: 'crm-commission-entry';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    approved_at: Schema.Attribute.DateTime;
    approved_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    basis_amount: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    eligible_amount: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    line_contributor: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-line-contributor.crm-line-contributor'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-commission-entry.crm-commission-entry'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.String;
    paid_amount: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    paid_at: Schema.Attribute.DateTime;
    period: Schema.Attribute.String;
    policy: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-commission-policy.crm-commission-policy'
    >;
    proposal_line: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-line.crm-proposal-line'
    >;
    publishedAt: Schema.Attribute.DateTime;
    rate: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    role: Schema.Attribute.String;
    rule: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-commission-rule.crm-commission-rule'
    >;
    rule_snapshot: Schema.Attribute.JSON;
    sales_person: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    share_pct: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<100>;
    state: Schema.Attribute.Enumeration<
      ['accrued', 'eligible', 'approved', 'paid', 'reversed']
    > &
      Schema.Attribute.DefaultTo<'accrued'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-version.crm-proposal-version'
    >;
  };
}

export interface ApiCrmCommissionPolicyCrmCommissionPolicy
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_commission_policies';
  info: {
    displayName: 'CRM Commission Policy';
    pluralName: 'crm-commission-policies';
    singularName: 'crm-commission-policy';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    bad_debt_treatment: Schema.Attribute.Enumeration<['reverse', 'keep']> &
      Schema.Attribute.DefaultTo<'reverse'>;
    basis: Schema.Attribute.Enumeration<['gross', 'net', 'collected']> &
      Schema.Attribute.DefaultTo<'collected'>;
    cancellation_treatment: Schema.Attribute.Enumeration<['reverse', 'keep']> &
      Schema.Attribute.DefaultTo<'reverse'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    default_rate: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<5>;
    discount_treatment: Schema.Attribute.Enumeration<
      ['net_of_discount', 'ignore']
    > &
      Schema.Attribute.DefaultTo<'net_of_discount'>;
    effective_from: Schema.Attribute.Date;
    effective_to: Schema.Attribute.Date;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-commission-policy.crm-commission-policy'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    payment_trigger: Schema.Attribute.Enumeration<
      ['acceptance', 'invoiced', 'collected']
    > &
      Schema.Attribute.DefaultTo<'collected'>;
    publishedAt: Schema.Attribute.DateTime;
    rules: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-commission-rule.crm-commission-rule'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version_label: Schema.Attribute.String;
  };
}

export interface ApiCrmCommissionRuleCrmCommissionRule
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_commission_rules';
  info: {
    displayName: 'CRM Commission Rule';
    pluralName: 'crm-commission-rules';
    singularName: 'crm-commission-rule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    business_unit: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-business-unit.crm-business-unit'
    >;
    cap: Schema.Attribute.BigInteger;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-commission-rule.crm-commission-rule'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    policy: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-commission-policy.crm-commission-policy'
    >;
    product: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-product.crm-product'
    >;
    publishedAt: Schema.Attribute.DateTime;
    rate: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<5>;
    role: Schema.Attribute.Enumeration<
      [
        'originator',
        'account_lead',
        'product_seller',
        'negotiation_lead',
        'delivery_coordinator',
        'supporting',
        'any',
      ]
    > &
      Schema.Attribute.DefaultTo<'any'>;
    role_weight: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<100>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmContactCrmContact extends Struct.CollectionTypeSchema {
  collectionName: 'crm_contacts';
  info: {
    displayName: 'CRM Contact';
    pluralName: 'crm-contacts';
    singularName: 'crm-contact';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decision_role: Schema.Attribute.Enumeration<
      [
        'decision_maker',
        'influencer',
        'procurement',
        'finance',
        'user',
        'other',
      ]
    > &
      Schema.Attribute.DefaultTo<'other'>;
    department: Schema.Attribute.String;
    designation: Schema.Attribute.String;
    email: Schema.Attribute.Email;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    is_primary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-contact.crm-contact'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmContractAmendmentCrmContractAmendment
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_contract_amendments';
  info: {
    displayName: 'CRM Contract Amendment';
    pluralName: 'crm-contract-amendments';
    singularName: 'crm-contract-amendment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approver: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    contract: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-contract.crm-contract'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    decided_at: Schema.Attribute.DateTime;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-contract-amendment.crm-contract-amendment'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    state: Schema.Attribute.Enumeration<['pending', 'approved', 'rejected']> &
      Schema.Attribute.DefaultTo<'pending'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value_impact: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
  };
}

export interface ApiCrmContractCrmContract extends Struct.CollectionTypeSchema {
  collectionName: 'crm_contracts';
  info: {
    displayName: 'CRM Contract';
    pluralName: 'crm-contracts';
    singularName: 'crm-contract';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attachment: Schema.Attribute.Media<'images' | 'files'>;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    effective_date: Schema.Attribute.Date;
    expiry_date: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-contract.crm-contract'
    > &
      Schema.Attribute.Private;
    payment_terms_days: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    reference: Schema.Attribute.String & Schema.Attribute.Unique;
    renewal_date: Schema.Attribute.Date;
    state: Schema.Attribute.Enumeration<
      ['draft', 'sent', 'signed', 'active', 'expired', 'terminated']
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    version: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-version.crm-proposal-version'
    >;
  };
}

export interface ApiCrmCostEntryCrmCostEntry
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_cost_entries';
  info: {
    displayName: 'CRM Cost Entry';
    pluralName: 'crm-cost-entries';
    singularName: 'crm-cost-entry';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    cost_type: Schema.Attribute.Enumeration<
      ['internal', 'third_party', 'other']
    > &
      Schema.Attribute.DefaultTo<'internal'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entered_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    incurred_on: Schema.Attribute.Date;
    kind: Schema.Attribute.Enumeration<['committed', 'actual']> &
      Schema.Attribute.DefaultTo<'actual'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-cost-entry.crm-cost-entry'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.String;
    procurement_order: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-procurement-order.crm-procurement-order'
    >;
    publishedAt: Schema.Attribute.DateTime;
    source_ref: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workstream: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-workstream.crm-workstream'
    >;
  };
}

export interface ApiCrmDocumentCrmDocument extends Struct.CollectionTypeSchema {
  collectionName: 'crm_documents';
  info: {
    displayName: 'CRM Document';
    pluralName: 'crm-documents';
    singularName: 'crm-document';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    doc_type: Schema.Attribute.Enumeration<
      [
        'lpo',
        'contract',
        'proposal_pdf',
        'acceptance',
        'proof_of_publication',
        'compliance',
        'evidence',
        'invoice',
        'other',
      ]
    > &
      Schema.Attribute.DefaultTo<'other'>;
    file: Schema.Attribute.Media<'images' | 'files'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-document.crm-document'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    record_id: Schema.Attribute.String;
    record_type: Schema.Attribute.String;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    uploaded_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
  };
}

export interface ApiCrmIntegrationLogCrmIntegrationLog
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_integration_logs';
  info: {
    displayName: 'CRM Integration Log';
    pluralName: 'crm-integration-logs';
    singularName: 'crm-integration-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attempts: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    direction: Schema.Attribute.Enumeration<['outbound', 'inbound']> &
      Schema.Attribute.DefaultTo<'outbound'>;
    error: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-integration-log.crm-integration-log'
    > &
      Schema.Attribute.Private;
    outcome: Schema.Attribute.Enumeration<['queued', 'sent', 'ok', 'failed']> &
      Schema.Attribute.DefaultTo<'queued'>;
    payload: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    record_id: Schema.Attribute.String;
    record_type: Schema.Attribute.String;
    response: Schema.Attribute.JSON;
    system: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmInteractionCrmInteraction
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_interactions';
  info: {
    displayName: 'CRM Interaction';
    pluralName: 'crm-interactions';
    singularName: 'crm-interaction';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    contacts: Schema.Attribute.Relation<
      'manyToMany',
      'api::crm-contact.crm-contact'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    kind: Schema.Attribute.Enumeration<
      [
        'call',
        'meeting',
        'email',
        'whatsapp',
        'presentation',
        'note',
        'decision',
        'commitment',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'meeting'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-interaction.crm-interaction'
    > &
      Schema.Attribute.Private;
    logged_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    next_action: Schema.Attribute.String;
    next_action_done: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    next_action_due: Schema.Attribute.Date;
    next_action_owner: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    next_action_type: Schema.Attribute.Enumeration<
      ['send_quote', 'call_back', 'meet_again', 'follow_up', 'none']
    > &
      Schema.Attribute.DefaultTo<'none'>;
    occurred_at: Schema.Attribute.DateTime;
    opportunity: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-opportunity.crm-opportunity'
    >;
    outcome: Schema.Attribute.Enumeration<
      [
        'wants_quote',
        'positive',
        'needs_time',
        'not_interested',
        'no_answer',
        'other',
      ]
    > &
      Schema.Attribute.DefaultTo<'other'>;
    project: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-project.crm-project'
    >;
    publishedAt: Schema.Attribute.DateTime;
    sales_person: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    summary: Schema.Attribute.Text;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmInvoiceCrmInvoice extends Struct.CollectionTypeSchema {
  collectionName: 'crm_invoices';
  info: {
    description: 'Mirror of the finance system invoice. Finance stays the source of truth; the existing CMS invoice can be linked.';
    displayName: 'CRM Invoice (finance mirror)';
    pluralName: 'crm-invoices';
    singularName: 'crm-invoice';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    balance: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    billing_item: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-billing-item.crm-billing-item'
    >;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    cms_invoice: Schema.Attribute.Relation<'manyToOne', 'api::invoice.invoice'>;
    contract: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-contract.crm-contract'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    due_date: Schema.Attribute.Date;
    external_id: Schema.Attribute.String;
    issued_on: Schema.Attribute.Date;
    last_synced_at: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-invoice.crm-invoice'
    > &
      Schema.Attribute.Private;
    lpo: Schema.Attribute.Relation<'manyToOne', 'api::crm-lpo.crm-lpo'>;
    number: Schema.Attribute.String;
    project: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-project.crm-project'
    >;
    publishedAt: Schema.Attribute.DateTime;
    state: Schema.Attribute.Enumeration<
      [
        'requested',
        'issued',
        'part_paid',
        'paid',
        'overdue',
        'cancelled',
        'written_off',
      ]
    > &
      Schema.Attribute.DefaultTo<'requested'>;
    tax: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmLineContributorCrmLineContributor
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_line_contributors';
  info: {
    displayName: 'CRM Line Contributor';
    pluralName: 'crm-line-contributors';
    singularName: 'crm-line-contributor';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    line: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-line.crm-proposal-line'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-line-contributor.crm-line-contributor'
    > &
      Schema.Attribute.Private;
    percentage: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<100>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Enumeration<
      [
        'originator',
        'account_lead',
        'product_seller',
        'negotiation_lead',
        'delivery_coordinator',
        'supporting',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'product_seller'>;
    sales_person: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmLookupCrmLookup extends Struct.CollectionTypeSchema {
  collectionName: 'crm_lookups';
  info: {
    displayName: 'CRM Lookup';
    pluralName: 'crm-lookups';
    singularName: 'crm-lookup';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String;
    list_type: Schema.Attribute.Enumeration<
      [
        'industry',
        'loss_reason',
        'client_category',
        'source',
        'region',
        'document_type',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'industry'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-lookup.crm-lookup'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sort: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ApiCrmLpoCrmLpo extends Struct.CollectionTypeSchema {
  collectionName: 'crm_lpos';
  info: {
    displayName: 'CRM LPO';
    pluralName: 'crm-lpos';
    singularName: 'crm-lpo';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attachment: Schema.Attribute.Media<'images' | 'files'>;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    contract: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-contract.crm-contract'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    discrepancies: Schema.Attribute.JSON;
    issued_on: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-lpo.crm-lpo'
    > &
      Schema.Attribute.Private;
    number: Schema.Attribute.String;
    payment_terms_days: Schema.Attribute.Integer;
    project: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-project.crm-project'
    >;
    publishedAt: Schema.Attribute.DateTime;
    resolution: Schema.Attribute.Enumeration<
      ['none', 'accept_lpo_terms', 'amend_requested', 'exception']
    > &
      Schema.Attribute.DefaultTo<'none'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    uploaded_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    valid_until: Schema.Attribute.Date;
    value: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    verification: Schema.Attribute.Enumeration<
      ['pending', 'verified', 'mismatch', 'exception_approved']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    version: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-version.crm-proposal-version'
    >;
  };
}

export interface ApiCrmMilestoneCrmMilestone
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_milestones';
  info: {
    displayName: 'CRM Milestone';
    pluralName: 'crm-milestones';
    singularName: 'crm-milestone';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    actual_date: Schema.Attribute.Date;
    baseline_date: Schema.Attribute.Date;
    billing_amount: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    evidence_note: Schema.Attribute.Text;
    is_billing_trigger: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-milestone.crm-milestone'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    revised_date: Schema.Attribute.Date;
    state: Schema.Attribute.Enumeration<['pending', 'done', 'missed']> &
      Schema.Attribute.DefaultTo<'pending'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workstream: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-workstream.crm-workstream'
    >;
  };
}

export interface ApiCrmNotificationCrmNotification
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_notifications';
  info: {
    displayName: 'CRM Notification';
    pluralName: 'crm-notifications';
    singularName: 'crm-notification';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    body: Schema.Attribute.Text;
    channel: Schema.Attribute.Enumeration<
      ['in_app', 'email', 'sms', 'whatsapp']
    > &
      Schema.Attribute.DefaultTo<'in_app'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    delivery: Schema.Attribute.Enumeration<
      ['pending', 'sent', 'failed', 'skipped']
    > &
      Schema.Attribute.DefaultTo<'sent'>;
    event: Schema.Attribute.String;
    is_read: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    link: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-notification.crm-notification'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    recipient: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmOpportunityContributorCrmOpportunityContributor
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_opp_contributors';
  info: {
    displayName: 'CRM Opportunity Contributor';
    pluralName: 'crm-opportunity-contributors';
    singularName: 'crm-opportunity-contributor';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    business_unit: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-business-unit.crm-business-unit'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    expected_products: Schema.Attribute.Relation<
      'manyToMany',
      'api::crm-product.crm-product'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-opportunity-contributor.crm-opportunity-contributor'
    > &
      Schema.Attribute.Private;
    opportunity: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-opportunity.crm-opportunity'
    >;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Enumeration<
      [
        'originator',
        'account_lead',
        'product_seller',
        'negotiation_lead',
        'delivery_coordinator',
        'supporting',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'supporting'>;
    sales_person: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    state: Schema.Attribute.Enumeration<['invited', 'active', 'removed']> &
      Schema.Attribute.DefaultTo<'active'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmOpportunityCrmOpportunity
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_opportunities';
  info: {
    displayName: 'CRM Opportunity';
    pluralName: 'crm-opportunities';
    singularName: 'crm-opportunity';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    contributors: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-opportunity-contributor.crm-opportunity-contributor'
    >;
    created_by_profile: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'UGX'>;
    decision_date: Schema.Attribute.Date;
    expected_cost: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    expected_revenue: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    interest_products: Schema.Attribute.Relation<
      'manyToMany',
      'api::crm-product.crm-product'
    >;
    is_archived: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    last_activity_at: Schema.Attribute.DateTime;
    lead_sales_person: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-opportunity.crm-opportunity'
    > &
      Schema.Attribute.Private;
    loss_reason: Schema.Attribute.String;
    lost_at: Schema.Attribute.DateTime;
    next_action: Schema.Attribute.String;
    next_action_due: Schema.Attribute.Date;
    overlap_flag: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    overlap_resolution: Schema.Attribute.Enumeration<
      ['none', 'lead_set', 'separate', 'merged']
    > &
      Schema.Attribute.DefaultTo<'none'>;
    probability: Schema.Attribute.Integer;
    probability_override: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    publishedAt: Schema.Attribute.DateTime;
    requirements: Schema.Attribute.Text;
    size_band: Schema.Attribute.Enumeration<
      ['under_10m', 'between_10m_50m', 'over_50m']
    >;
    source: Schema.Attribute.Enumeration<
      ['phone', 'desktop', 'quick_create', 'import', 'referral', 'web', 'other']
    > &
      Schema.Attribute.DefaultTo<'desktop'>;
    stage: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-pipeline-stage.crm-pipeline-stage'
    >;
    state: Schema.Attribute.Enumeration<['open', 'won', 'lost']> &
      Schema.Attribute.DefaultTo<'open'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    won_at: Schema.Attribute.DateTime;
  };
}

export interface ApiCrmPaymentCrmPayment extends Struct.CollectionTypeSchema {
  collectionName: 'crm_payments';
  info: {
    displayName: 'CRM Payment (finance mirror)';
    pluralName: 'crm-payments';
    singularName: 'crm-payment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    external_id: Schema.Attribute.String;
    invoice: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-invoice.crm-invoice'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-payment.crm-payment'
    > &
      Schema.Attribute.Private;
    method: Schema.Attribute.Enumeration<
      ['bank', 'mobile_money', 'cheque', 'cash', 'offset', 'other']
    > &
      Schema.Attribute.DefaultTo<'bank'>;
    paid_on: Schema.Attribute.Date;
    publishedAt: Schema.Attribute.DateTime;
    reference: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmPipelineStageCrmPipelineStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_pipeline_stages';
  info: {
    description: 'The 15 configurable stages. simple_step maps each to the 4 steps salespeople see.';
    displayName: 'CRM Pipeline Stage';
    pluralName: 'crm-pipeline-stages';
    singularName: 'crm-pipeline-stage';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    default_probability: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<10>;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    is_lost: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    is_won: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-pipeline-stage.crm-pipeline-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    position: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    required_evidence: Schema.Attribute.JSON;
    simple_step: Schema.Attribute.Enumeration<
      ['talking', 'quoting', 'waiting', 'won', 'lost']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'talking'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmPriceRuleCrmPriceRule
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_price_rules';
  info: {
    displayName: 'CRM Price Rule';
    pluralName: 'crm-price-rules';
    singularName: 'crm-price-rule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    conditions: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-price-rule.crm-price-rule'
    > &
      Schema.Attribute.Private;
    min_quantity: Schema.Attribute.Decimal;
    name: Schema.Attribute.String;
    price: Schema.Attribute.BigInteger;
    product: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-product.crm-product'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    valid_from: Schema.Attribute.Date;
    valid_to: Schema.Attribute.Date;
  };
}

export interface ApiCrmProcurementOrderCrmProcurementOrder
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_procurement_orders';
  info: {
    displayName: 'CRM Procurement Order';
    pluralName: 'crm-procurement-orders';
    singularName: 'crm-procurement-order';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    cost: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    delivery_confirmed: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    delivery_confirmed_at: Schema.Attribute.DateTime;
    external_ref: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-procurement-order.crm-procurement-order'
    > &
      Schema.Attribute.Private;
    proposal_line: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-line.crm-proposal-line'
    >;
    provider: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-provider.crm-provider'
    >;
    publishedAt: Schema.Attribute.DateTime;
    reference: Schema.Attribute.String;
    state: Schema.Attribute.Enumeration<
      [
        'draft',
        'approved',
        'ordered',
        'delivered',
        'invoiced',
        'paid',
        'cancelled',
      ]
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workstream: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-workstream.crm-workstream'
    >;
  };
}

export interface ApiCrmProductCrmProduct extends Struct.CollectionTypeSchema {
  collectionName: 'crm_products';
  info: {
    displayName: 'CRM Product';
    pluralName: 'crm-products';
    singularName: 'crm-product';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    business_unit: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-business-unit.crm-business-unit'
    >;
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    default_duration_type: Schema.Attribute.Enumeration<
      ['one_off', 'fixed_term', 'long_running']
    > &
      Schema.Attribute.DefaultTo<'fixed_term'>;
    default_quantity: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<1>;
    deliverables: Schema.Attribute.Text;
    description: Schema.Attribute.Text;
    floor_price: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    list_price: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-product.crm-product'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    package_note: Schema.Attribute.String;
    preferred_provider: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-provider.crm-provider'
    >;
    product_type: Schema.Attribute.Enumeration<['internal', 'third_party']> &
      Schema.Attribute.DefaultTo<'internal'>;
    publishedAt: Schema.Attribute.DateTime;
    requires_approval: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    short_label: Schema.Attribute.String;
    standard_cost: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    tax_rate: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<18>;
    unit: Schema.Attribute.Enumeration<
      [
        'spot',
        'insertion',
        'slot',
        'day',
        'week',
        'month',
        'event',
        'item',
        'package',
      ]
    > &
      Schema.Attribute.DefaultTo<'package'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmProfileCrmProfile extends Struct.CollectionTypeSchema {
  collectionName: 'crm_profiles';
  info: {
    description: 'Links a CRM user (VGAMS sales person and/or VGAMS staff user, or a users-permissions login) to a CRM role. The existing VGAMS collections are never modified.';
    displayName: 'CRM Profile';
    pluralName: 'crm-profiles';
    singularName: 'crm-profile';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    business_unit: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-business-unit.crm-business-unit'
    >;
    commission_eligible: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    crm_role: Schema.Attribute.Enumeration<
      [
        'salesperson',
        'product_manager',
        'supervisor',
        'senior_manager',
        'executive',
        'project_manager',
        'finance',
        'procurement',
        'admin',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'salesperson'>;
    discount_authority_pct: Schema.Attribute.Decimal &
      Schema.Attribute.DefaultTo<5>;
    display_name: Schema.Attribute.String;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-profile.crm-profile'
    > &
      Schema.Attribute.Private;
    monthly_target: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    sales_person: Schema.Attribute.Relation<
      'oneToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    team: Schema.Attribute.Relation<'manyToOne', 'api::crm-team.crm-team'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    user: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    >;
    vgams_user: Schema.Attribute.Relation<
      'oneToOne',
      'api::vgams-user.vgams-user'
    >;
  };
}

export interface ApiCrmProjectContactCrmProjectContact
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_project_contacts';
  info: {
    displayName: 'CRM Project Contact';
    pluralName: 'crm-project-contacts';
    singularName: 'crm-project-contact';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    contact: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-contact.crm-contact'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-project-contact.crm-project-contact'
    > &
      Schema.Attribute.Private;
    project: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-project.crm-project'
    >;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Enumeration<
      ['coordinator', 'approver', 'finance', 'delivery_recipient']
    > &
      Schema.Attribute.DefaultTo<'coordinator'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmProjectCrmProject extends Struct.CollectionTypeSchema {
  collectionName: 'crm_projects';
  info: {
    displayName: 'CRM Project';
    pluralName: 'crm-projects';
    singularName: 'crm-project';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    budget: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    closed_at: Schema.Attribute.DateTime;
    closure_reason: Schema.Attribute.Text;
    contract: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-contract.crm-contract'
    >;
    contracted_value: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    end_date: Schema.Attribute.Date;
    health: Schema.Attribute.Enumeration<['on_track', 'at_risk', 'off_track']> &
      Schema.Attribute.DefaultTo<'on_track'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-project.crm-project'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    opportunity: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-opportunity.crm-opportunity'
    >;
    project_manager: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    publishedAt: Schema.Attribute.DateTime;
    start_date: Schema.Attribute.Date;
    state: Schema.Attribute.Enumeration<
      ['planned', 'active', 'on_hold', 'completed', 'cancelled']
    > &
      Schema.Attribute.DefaultTo<'active'>;
    state_overridden: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-version.crm-proposal-version'
    >;
    workstreams: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-workstream.crm-workstream'
    >;
  };
}

export interface ApiCrmProposalLineCrmProposalLine
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_proposal_lines';
  info: {
    displayName: 'CRM Proposal Line';
    pluralName: 'crm-proposal-lines';
    singularName: 'crm-proposal-line';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    allocated_discount: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    business_unit: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-business-unit.crm-business-unit'
    >;
    contributors: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-line-contributor.crm-line-contributor'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    duration_type: Schema.Attribute.Enumeration<
      ['one_off', 'fixed_term', 'long_running']
    > &
      Schema.Attribute.DefaultTo<'fixed_term'>;
    end_date: Schema.Attribute.Date;
    internal_cost: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    line_discount: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    list_price: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-proposal-line.crm-proposal-line'
    > &
      Schema.Attribute.Private;
    net_price: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    other_cost: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    product: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-product.crm-product'
    >;
    provider: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-provider.crm-provider'
    >;
    publishedAt: Schema.Attribute.DateTime;
    quantity: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<1>;
    selling_price: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    sort: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    start_date: Schema.Attribute.Date;
    third_party_cost: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    unit_price: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-version.crm-proposal-version'
    >;
  };
}

export interface ApiCrmProposalVersionCrmProposalVersion
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_proposal_versions';
  info: {
    description: 'Immutable once submitted. Revisions are new versions.';
    displayName: 'CRM Proposal Version';
    pluralName: 'crm-proposal-versions';
    singularName: 'crm-proposal-version';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    acceptance_evidence: Schema.Attribute.Media<'images' | 'files'>;
    accepted_at: Schema.Attribute.DateTime;
    accepted_by_contact: Schema.Attribute.String;
    allocation_method: Schema.Attribute.Enumeration<
      ['selling_price', 'contribution', 'manual']
    > &
      Schema.Attribute.DefaultTo<'selling_price'>;
    approvals: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-approval-request.crm-approval-request'
    >;
    auto_submit_on_approval: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    change_reason: Schema.Attribute.Text;
    change_summary: Schema.Attribute.JSON;
    contribution_total: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    cost_total: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    created_by_profile: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'UGX'>;
    discount_pct: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    discount_total: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    executive_summary: Schema.Attribute.Text;
    frozen_snapshot: Schema.Attribute.JSON;
    is_frozen: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    lines: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-proposal-line.crm-proposal-line'
    >;
    list_total: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-proposal-version.crm-proposal-version'
    > &
      Schema.Attribute.Private;
    margin_pct: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    net_total: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    package_price: Schema.Attribute.BigInteger;
    payment_terms_days: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<30>;
    pdf: Schema.Attribute.Media<'images' | 'files'>;
    previous_version: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-version.crm-proposal-version'
    >;
    proposal: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal.crm-proposal'
    >;
    publishedAt: Schema.Attribute.DateTime;
    requirements: Schema.Attribute.Text;
    selling_total: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    solution: Schema.Attribute.Text;
    state: Schema.Attribute.Enumeration<
      [
        'draft',
        'in_review',
        'approved',
        'submitted',
        'accepted',
        'superseded',
        'rejected',
        'withdrawn',
      ]
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    submitted_at: Schema.Attribute.DateTime;
    terms: Schema.Attribute.Text;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    valid_until: Schema.Attribute.Date;
    version_number: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

export interface ApiCrmProposalCrmProposal extends Struct.CollectionTypeSchema {
  collectionName: 'crm_proposals';
  info: {
    displayName: 'CRM Proposal';
    pluralName: 'crm-proposals';
    singularName: 'crm-proposal';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    accepted_version: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-version.crm-proposal-version'
    >;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    current_version: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-proposal-version.crm-proposal-version'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-proposal.crm-proposal'
    > &
      Schema.Attribute.Private;
    lock_token: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    opportunity: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-opportunity.crm-opportunity'
    >;
    owner: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    publishedAt: Schema.Attribute.DateTime;
    reference: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    sales_person: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    state: Schema.Attribute.Enumeration<
      [
        'draft',
        'in_review',
        'approved',
        'submitted',
        'negotiating',
        'accepted',
        'rejected',
        'expired',
      ]
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    title: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    versions: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-proposal-version.crm-proposal-version'
    >;
  };
}

export interface ApiCrmProviderCrmProvider extends Struct.CollectionTypeSchema {
  collectionName: 'crm_providers';
  info: {
    displayName: 'CRM Provider';
    pluralName: 'crm-providers';
    singularName: 'crm-provider';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    approval_state: Schema.Attribute.Enumeration<
      ['pending', 'approved', 'suspended', 'rejected']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    compliance_expiry: Schema.Attribute.Date;
    contact_name: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    documents: Schema.Attribute.Media<'images' | 'files', true>;
    email: Schema.Attribute.Email;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-provider.crm-provider'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    notes: Schema.Attribute.Text;
    performance_rating: Schema.Attribute.Integer;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    services: Schema.Attribute.Text;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmRecurringRuleCrmRecurringRule
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_recurring_rules';
  info: {
    displayName: 'CRM Recurring Rule';
    pluralName: 'crm-recurring-rules';
    singularName: 'crm-recurring-rule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assignee: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    day_of_month: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<1>;
    end_date: Schema.Attribute.Date;
    frequency: Schema.Attribute.Enumeration<
      ['weekly', 'monthly', 'quarterly']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'monthly'>;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    last_generated_for: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-recurring-rule.crm-recurring-rule'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    start_date: Schema.Attribute.Date;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workstream: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-workstream.crm-workstream'
    >;
  };
}

export interface ApiCrmRequiredDocumentRuleCrmRequiredDocumentRule
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_required_doc_rules';
  info: {
    displayName: 'CRM Required Document Rule';
    pluralName: 'crm-required-document-rules';
    singularName: 'crm-required-document-rule';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    applies_to: Schema.Attribute.Enumeration<
      ['stage', 'billing', 'project_start', 'project_close']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'stage'>;
    blocks: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    document_types: Schema.Attribute.JSON;
    exception_allowed: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-required-document-rule.crm-required-document-rule'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    stage: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-pipeline-stage.crm-pipeline-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmSettingCrmSetting extends Struct.SingleTypeSchema {
  collectionName: 'crm_settings';
  info: {
    description: 'Global CRM settings.';
    displayName: 'CRM Settings';
    pluralName: 'crm-settings';
    singularName: 'crm-setting';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    cold_after_days: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<30>;
    company_name: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Vision Group'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'UGX'>;
    default_allocation_method: Schema.Attribute.Enumeration<
      ['selling_price', 'contribution', 'manual']
    > &
      Schema.Attribute.DefaultTo<'selling_price'>;
    heavy_load_clients: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<8>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-setting.crm-setting'
    > &
      Schema.Attribute.Private;
    min_margin_pct: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<35>;
    publishedAt: Schema.Attribute.DateTime;
    quote_validity_days: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<14>;
    reminder_days_before_expiry: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<2>;
    salesperson_discount_limit_pct: Schema.Attribute.Decimal &
      Schema.Attribute.DefaultTo<5>;
    standard_payment_terms_days: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<30>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmStageHistoryCrmStageHistory
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_stage_histories';
  info: {
    displayName: 'CRM Stage History';
    pluralName: 'crm-stage-histories';
    singularName: 'crm-stage-history';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    changed_at: Schema.Attribute.DateTime;
    changed_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    from_stage: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-pipeline-stage.crm-pipeline-stage'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-stage-history.crm-stage-history'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.String;
    opportunity: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-opportunity.crm-opportunity'
    >;
    publishedAt: Schema.Attribute.DateTime;
    to_stage: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-pipeline-stage.crm-pipeline-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmTargetCrmTarget extends Struct.CollectionTypeSchema {
  collectionName: 'crm_targets';
  info: {
    displayName: 'CRM Target';
    pluralName: 'crm-targets';
    singularName: 'crm-target';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    business_unit: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-business-unit.crm-business-unit'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-target.crm-target'
    > &
      Schema.Attribute.Private;
    period_end: Schema.Attribute.Date;
    period_start: Schema.Attribute.Date;
    product: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-product.crm-product'
    >;
    profile: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    publishedAt: Schema.Attribute.DateTime;
    sales_person: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    team: Schema.Attribute.Relation<'manyToOne', 'api::crm-team.crm-team'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmTaskCrmTask extends Struct.CollectionTypeSchema {
  collectionName: 'crm_tasks';
  info: {
    displayName: 'CRM Task';
    pluralName: 'crm-tasks';
    singularName: 'crm-task';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assignee: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    completed_at: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    depends_on: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-task.crm-task'
    >;
    description: Schema.Attribute.Text;
    due_date: Schema.Attribute.Date;
    evidence_note: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-task.crm-task'
    > &
      Schema.Attribute.Private;
    priority: Schema.Attribute.Enumeration<
      ['low', 'normal', 'high', 'urgent']
    > &
      Schema.Attribute.DefaultTo<'normal'>;
    project: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-project.crm-project'
    >;
    publishedAt: Schema.Attribute.DateTime;
    recurring_rule: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-recurring-rule.crm-recurring-rule'
    >;
    start_date: Schema.Attribute.Date;
    state: Schema.Attribute.Enumeration<
      [
        'pending',
        'in_progress',
        'awaiting_approval',
        'blocked',
        'completed',
        'cancelled',
      ]
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    supporters: Schema.Attribute.Relation<
      'manyToMany',
      'api::crm-profile.crm-profile'
    >;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workstream: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-workstream.crm-workstream'
    >;
  };
}

export interface ApiCrmTeamCrmTeam extends Struct.CollectionTypeSchema {
  collectionName: 'crm_teams';
  info: {
    displayName: 'CRM Team';
    pluralName: 'crm-teams';
    singularName: 'crm-team';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    business_unit: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-business-unit.crm-business-unit'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-team.crm-team'
    > &
      Schema.Attribute.Private;
    members: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-profile.crm-profile'
    >;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    region: Schema.Attribute.String;
    supervisor: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCrmWorkstreamCrmWorkstream
  extends Struct.CollectionTypeSchema {
  collectionName: 'crm_workstreams';
  info: {
    displayName: 'CRM Workstream';
    pluralName: 'crm-workstreams';
    singularName: 'crm-workstream';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    actual_cost: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    actual_end: Schema.Attribute.Date;
    actual_start: Schema.Attribute.Date;
    allocated_revenue: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    budget: Schema.Attribute.BigInteger & Schema.Attribute.DefaultTo<'0'>;
    committed_cost: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    completion_evidence: Schema.Attribute.Media<'images' | 'files', true>;
    completion_note: Schema.Attribute.Text;
    cost_entries: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-cost-entry.crm-cost-entry'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    duration_type: Schema.Attribute.Enumeration<
      ['one_off', 'fixed_term', 'long_running']
    > &
      Schema.Attribute.DefaultTo<'fixed_term'>;
    forecast_cost: Schema.Attribute.BigInteger &
      Schema.Attribute.DefaultTo<'0'>;
    is_required: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-workstream.crm-workstream'
    > &
      Schema.Attribute.Private;
    milestones: Schema.Attribute.Relation<
      'oneToMany',
      'api::crm-milestone.crm-milestone'
    >;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    owner: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-profile.crm-profile'
    >;
    planned_end: Schema.Attribute.Date;
    planned_start: Schema.Attribute.Date;
    product: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-product.crm-product'
    >;
    project: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-project.crm-project'
    >;
    proposal_lines: Schema.Attribute.Relation<
      'manyToMany',
      'api::crm-proposal-line.crm-proposal-line'
    >;
    provider: Schema.Attribute.Relation<
      'manyToOne',
      'api::crm-provider.crm-provider'
    >;
    publishedAt: Schema.Attribute.DateTime;
    state: Schema.Attribute.Enumeration<
      ['pending', 'in_progress', 'blocked', 'completed', 'cancelled']
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    tasks: Schema.Attribute.Relation<'oneToMany', 'api::crm-task.crm-task'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiDepartmentDepartment extends Struct.CollectionTypeSchema {
  collectionName: 'departments';
  info: {
    displayName: 'Asset Management Department';
    pluralName: 'departments';
    singularName: 'department';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    department_id: Schema.Attribute.UID & Schema.Attribute.Required;
    department_name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::department.department'
    > &
      Schema.Attribute.Private;
    offices: Schema.Attribute.Relation<'oneToMany', 'api::office.office'>;
    publishedAt: Schema.Attribute.DateTime;
    staff: Schema.Attribute.Relation<
      'oneToMany',
      'api::staff-table.staff-table'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiDesignBatchDesignBatch extends Struct.CollectionTypeSchema {
  collectionName: 'design_batches';
  info: {
    displayName: 'CIO Design Batch';
    pluralName: 'design-batches';
    singularName: 'design-batch';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    adverts: Schema.Attribute.Relation<'manyToMany', 'api::advert.advert'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    daily_schedules: Schema.Attribute.Relation<
      'manyToMany',
      'api::advert-daily-schedule.advert-daily-schedule'
    >;
    designer: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-user.vgams-user'
    >;
    file_groups: Schema.Attribute.Component<'design-batch.file-group', true>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::design-batch.design-batch'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    reference_number: Schema.Attribute.UID<'label'>;
    status: Schema.Attribute.Enumeration<
      ['draft', 'ready', 'attached', 'archived']
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    target_run_date: Schema.Attribute.Date & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiDesignFileDesignFile extends Struct.CollectionTypeSchema {
  collectionName: 'design_files';
  info: {
    displayName: 'CIO Design File';
    pluralName: 'design-files';
    singularName: 'design-file';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    advert: Schema.Attribute.Relation<'manyToOne', 'api::advert.advert'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'> &
      Schema.Attribute.Required;
    file_name: Schema.Attribute.String & Schema.Attribute.Required;
    file_type: Schema.Attribute.Enumeration<
      ['design', 'brief', 'reference', 'final']
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::design-file.design-file'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    upload_date: Schema.Attribute.DateTime & Schema.Attribute.Required;
    uploaded_by: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    version: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<1>;
  };
}

export interface ApiDistrictDistrict extends Struct.CollectionTypeSchema {
  collectionName: 'districts';
  info: {
    description: 'Administrative districts';
    displayName: 'District';
    pluralName: 'districts';
    singularName: 'district';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    enumeration_areas: Schema.Attribute.Relation<
      'oneToMany',
      'api::enumeration-area.enumeration-area'
    >;
    latlong: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::district.district'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    region: Schema.Attribute.Relation<'manyToOne', 'api::region.region'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEnumerationAreaEnumerationArea
  extends Struct.CollectionTypeSchema {
  collectionName: 'enumeration_areas';
  info: {
    description: 'Enumeration Areas (EA)';
    displayName: 'Enumeration Area';
    pluralName: 'enumeration-areas';
    singularName: 'enumeration-area';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    district: Schema.Attribute.Relation<'manyToOne', 'api::district.district'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::enumeration-area.enumeration-area'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    sub_counties: Schema.Attribute.Relation<
      'oneToMany',
      'api::sub-county.sub-county'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiInvoiceInvoice extends Struct.CollectionTypeSchema {
  collectionName: 'invoices';
  info: {
    displayName: 'CIO Invoice';
    pluralName: 'invoices';
    singularName: 'invoice';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    advert: Schema.Attribute.Relation<'oneToOne', 'api::advert.advert'>;
    amount_paid: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    balance: Schema.Attribute.Decimal & Schema.Attribute.Required;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'UGX'>;
    due_date: Schema.Attribute.Date & Schema.Attribute.Required;
    invoice_date: Schema.Attribute.Date & Schema.Attribute.Required;
    invoice_number: Schema.Attribute.UID<'client'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::invoice.invoice'
    > &
      Schema.Attribute.Private;
    payment_status: Schema.Attribute.Enumeration<
      ['unpaid', 'partial', 'paid', 'overdue']
    > &
      Schema.Attribute.DefaultTo<'unpaid'>;
    payments: Schema.Attribute.Relation<'oneToMany', 'api::payment.payment'>;
    publishedAt: Schema.Attribute.DateTime;
    total_amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMarketSectorMarketSector
  extends Struct.CollectionTypeSchema {
  collectionName: 'market_sectors';
  info: {
    displayName: 'CIO Market Sector';
    pluralName: 'market-sectors';
    singularName: 'market-sector';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::market-sector.market-sector'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOfficeLocationOfficeLocation
  extends Struct.CollectionTypeSchema {
  collectionName: 'office_locations';
  info: {
    displayName: 'CIO Office Location';
    pluralName: 'office-locations';
    singularName: 'office-location';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    bc_code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::office-location.office-location'
    > &
      Schema.Attribute.Private;
    office_location: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOfficeOffice extends Struct.CollectionTypeSchema {
  collectionName: 'offices';
  info: {
    displayName: 'Asset Management Office';
    pluralName: 'offices';
    singularName: 'office';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    company_assets: Schema.Attribute.Relation<
      'oneToMany',
      'api::company-asset.company-asset'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    department: Schema.Attribute.Relation<
      'manyToOne',
      'api::department.department'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::office.office'
    > &
      Schema.Attribute.Private;
    location: Schema.Attribute.Text;
    office_id: Schema.Attribute.UID & Schema.Attribute.Required;
    office_name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    staff: Schema.Attribute.Relation<
      'oneToMany',
      'api::staff-table.staff-table'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPagePage extends Struct.CollectionTypeSchema {
  collectionName: 'pages';
  info: {
    category: 'Harvestmoney';
    description: 'WordPress Pages';
    displayName: 'Page';
    pluralName: 'pages';
    singularName: 'page';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'api::page.page'>;
    content: Schema.Attribute.RichText & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    featured_image: Schema.Attribute.Media<'images'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::page.page'> &
      Schema.Attribute.Private;
    menu_order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    parent: Schema.Attribute.Relation<'manyToOne', 'api::page.page'>;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'title'> & Schema.Attribute.Required;
    template: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    wp_id: Schema.Attribute.Integer & Schema.Attribute.Unique;
  };
}

export interface ApiPagerPagePagerPage extends Struct.CollectionTypeSchema {
  collectionName: 'pager_pages';
  info: {
    displayName: 'CIO Pager Page';
    pluralName: 'pager-pages';
    singularName: 'pager-page';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    adverts: Schema.Attribute.Relation<'manyToMany', 'api::advert.advert'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_back_cover: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    is_cover: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::pager-page.pager-page'
    > &
      Schema.Attribute.Private;
    page_number: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    publication: Schema.Attribute.Relation<
      'manyToOne',
      'api::pager-publication.pager-publication'
    >;
    publishedAt: Schema.Attribute.DateTime;
    section: Schema.Attribute.Enumeration<
      [
        'Adverts',
        'Beat',
        'Business',
        'Business Vision',
        'CSI',
        'Case Files',
        'Classified',
        'Comments',
        'Community News',
        'Court',
        'Crocs',
        'Election News',
        'Feature',
        'Green UG',
        'Harvest Money',
        'Health',
        'Her Vision',
        'Homes',
        'International News',
        'JobMart',
        'Leisure',
        'Letters',
        'Lifestyle',
        'Motor Mart',
        'Mwalimu',
        'NIE',
        'National News',
        'New Era',
        'News',
        'OPED',
        'Oil, Gas and Infrastructure',
        'Opportunities',
        'PLE',
        'OLEVEL',
        'ALEVEL',
        'Pakasa',
        'Relationships',
        'Schools',
        'Series',
        'Special Report',
        'Sport',
        'Spotlight',
        'Supplements',
        'Teen Vision',
        'TV and Leisure',
        'The Hot Sport',
        'Weekend Xtra',
        'Muslim News',
        'Back Cover Page',
        'Cover Page',
      ]
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPagerPublicationPagerPublication
  extends Struct.CollectionTypeSchema {
  collectionName: 'pager_publications';
  info: {
    displayName: 'CIO Pager Publication';
    pluralName: 'pager-publications';
    singularName: 'pager-publication';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    created_by_user: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-user.vgams-user'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::pager-publication.pager-publication'
    > &
      Schema.Attribute.Private;
    masthead: Schema.Attribute.Enumeration<['NV', 'BK']> &
      Schema.Attribute.Required;
    notes: Schema.Attribute.Text;
    pages: Schema.Attribute.Relation<'oneToMany', 'api::pager-page.pager-page'>;
    product: Schema.Attribute.Relation<'manyToOne', 'api::product.product'>;
    publication_code: Schema.Attribute.String & Schema.Attribute.Unique;
    publication_date: Schema.Attribute.Date & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    sequence: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    status: Schema.Attribute.Enumeration<
      ['draft', 'in_progress', 'locked', 'published']
    > &
      Schema.Attribute.DefaultTo<'draft'>;
    total_pages: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 24;
        },
        number
      >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiParishParish extends Struct.CollectionTypeSchema {
  collectionName: 'parishes';
  info: {
    description: 'Parishes and wards';
    displayName: 'Parish';
    pluralName: 'parishes';
    singularName: 'parish';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::parish.parish'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    polling_stations: Schema.Attribute.Relation<
      'oneToMany',
      'api::polling-station.polling-station'
    >;
    publishedAt: Schema.Attribute.DateTime;
    sub_county: Schema.Attribute.Relation<
      'manyToOne',
      'api::sub-county.sub-county'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPaymentPayment extends Struct.CollectionTypeSchema {
  collectionName: 'payments';
  info: {
    displayName: 'CIO Payment';
    pluralName: 'payments';
    singularName: 'payment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.Decimal & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    invoice: Schema.Attribute.Relation<'manyToOne', 'api::invoice.invoice'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment.payment'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    payment_date: Schema.Attribute.Date & Schema.Attribute.Required;
    payment_method: Schema.Attribute.Enumeration<
      ['cash', 'bank_transfer', 'cheque', 'mobile_money']
    > &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    receipt_file: Schema.Attribute.Media<'files' | 'images'>;
    reference_number: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vgams_user: Schema.Attribute.Relation<
      'manyToOne',
      'api::vgams-user.vgams-user'
    >;
  };
}

export interface ApiPollingStationPollingStation
  extends Struct.CollectionTypeSchema {
  collectionName: 'polling_stations';
  info: {
    description: 'Voting polling stations';
    displayName: 'Polling Station';
    pluralName: 'polling-stations';
    singularName: 'polling-station';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::polling-station.polling-station'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    parish: Schema.Attribute.Relation<'manyToOne', 'api::parish.parish'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPostPost extends Struct.CollectionTypeSchema {
  collectionName: 'posts';
  info: {
    category: 'Harvestmoney';
    description: 'WordPress Posts';
    displayName: 'Post';
    pluralName: 'posts';
    singularName: 'post';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    album: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    authors: Schema.Attribute.Relation<'manyToMany', 'api::author.author'>;
    breakingDuration: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    breakingNews: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    categories: Schema.Attribute.Relation<
      'manyToMany',
      'api::category.category'
    >;
    content: Schema.Attribute.RichText & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    excerpt: Schema.Attribute.Text;
    featured: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    featured_image: Schema.Attribute.Media<
      'images' | 'videos' | 'audios' | 'files'
    >;
    isPremium: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    live: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::post.post'> &
      Schema.Attribute.Private;
    publication: Schema.Attribute.Relation<
      'manyToMany',
      'api::publication.publication'
    >;
    publishedAt: Schema.Attribute.DateTime;
    secondaryCategory: Schema.Attribute.Integer;
    seo_description: Schema.Attribute.Text;
    seo_title: Schema.Attribute.String;
    slug: Schema.Attribute.UID<'title'> & Schema.Attribute.Required;
    tags: Schema.Attribute.Relation<'manyToMany', 'api::tag.tag'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    view_status: Schema.Attribute.Enumeration<
      ['draft', 'published', 'deleted']
    >;
    views: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    wp_id: Schema.Attribute.Integer & Schema.Attribute.Unique;
    wp_published_at: Schema.Attribute.DateTime;
  };
}

export interface ApiProductCategoryProductCategory
  extends Struct.CollectionTypeSchema {
  collectionName: 'product_categories';
  info: {
    displayName: 'CIO Product Category';
    pluralName: 'product-categories';
    singularName: 'product-category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    category_name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    category_type: Schema.Attribute.Enumeration<
      ['print', 'tv', 'radio', 'digital', 'outdoor', 'publishing', 'commercial']
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::product-category.product-category'
    > &
      Schema.Attribute.Private;
    product_id: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    products: Schema.Attribute.Relation<'oneToMany', 'api::product.product'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiProductProduct extends Struct.CollectionTypeSchema {
  collectionName: 'products';
  info: {
    displayName: 'CIO Product';
    pluralName: 'products';
    singularName: 'product';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    category: Schema.Attribute.Relation<
      'manyToOne',
      'api::product-category.product-category'
    >;
    circulation: Schema.Attribute.Integer;
    cost_stream: Schema.Attribute.Relation<
      'manyToOne',
      'api::cost-stream.cost-stream'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.RichText;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::product.product'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    product_id: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    product_name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    rate_cards: Schema.Attribute.Relation<
      'oneToMany',
      'api::rate-card.rate-card'
    >;
    readership: Schema.Attribute.Integer;
    revenue_stream: Schema.Attribute.Relation<
      'manyToOne',
      'api::revenue-stream.revenue-stream'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPublicationPublication extends Struct.CollectionTypeSchema {
  collectionName: 'publications';
  info: {
    displayName: 'Publication';
    pluralName: 'publications';
    singularName: 'publication';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    authors: Schema.Attribute.Relation<'manyToMany', 'api::author.author'>;
    categories: Schema.Attribute.Relation<
      'manyToMany',
      'api::category.category'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::publication.publication'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    posts: Schema.Attribute.Relation<'manyToMany', 'api::post.post'>;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiRateCardRateCard extends Struct.CollectionTypeSchema {
  collectionName: 'rate_cards';
  info: {
    displayName: 'CIO Rate Card';
    pluralName: 'rate-cards';
    singularName: 'rate-card';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    ad_type: Schema.Attribute.String & Schema.Attribute.Required;
    base_unit_of_measure: Schema.Attribute.String;
    black_color_no: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'UGX'>;
    duration: Schema.Attribute.String;
    effective_date: Schema.Attribute.Date & Schema.Attribute.Required;
    expiry_date: Schema.Attribute.Date;
    full_color_no: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::rate-card.rate-card'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    price_bw: Schema.Attribute.Decimal;
    price_fc: Schema.Attribute.Decimal;
    product: Schema.Attribute.Relation<'manyToOne', 'api::product.product'>;
    publishedAt: Schema.Attribute.DateTime;
    size_dimension: Schema.Attribute.String;
    surcharge_percentage: Schema.Attribute.Decimal;
    time_slot: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiRegionRegion extends Struct.CollectionTypeSchema {
  collectionName: 'regions';
  info: {
    description: 'Administrative regions of Uganda';
    displayName: 'Region';
    pluralName: 'regions';
    singularName: 'region';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    districts: Schema.Attribute.Relation<'oneToMany', 'api::district.district'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::region.region'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiRevenueStreamRevenueStream
  extends Struct.CollectionTypeSchema {
  collectionName: 'revenue_streams';
  info: {
    displayName: 'CIO Revenue Stream';
    pluralName: 'revenue-streams';
    singularName: 'revenue-stream';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::revenue-stream.revenue-stream'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    products: Schema.Attribute.Relation<'oneToMany', 'api::product.product'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiScreenScreen extends Struct.CollectionTypeSchema {
  collectionName: 'screens';
  info: {
    description: 'A physical billboard/display. One row per device.';
    displayName: 'Bill Board Screen';
    pluralName: 'screens';
    singularName: 'screen';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    broadcastSources: Schema.Attribute.Relation<
      'oneToMany',
      'api::broadcast-source.broadcast-source'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    height: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<1080>;
    lastSeenAt: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::screen.screen'
    > &
      Schema.Attribute.Private;
    location: Schema.Attribute.String;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    offlineAfter: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 5;
        },
        number
      > &
      Schema.Attribute.DefaultTo<300>;
    pollInterval: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 5;
        },
        number
      > &
      Schema.Attribute.DefaultTo<300>;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    staleAfter: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 5;
        },
        number
      > &
      Schema.Attribute.DefaultTo<60>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    width: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<1920>;
  };
}

export interface ApiSectionsCommissionSectionsCommission
  extends Struct.CollectionTypeSchema {
  collectionName: 'sections_commissions';
  info: {
    displayName: 'CIO Sections Commission';
    pluralName: 'sections-commissions';
    singularName: 'sections-commission';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sections-commission.sections-commission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaActivitySfaActivity extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_activities';
  info: {
    displayName: 'SFA Activity';
    pluralName: 'sfa-activities';
    singularName: 'sfa-activity';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activity_date: Schema.Attribute.DateTime & Schema.Attribute.Required;
    attachments: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-activity.sfa-activity'
    > &
      Schema.Attribute.Private;
    logged_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-agent-profile.sfa-agent-profile'
    >;
    next_followup_date: Schema.Attribute.Date;
    opportunity: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-opportunity.sfa-opportunity'
    >;
    outcome: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    summary: Schema.Attribute.Text & Schema.Attribute.Required;
    type: Schema.Attribute.Enumeration<
      ['call', 'email', 'visit', 'meeting', 'internal_note']
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaAgentProfileSfaAgentProfile
  extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_agent_profiles';
  info: {
    displayName: 'SFA Agent Profile';
    pluralName: 'sfa-agent-profiles';
    singularName: 'sfa-agent-profile';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    employee_code: Schema.Attribute.String;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-agent-profile.sfa-agent-profile'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sfa_role: Schema.Attribute.Enumeration<
      ['sales_agent', 'supervisor', 'manager', 'admin']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'sales_agent'>;
    unit: Schema.Attribute.Relation<'manyToOne', 'api::sfa-unit.sfa-unit'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vgams_sales_person: Schema.Attribute.Relation<
      'oneToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
  };
}

export interface ApiSfaBuyInSfaBuyIn extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_buy_ins';
  info: {
    displayName: 'SFA Buy-In (Catalogue)';
    pluralName: 'sfa-buy-ins';
    singularName: 'sfa-buy-in';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    base_price: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    category: Schema.Attribute.Enumeration<
      [
        'radio_ads',
        'tv_ads',
        'billboard',
        'website_ads',
        'courier',
        'printing',
        'rig_truck',
        'other',
      ]
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-buy-in.sfa-buy-in'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    unit: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaCompanySfaCompany extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_companies';
  info: {
    displayName: 'SFA Prospect Company';
    pluralName: 'sfa-companies';
    singularName: 'sfa-company';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    address: Schema.Attribute.Text;
    company_name: Schema.Attribute.String & Schema.Attribute.Required;
    contact_person: Schema.Attribute.String;
    contacts: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-contact.sfa-contact'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email;
    industry: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-company.sfa-company'
    > &
      Schema.Attribute.Private;
    location: Schema.Attribute.String;
    opportunities: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-opportunity.sfa-opportunity'
    >;
    phone: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaContactSfaContact extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_contacts';
  info: {
    displayName: 'SFA Contact';
    pluralName: 'sfa-contacts';
    singularName: 'sfa-contact';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    company: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-company.sfa-company'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email;
    full_name: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-contact.sfa-contact'
    > &
      Schema.Attribute.Private;
    opportunities: Schema.Attribute.Relation<
      'manyToMany',
      'api::sfa-opportunity.sfa-opportunity'
    >;
    phone: Schema.Attribute.String;
    position: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaOpportunityBuyInSfaOpportunityBuyIn
  extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_opportunity_buy_ins';
  info: {
    displayName: 'SFA Opportunity Buy-In Line';
    pluralName: 'sfa-opportunity-buy-ins';
    singularName: 'sfa-opportunity-buy-in';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    buy_in: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-buy-in.sfa-buy-in'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    custom_offer: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-opportunity-buy-in.sfa-opportunity-buy-in'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    opportunity: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-opportunity.sfa-opportunity'
    >;
    publishedAt: Schema.Attribute.DateTime;
    quantity: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<1>;
    subtotal: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    unit_price: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaOpportunitySfaOpportunity
  extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_opportunities';
  info: {
    displayName: 'SFA Opportunity';
    pluralName: 'sfa-opportunities';
    singularName: 'sfa-opportunity';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activities: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-activity.sfa-activity'
    >;
    buy_in_lines: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-opportunity-buy-in.sfa-opportunity-buy-in'
    >;
    company: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-company.sfa-company'
    >;
    contacts: Schema.Attribute.Relation<
      'manyToMany',
      'api::sfa-contact.sfa-contact'
    >;
    converted_at: Schema.Attribute.DateTime;
    created_by_agent: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-agent-profile.sfa-agent-profile'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    existing_client: Schema.Attribute.Relation<
      'manyToOne',
      'api::client.client'
    >;
    expected_close_date: Schema.Attribute.Date;
    expected_value: Schema.Attribute.Decimal;
    funnel_stage: Schema.Attribute.Enumeration<
      [
        'opportunity_created',
        'contact_engaged',
        'requirement_defined',
        'quotation_created',
        'quotation_sent',
        'negotiation',
        'approved',
        'closed_lost',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'opportunity_created'>;
    is_converted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-opportunity.sfa-opportunity'
    > &
      Schema.Attribute.Private;
    order: Schema.Attribute.Relation<'oneToOne', 'api::sfa-order.sfa-order'>;
    publishedAt: Schema.Attribute.DateTime;
    quotations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-quotation.sfa-quotation'
    >;
    source: Schema.Attribute.String;
    status: Schema.Attribute.Enumeration<
      ['new', 'in_progress', 'quotation_sent', 'negotiation', 'won', 'lost']
    > &
      Schema.Attribute.DefaultTo<'new'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaOrderSfaOrder extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_orders';
  info: {
    displayName: 'SFA Order';
    pluralName: 'sfa-orders';
    singularName: 'sfa-order';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    accepted_quotation: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-quotation.sfa-quotation'
    >;
    client: Schema.Attribute.Relation<'manyToOne', 'api::client.client'>;
    client_is_new: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmation_document: Schema.Attribute.Media<'images' | 'files', true>;
    confirmation_type: Schema.Attribute.Enumeration<
      ['lpo', 'email_confirmation', 'signed_quotation']
    > &
      Schema.Attribute.Required;
    converted_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-agent-profile.sfa-agent-profile'
    >;
    converted_date: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-order.sfa-order'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    opportunity: Schema.Attribute.Relation<
      'oneToOne',
      'api::sfa-opportunity.sfa-opportunity'
    >;
    order_number: Schema.Attribute.String & Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['active', 'in_production', 'completed', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaQuotationCommunicationSfaQuotationCommunication
  extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_quotation_communications';
  info: {
    displayName: 'SFA Quotation Communication';
    pluralName: 'sfa-quotation-communications';
    singularName: 'sfa-quotation-communication';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attachments: Schema.Attribute.Media<'images' | 'files', true>;
    channel: Schema.Attribute.Enumeration<
      ['email', 'whatsapp', 'manual', 'other']
    > &
      Schema.Attribute.Required;
    client_response: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-quotation-communication.sfa-quotation-communication'
    > &
      Schema.Attribute.Private;
    negotiation_notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    quotation: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-quotation.sfa-quotation'
    >;
    response_date: Schema.Attribute.DateTime;
    sent_at: Schema.Attribute.DateTime;
    sent_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-agent-profile.sfa-agent-profile'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaQuotationItemSfaQuotationItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_quotation_items';
  info: {
    displayName: 'SFA Quotation Item';
    pluralName: 'sfa-quotation-items';
    singularName: 'sfa-quotation-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    buy_in: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-buy-in.sfa-buy-in'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-quotation-item.sfa-quotation-item'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    quantity: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<1>;
    quotation: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-quotation.sfa-quotation'
    >;
    subtotal: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    unit_price: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSfaQuotationSfaQuotation
  extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_quotations';
  info: {
    displayName: 'SFA Quotation';
    pluralName: 'sfa-quotations';
    singularName: 'sfa-quotation';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    communications: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-quotation-communication.sfa-quotation-communication'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    items: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-quotation-item.sfa-quotation-item'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-quotation.sfa-quotation'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    opportunity: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-opportunity.sfa-opportunity'
    >;
    parent_quotation: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-quotation.sfa-quotation'
    >;
    pdf_document: Schema.Attribute.Media<'files', true>;
    publishedAt: Schema.Attribute.DateTime;
    quotation_number: Schema.Attribute.String & Schema.Attribute.Unique;
    review_comment: Schema.Attribute.Text;
    reviewed_at: Schema.Attribute.DateTime;
    reviewed_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-agent-profile.sfa-agent-profile'
    >;
    status: Schema.Attribute.Enumeration<
      [
        'draft',
        'pending_approval',
        'approved',
        'sent_to_client',
        'revised',
        'rejected',
        'accepted',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    submitted_by: Schema.Attribute.Relation<
      'manyToOne',
      'api::sfa-agent-profile.sfa-agent-profile'
    >;
    total_amount: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<1>;
  };
}

export interface ApiSfaUnitSfaUnit extends Struct.CollectionTypeSchema {
  collectionName: 'sfa_units';
  info: {
    displayName: 'SFA Unit';
    pluralName: 'sfa-units';
    singularName: 'sfa-unit';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    agent_profiles: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-agent-profile.sfa-agent-profile'
    >;
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sfa-unit.sfa-unit'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    supervisor: Schema.Attribute.Relation<
      'oneToOne',
      'api::vgams-sales-person.vgams-sales-person'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiStaffTableStaffTable extends Struct.CollectionTypeSchema {
  collectionName: 'staff_tables';
  info: {
    displayName: 'Asset Management Staff ';
    pluralName: 'staff-tables';
    singularName: 'staff-table';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    access_logs: Schema.Attribute.Relation<
      'oneToMany',
      'api::access-log.access-log'
    >;
    anomalies: Schema.Attribute.Relation<'oneToMany', 'api::anomaly.anomaly'>;
    company_assets: Schema.Attribute.Relation<
      'oneToMany',
      'api::company-asset.company-asset'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    department: Schema.Attribute.Relation<
      'manyToOne',
      'api::department.department'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::staff-table.staff-table'
    > &
      Schema.Attribute.Private;
    office: Schema.Attribute.Relation<'manyToOne', 'api::office.office'>;
    publishedAt: Schema.Attribute.DateTime;
    staff_email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    staff_id: Schema.Attribute.UID & Schema.Attribute.Required;
    staff_name: Schema.Attribute.String & Schema.Attribute.Required;
    staff_phone_number: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSubCountySubCounty extends Struct.CollectionTypeSchema {
  collectionName: 'sub_counties';
  info: {
    description: 'Sub counties and divisions';
    displayName: 'Sub County';
    pluralName: 'sub-counties';
    singularName: 'sub-county';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    enumeration_area: Schema.Attribute.Relation<
      'manyToOne',
      'api::enumeration-area.enumeration-area'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::sub-county.sub-county'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    parishes: Schema.Attribute.Relation<'oneToMany', 'api::parish.parish'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSystemuserSystemuser extends Struct.CollectionTypeSchema {
  collectionName: 'systemusers';
  info: {
    displayName: 'systemuser';
    pluralName: 'systemusers';
    singularName: 'systemuser';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    is_active: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::systemuser.systemuser'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
    userpass: Schema.Attribute.Password;
  };
}

export interface ApiTagTag extends Struct.CollectionTypeSchema {
  collectionName: 'tags';
  info: {
    category: 'Harvestmoney';
    description: 'WordPress Tags';
    displayName: 'Tag';
    pluralName: 'tags';
    singularName: 'tag';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::tag.tag'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    posts: Schema.Attribute.Relation<'manyToMany', 'api::post.post'>;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    wp_id: Schema.Attribute.Integer & Schema.Attribute.Unique;
  };
}

export interface ApiVgamsSalesPersonVgamsSalesPerson
  extends Struct.CollectionTypeSchema {
  collectionName: 'vgams_sales_persons';
  info: {
    displayName: 'CIO VGAMS Sales Persons';
    pluralName: 'vgams-sales-persons';
    singularName: 'vgams-sales-person';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    adverts: Schema.Attribute.Relation<'manyToMany', 'api::advert.advert'>;
    bc_code: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email & Schema.Attribute.Unique;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::vgams-sales-person.vgams-sales-person'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiVgamsUserVgamsUser extends Struct.CollectionTypeSchema {
  collectionName: 'vgams_users';
  info: {
    description: 'Vision Group Advertising Management System Users';
    displayName: 'CIO VGAMS Users';
    pluralName: 'vgams-users';
    singularName: 'vgams-user';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    adpayments: Schema.Attribute.Relation<'oneToMany', 'api::payment.payment'>;
    adverts: Schema.Attribute.Relation<'oneToMany', 'api::advert.advert'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 150;
        minLength: 3;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::vgams-user.vgams-user'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
        minLength: 2;
      }>;
    password: Schema.Attribute.Password &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Enumeration<
      [
        'booking_clerk',
        'sub_editor',
        'advertising_manager',
        'design_house',
        'design_house_manager',
        'finance_team',
        'administrator',
        'sales_team',
        'hr_team',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'booking_clerk'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow_logs: Schema.Attribute.Relation<
      'manyToMany',
      'api::workflow-log.workflow-log'
    >;
  };
}

export interface ApiWorkflowLogWorkflowLog extends Struct.CollectionTypeSchema {
  collectionName: 'workflow_logs';
  info: {
    displayName: 'CIO Workflow Log';
    pluralName: 'workflow-logs';
    singularName: 'workflow-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    action: Schema.Attribute.Enumeration<
      [
        'created',
        'submitted',
        'reviewed',
        'approved',
        'rejected',
        'revised',
        'published',
        'design_group_added',
        'design_group_removed',
        'design_file_uploaded',
        'design_marked_handled',
        'design_unmarked_handled',
      ]
    > &
      Schema.Attribute.Required;
    advert: Schema.Attribute.Relation<'manyToOne', 'api::advert.advert'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::workflow-log.workflow-log'
    > &
      Schema.Attribute.Private;
    new_status: Schema.Attribute.String & Schema.Attribute.Required;
    notes: Schema.Attribute.Text;
    previous_status: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    timestamp: Schema.Attribute.DateTime & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vgams_users: Schema.Attribute.Relation<
      'manyToMany',
      'api::vgams-user.vgams-user'
    >;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.String;
    caption: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.String;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::access-log.access-log': ApiAccessLogAccessLog;
      'api::advert-daily-schedule.advert-daily-schedule': ApiAdvertDailyScheduleAdvertDailySchedule;
      'api::advert.advert': ApiAdvertAdvert;
      'api::anomaly.anomaly': ApiAnomalyAnomaly;
      'api::api-listing.api-listing': ApiApiListingApiListing;
      'api::author.author': ApiAuthorAuthor;
      'api::bc-dataset.bc-dataset': ApiBcDatasetBcDataset;
      'api::broadcast-source.broadcast-source': ApiBroadcastSourceBroadcastSource;
      'api::campaign-attendence.campaign-attendence': ApiCampaignAttendenceCampaignAttendence;
      'api::campaign.campaign': ApiCampaignCampaign;
      'api::category.category': ApiCategoryCategory;
      'api::client.client': ApiClientClient;
      'api::comment.comment': ApiCommentComment;
      'api::company-asset.company-asset': ApiCompanyAssetCompanyAsset;
      'api::cost-stream.cost-stream': ApiCostStreamCostStream;
      'api::crm-approval-policy.crm-approval-policy': ApiCrmApprovalPolicyCrmApprovalPolicy;
      'api::crm-approval-request.crm-approval-request': ApiCrmApprovalRequestCrmApprovalRequest;
      'api::crm-audit-log.crm-audit-log': ApiCrmAuditLogCrmAuditLog;
      'api::crm-baseline.crm-baseline': ApiCrmBaselineCrmBaseline;
      'api::crm-billing-item.crm-billing-item': ApiCrmBillingItemCrmBillingItem;
      'api::crm-business-unit.crm-business-unit': ApiCrmBusinessUnitCrmBusinessUnit;
      'api::crm-change-request.crm-change-request': ApiCrmChangeRequestCrmChangeRequest;
      'api::crm-client-assignment.crm-client-assignment': ApiCrmClientAssignmentCrmClientAssignment;
      'api::crm-client-profile.crm-client-profile': ApiCrmClientProfileCrmClientProfile;
      'api::crm-commission-dispute.crm-commission-dispute': ApiCrmCommissionDisputeCrmCommissionDispute;
      'api::crm-commission-entry.crm-commission-entry': ApiCrmCommissionEntryCrmCommissionEntry;
      'api::crm-commission-policy.crm-commission-policy': ApiCrmCommissionPolicyCrmCommissionPolicy;
      'api::crm-commission-rule.crm-commission-rule': ApiCrmCommissionRuleCrmCommissionRule;
      'api::crm-contact.crm-contact': ApiCrmContactCrmContact;
      'api::crm-contract-amendment.crm-contract-amendment': ApiCrmContractAmendmentCrmContractAmendment;
      'api::crm-contract.crm-contract': ApiCrmContractCrmContract;
      'api::crm-cost-entry.crm-cost-entry': ApiCrmCostEntryCrmCostEntry;
      'api::crm-document.crm-document': ApiCrmDocumentCrmDocument;
      'api::crm-integration-log.crm-integration-log': ApiCrmIntegrationLogCrmIntegrationLog;
      'api::crm-interaction.crm-interaction': ApiCrmInteractionCrmInteraction;
      'api::crm-invoice.crm-invoice': ApiCrmInvoiceCrmInvoice;
      'api::crm-line-contributor.crm-line-contributor': ApiCrmLineContributorCrmLineContributor;
      'api::crm-lookup.crm-lookup': ApiCrmLookupCrmLookup;
      'api::crm-lpo.crm-lpo': ApiCrmLpoCrmLpo;
      'api::crm-milestone.crm-milestone': ApiCrmMilestoneCrmMilestone;
      'api::crm-notification.crm-notification': ApiCrmNotificationCrmNotification;
      'api::crm-opportunity-contributor.crm-opportunity-contributor': ApiCrmOpportunityContributorCrmOpportunityContributor;
      'api::crm-opportunity.crm-opportunity': ApiCrmOpportunityCrmOpportunity;
      'api::crm-payment.crm-payment': ApiCrmPaymentCrmPayment;
      'api::crm-pipeline-stage.crm-pipeline-stage': ApiCrmPipelineStageCrmPipelineStage;
      'api::crm-price-rule.crm-price-rule': ApiCrmPriceRuleCrmPriceRule;
      'api::crm-procurement-order.crm-procurement-order': ApiCrmProcurementOrderCrmProcurementOrder;
      'api::crm-product.crm-product': ApiCrmProductCrmProduct;
      'api::crm-profile.crm-profile': ApiCrmProfileCrmProfile;
      'api::crm-project-contact.crm-project-contact': ApiCrmProjectContactCrmProjectContact;
      'api::crm-project.crm-project': ApiCrmProjectCrmProject;
      'api::crm-proposal-line.crm-proposal-line': ApiCrmProposalLineCrmProposalLine;
      'api::crm-proposal-version.crm-proposal-version': ApiCrmProposalVersionCrmProposalVersion;
      'api::crm-proposal.crm-proposal': ApiCrmProposalCrmProposal;
      'api::crm-provider.crm-provider': ApiCrmProviderCrmProvider;
      'api::crm-recurring-rule.crm-recurring-rule': ApiCrmRecurringRuleCrmRecurringRule;
      'api::crm-required-document-rule.crm-required-document-rule': ApiCrmRequiredDocumentRuleCrmRequiredDocumentRule;
      'api::crm-setting.crm-setting': ApiCrmSettingCrmSetting;
      'api::crm-stage-history.crm-stage-history': ApiCrmStageHistoryCrmStageHistory;
      'api::crm-target.crm-target': ApiCrmTargetCrmTarget;
      'api::crm-task.crm-task': ApiCrmTaskCrmTask;
      'api::crm-team.crm-team': ApiCrmTeamCrmTeam;
      'api::crm-workstream.crm-workstream': ApiCrmWorkstreamCrmWorkstream;
      'api::department.department': ApiDepartmentDepartment;
      'api::design-batch.design-batch': ApiDesignBatchDesignBatch;
      'api::design-file.design-file': ApiDesignFileDesignFile;
      'api::district.district': ApiDistrictDistrict;
      'api::enumeration-area.enumeration-area': ApiEnumerationAreaEnumerationArea;
      'api::invoice.invoice': ApiInvoiceInvoice;
      'api::market-sector.market-sector': ApiMarketSectorMarketSector;
      'api::office-location.office-location': ApiOfficeLocationOfficeLocation;
      'api::office.office': ApiOfficeOffice;
      'api::page.page': ApiPagePage;
      'api::pager-page.pager-page': ApiPagerPagePagerPage;
      'api::pager-publication.pager-publication': ApiPagerPublicationPagerPublication;
      'api::parish.parish': ApiParishParish;
      'api::payment.payment': ApiPaymentPayment;
      'api::polling-station.polling-station': ApiPollingStationPollingStation;
      'api::post.post': ApiPostPost;
      'api::product-category.product-category': ApiProductCategoryProductCategory;
      'api::product.product': ApiProductProduct;
      'api::publication.publication': ApiPublicationPublication;
      'api::rate-card.rate-card': ApiRateCardRateCard;
      'api::region.region': ApiRegionRegion;
      'api::revenue-stream.revenue-stream': ApiRevenueStreamRevenueStream;
      'api::screen.screen': ApiScreenScreen;
      'api::sections-commission.sections-commission': ApiSectionsCommissionSectionsCommission;
      'api::sfa-activity.sfa-activity': ApiSfaActivitySfaActivity;
      'api::sfa-agent-profile.sfa-agent-profile': ApiSfaAgentProfileSfaAgentProfile;
      'api::sfa-buy-in.sfa-buy-in': ApiSfaBuyInSfaBuyIn;
      'api::sfa-company.sfa-company': ApiSfaCompanySfaCompany;
      'api::sfa-contact.sfa-contact': ApiSfaContactSfaContact;
      'api::sfa-opportunity-buy-in.sfa-opportunity-buy-in': ApiSfaOpportunityBuyInSfaOpportunityBuyIn;
      'api::sfa-opportunity.sfa-opportunity': ApiSfaOpportunitySfaOpportunity;
      'api::sfa-order.sfa-order': ApiSfaOrderSfaOrder;
      'api::sfa-quotation-communication.sfa-quotation-communication': ApiSfaQuotationCommunicationSfaQuotationCommunication;
      'api::sfa-quotation-item.sfa-quotation-item': ApiSfaQuotationItemSfaQuotationItem;
      'api::sfa-quotation.sfa-quotation': ApiSfaQuotationSfaQuotation;
      'api::sfa-unit.sfa-unit': ApiSfaUnitSfaUnit;
      'api::staff-table.staff-table': ApiStaffTableStaffTable;
      'api::sub-county.sub-county': ApiSubCountySubCounty;
      'api::systemuser.systemuser': ApiSystemuserSystemuser;
      'api::tag.tag': ApiTagTag;
      'api::vgams-sales-person.vgams-sales-person': ApiVgamsSalesPersonVgamsSalesPerson;
      'api::vgams-user.vgams-user': ApiVgamsUserVgamsUser;
      'api::workflow-log.workflow-log': ApiWorkflowLogWorkflowLog;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
