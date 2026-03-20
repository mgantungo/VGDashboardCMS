// src/api/advert/content-types/advert/lifecycles.js
'use strict';

module.exports = {
  /**
   * afterCreate
   * 
   * NOTE: BC sync is now handled synchronously in the controller.
   * This lifecycle is kept for logging and monitoring only.
   * The controller already handles BC sync and returns the reference
   * immediately to the frontend.
   */
  async afterCreate(event) {
    const { result } = event;
    
    console.log('\n');
    console.log('📝 ===================================================');
    console.log('📝 LIFECYCLE: Advert Created');
    console.log('📝 ===================================================');
    console.log('📝 Advert ID:', result.id);
    console.log('📝 Reference:', result.reference_number);
    console.log('📝 Status:', result.status);
    console.log('📝 BC Sync Status:', result.bc_share_success ? '✅ Success' : (result.bc_reference_number ? '⚠️ In Progress' : '❌ Not Started'));
    console.log('📝 BC Reference:', result.bc_reference_number || 'N/A');
    console.log('📝 ===================================================\n');
    
    // Optional: Send notification or trigger other workflows
    // BC sync is already handled in controller, so no need to sync here
    
    // You could add logic here for:
    // - Sending email notifications
    // - Updating analytics
    // - Triggering other business processes
  },
  
  /**
   * beforeUpdate - For logging changes
   */
  async beforeUpdate(event) {
    const { params, data } = event;
    
    console.log('\n');
    console.log('✏️ ===================================================');
    console.log('✏️ LIFECYCLE: Advert Update');
    console.log('✏️ ===================================================');
    console.log('✏️ Advert ID:', params.where.id);
    console.log('✏️ Changes:', Object.keys(data).join(', '));
    console.log('✏️ ===================================================\n');
  },
  
  /**
   * afterUpdate - For logging after update
   */
  async afterUpdate(event) {
    const { result } = event;
    
    console.log('\n');
    console.log('✅ ===================================================');
    console.log('✅ LIFECYCLE: Advert Updated');
    console.log('✅ ===================================================');
    console.log('✅ Advert ID:', result.id);
    console.log('✅ Status:', result.status);
    console.log('✅ BC Reference:', result.bc_reference_number || 'N/A');
    console.log('✅ ===================================================\n');
  }
};
