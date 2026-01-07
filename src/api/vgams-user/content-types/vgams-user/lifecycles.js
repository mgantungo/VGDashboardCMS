// src/api/vgams-user/content-types/vgams-user/lifecycles.js
'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    
    // Hash the password before creating
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    
    // Ensure email is lowercase
    if (data.email) {
      data.email = data.email.toLowerCase().trim();
    }
  },
  
  async beforeUpdate(event) {
    const { data } = event.params;
    
    // Hash the password before updating if it's being changed
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    
    // Ensure email is lowercase
    if (data.email) {
      data.email = data.email.toLowerCase().trim();
    }
  }
};
