'use strict';

module.exports = {
  async submitForReview(ctx) {
    try {
      const { id } = ctx.params;
      const user = ctx.state.user;

      // Get advert
      const advert = await strapi.entityService.findOne(
        'api::advert.advert',
        id,
        { populate: ['created_by_clerk'] }
      );

      if (!advert) {
        return ctx.notFound('Advert not found');
      }

      // Check permissions
      if (advert.created_by_clerk.id !== user.id) {
        return ctx.forbidden('You can only submit your own adverts');
      }

      // Update status
      const updatedAdvert = await strapi.entityService.update(
        'api::advert.advert',
        id,
        {
          data: {
            status: 'pending_review',
            publishedAt: new Date()
          }
        }
      );

      // Create workflow log
      await strapi.entityService.create('api::workflow-log.workflow-log', {
        data: {
          advert: id,
          action: 'submitted',
          previous_status: advert.status,
          new_status: 'pending_review',
          performed_by: user.id,
          timestamp: new Date()
        }
      });

      // Send notification to editors
      await strapi.plugins['email'].services.email.send({
        to: 'editors@visiongroup.co.ug',
        subject: `New Advert Submitted for Review: ${advert.advert_title}`,
        text: `Advert ${advert.reference_number} has been submitted for review.`
      });

      return ctx.send(updatedAdvert);
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async editorReview(ctx) {
    try {
      const { id } = ctx.params;
      const { action, comment } = ctx.request.body;
      const user = ctx.state.user;

      // Validate action
      if (!['approve', 'reject', 'request_changes'].includes(action)) {
        return ctx.badRequest('Invalid action');
      }

      // Get advert
      const advert = await strapi.entityService.findOne(
        'api::advert.advert',
        id
      );

      if (!advert || advert.status !== 'pending_review') {
        return ctx.badRequest('Advert not available for review');
      }

      // Determine new status
      let newStatus;
      switch (action) {
        case 'approve':
          newStatus = 'editor_approved';
          break;
        case 'reject':
          newStatus = 'editor_rejected';
          break;
        case 'request_changes':
          newStatus = 'draft';
          break;
      }

      // Update advert
      const updatedAdvert = await strapi.entityService.update(
        'api::advert.advert',
        id,
        {
          data: {
            status: newStatus,
            reviewed_by_editor: user.id
          }
        }
      );

      // Create workflow log
      await strapi.entityService.create('api::workflow-log.workflow-log', {
        data: {
          advert: id,
          action: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revised',
          previous_status: advert.status,
          new_status: newStatus,
          performed_by: user.id,
          notes: comment,
          timestamp: new Date()
        }
      });

      // Create comment if provided
      if (comment) {
        await strapi.entityService.create('api::comment.comment', {
          data: {
            advert: id,
            author: user.id,
            comment_text: comment,
            comment_type: action === 'approve' ? 'approval' : action === 'reject' ? 'rejection' : 'revision_request',
            created_at: new Date()
          }
        });
      }

      return ctx.send(updatedAdvert);
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async managerApproval(ctx) {
    try {
      const { id } = ctx.params;
      const { action, comment } = ctx.request.body;
      const user = ctx.state.user;

      // Similar to editorReview but for manager approval
      const advert = await strapi.entityService.findOne(
        'api::advert.advert',
        id
      );

      if (!advert || advert.status !== 'editor_approved') {
        return ctx.badRequest('Advert not ready for manager approval');
      }

      const newStatus = action === 'approve' ? 'manager_approved' : 'manager_rejected';

      const updatedAdvert = await strapi.entityService.update(
        'api::advert.advert',
        id,
        {
          data: {
            status: newStatus,
            approved_by_manager: user.id
          }
        }
      );

      // Create workflow log
      await strapi.entityService.create('api::workflow-log.workflow-log', {
        data: {
          advert: id,
          action: action === 'approve' ? 'approved' : 'rejected',
          previous_status: advert.status,
          new_status: newStatus,
          performed_by: user.id,
          notes: comment,
          timestamp: new Date()
        }
      });

      // If approved, create invoice
      if (action === 'approve') {
        const invoiceDueDate = new Date();
        invoiceDueDate.setDate(invoiceDueDate.getDate() + 30); // 30 days payment term

        await strapi.entityService.create('api::invoice.invoice', {
          data: {
            client: advert.client.id,
            advert: id,
            invoice_date: new Date(),
            due_date: invoiceDueDate,
            total_amount: advert.total_amount,
            balance: advert.total_amount,
            payment_status: 'unpaid'
          }
        });
      }

      return ctx.send(updatedAdvert);
    } catch (err) {
      ctx.throw(500, err);
    }
  }
};
