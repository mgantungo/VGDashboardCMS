# VGAMS — Sales Force Automation Module

Complete extension for the Vision Group Advertising Management System.

---

## What is in this package

```
VGAMS_SFA/
├── strapi/                          Strapi 5 backend API
│   └── src/api/
│       ├── sfa-unit/                Team / unit management
│       ├── sfa-agent-profile/       Agent SFA roles (sales_agent/supervisor/manager/admin)
│       ├── sfa-company/             Prospect companies (pipeline only — no BC dependency)
│       ├── sfa-contact/             Contacts attached to prospect companies
│       ├── sfa-buy-in/              Product / service catalogue
│       ├── sfa-opportunity/         Core entity — every sale starts here
│       ├── sfa-opportunity-buy-in/  Junction: products attached to an opportunity
│       ├── sfa-activity/            Call / email / visit / meeting / note logs
│       ├── sfa-quotation/           Versioned quotations with approval lifecycle
│       ├── sfa-quotation-item/      Line items within a quotation
│       ├── sfa-quotation-communication/  Send & response records
│       ├── sfa-order/               Confirmed orders (post-conversion)
│       ├── sfa-dashboard/           Aggregated stats (no content-type)
│       └── client-extension/        Routes to add to the EXISTING clients API
│
└── nuxt/                            Nuxt 4 frontend
    ├── composables/
    │   ├── useSfa.js                Role helpers + agent profile
    │   ├── useSfaCompanies.js       Prospect search + existing-client search
    │   ├── useSfaBuyIns.js          Catalogue (cached)
    │   ├── useSfaOpportunities.js   Board, list, CRUD, stage moves
    │   ├── useSfaActivities.js      Activity logging
    │   ├── useSfaQuotations.js      Quotation lifecycle
    │   ├── useSfaOrders.js          Order conversion
    │   └── useSfaDashboard.js       Stats
    │
    ├── components/sfa/
    │   ├── SfaStatusBadge.vue
    │   ├── SfaSidebar.vue
    │   ├── SfaOpportunityCard.vue
    │   ├── SfaKanbanColumn.vue
    │   ├── SfaKanbanView.vue
    │   ├── SfaNewOpportunityModal.vue    ← return client OR new prospect
    │   ├── SfaActivityTimeline.vue
    │   ├── SfaActivityLogModal.vue
    │   ├── SfaOpportunityDetailDrawer.vue
    │   ├── SfaQuotationList.vue
    │   ├── SfaQuotationForm.vue
    │   ├── SfaConvertToOrderModal.vue    ← auto-creates/links client on conversion
    │   ├── SfaOrdersTable.vue
    │   ├── SfaOrderDetailDrawer.vue
    │   ├── SfaOpportunitiesTable.vue
    │   ├── SfaMyDashboard.vue
    │   └── SfaManagerDashboard.vue
    │
    └── pages/dashboard/
        └── sfa.vue                  Main page shell
```

---

## Key Business Rules

### clients collection (existing — do not rename or alter)
- Contains only **confirmed business partners** (clients with at least one order)
- Records come from Business Central AND are created by VGAMS on first-order conversion
- Used by the existing adverts and invoices collections — no changes needed there

### sfa-company (new — prospects only)
- A lightweight record for tracking a company through the opportunity pipeline
- Has **no Business Central dependency** and **no bc_no field**
- Created by sales agents when pursuing a new company not yet in the clients list
- Converted to a `client` record automatically when their first order is confirmed

### sfa-opportunity
- Every sale — whether from a new prospect or a return client — starts as an opportunity
- Has two mutually exclusive company source fields:
  - `existing_client` → set for return clients (already in the `clients` collection)
  - `company` → set for new prospects (in `sfa-company`)

### Order conversion — client resolution (sfa-order controller: resolveClient)

```
On convertToOrder():

  Case A — opportunity.existing_client is set
    → Link order to that existing client directly. No creation.

  Case B — opportunity.company is set + matching name found in clients
    → The prospect already became a client via a previous order.
    → Link order to that existing client. No creation.

  Case C — opportunity.company is set + no match found
    → First-ever order from this company.
    → Create a new client record from the sfa-company data.
    → Link order to the new client.
    → Response: { clientIsNew: true }
```

---

## Installation

### Strapi

1. Copy each folder under `strapi/src/api/` into your Strapi project's `src/api/`.

2. For `client-extension`:
   - Copy `controllers/client-extension.js` → `src/api/client/controllers/client-extension.js`
   - Copy `routes/client-extension.js`      → `src/api/client/routes/client-extension.js`
   - Strapi auto-discovers all files in `controllers/` and `routes/` directories.

3. Set permissions in Strapi Admin → Settings → Roles → Authenticated:
   - Allow all `/api/sfa-*` routes
   - Allow `/api/clients/find-match` and `/api/clients/search-by-name`

4. Ensure `nuxt.config.ts` has:
   ```ts
   runtimeConfig: {
     public: {
       apiBase: process.env.API_BASE,
     }
   }
   ```

### Nuxt 4

1. Copy `composables/*.js` → your project's `composables/` directory.
2. Copy `components/sfa/*.vue` → your project's `components/sfa/` directory.
3. Copy `pages/dashboard/sfa.vue` → your project's `pages/dashboard/` directory.
4. Add a nav link pointing to `/dashboard/sfa` in your main sidebar.

---

## API Endpoint Map (all POST)

| Endpoint | Description |
|---|---|
| `/api/sfa-agent-profiles/me` | Current user's SFA profile |
| `/api/sfa-companies/search` | Search prospect companies |
| `/api/sfa-companies/create` | Create prospect company |
| `/api/sfa-companies/update` | Update prospect company |
| `/api/sfa-contacts/by-company` | Contacts for a company |
| `/api/sfa-contacts/create` | Add contact |
| `/api/sfa-contacts/update` | Update contact |
| `/api/sfa-contacts/remove` | Delete contact |
| `/api/sfa-buy-ins/list` | Product catalogue |
| `/api/sfa-buy-ins/create` | Add product (admin) |
| `/api/sfa-buy-ins/update` | Update product (admin) |
| `/api/sfa-opportunities/my-board` | Role-filtered kanban board |
| `/api/sfa-opportunities/list` | Filterable list |
| `/api/sfa-opportunities/detail` | Single opportunity |
| `/api/sfa-opportunities/create` | Create opportunity |
| `/api/sfa-opportunities/update` | Update opportunity |
| `/api/sfa-opportunities/change-stage` | Move kanban stage |
| `/api/sfa-opportunities/mark-lost` | Mark as lost |
| `/api/sfa-opportunity-buy-ins/by-opportunity` | Products on an opportunity |
| `/api/sfa-opportunity-buy-ins/save` | Replace buy-in lines |
| `/api/sfa-activities/log` | Log activity |
| `/api/sfa-activities/by-opportunity` | Activity history |
| `/api/sfa-activities/due-followups` | Overdue / due today |
| `/api/sfa-activities/remove` | Delete own activity |
| `/api/sfa-quotations/create` | Create draft quotation |
| `/api/sfa-quotations/update` | Update draft |
| `/api/sfa-quotations/by-opportunity` | All versions |
| `/api/sfa-quotations/pending-approval` | Awaiting approval |
| `/api/sfa-quotations/submit-for-approval` | Submit draft |
| `/api/sfa-quotations/approve` | Supervisor approves |
| `/api/sfa-quotations/reject` | Supervisor rejects |
| `/api/sfa-quotations/revise` | Create new version |
| `/api/sfa-quotations/upload-pdf` | Attach PDF |
| `/api/sfa-quotation-communications/record-send` | Record send to client |
| `/api/sfa-quotation-communications/record-response` | Record client response |
| `/api/sfa-quotation-communications/by-quotation` | Communication log |
| `/api/sfa-orders/convert` | Convert opportunity → order |
| `/api/sfa-orders/list` | All orders (all roles) |
| `/api/sfa-orders/detail` | Single order |
| `/api/sfa-orders/update-status` | Update order status |
| `/api/sfa-dashboard/my-stats` | Agent dashboard stats |
| `/api/sfa-dashboard/management-stats` | Manager stats + team ranking |
| `/api/sfa-dashboard/followup-summary` | Today's follow-ups |
| `/api/clients/search-by-name` | Search existing clients (typeahead) |
| `/api/clients/find-match` | Match company to client on conversion |
