'use strict';

module.exports = {
  routes: [
    // Get all active sales agents
    {
      method: 'GET',
      path: '/sales-agents/active',
      handler: 'custom-vgams-sales-person.getActiveSalesAgents',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Get all active sales agents (id, name, email only)'
      }
    },
    
    // Search active sales agents
    {
      method: 'GET',
      path: '/sales-agents/search',
      handler: 'custom-vgams-sales-person.searchActiveSalesAgents',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Search active sales agents by name or email'
      }
    },
    
    // Get specific sales agent
    {
      method: 'GET',
      path: '/sales-agents/:id',
      handler: 'custom-vgams-sales-person.getSalesAgentById',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Get specific sales agent by ID'
      }
    },
    {
      method: 'GET',
      path: '/sales-agents/getbcsalespeople',
      handler: 'salesperson.findALLSalesPersonsBC',
      config: {
        auth: false, // Set to true if you want to require authentication
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/sales-agents/getbcsalespeople/:code',
      handler: 'salesperson.findOneSalesPersonfromBC',
      config: {
        auth: false, // Set to true if you want to require authentication
        policies: [],
        middlewares: [],
      },
    }
  ]
};
