# Vision Group Analytics Dashboard– Strapi 5 Controllers & Routes



---

## Directory Structure

```
src/api/
├── administrator/
│   ├── controllers/administrator.js
│   └── routes/administrator.js
├── editorial/
│   ├── controllers/editorial.js
│   └── routes/editorial.js
├── executive/
│   ├── controllers/executive.js
│   └── routes/executive.js
├── finance/
│   ├── controllers/finance.js
│   └── routes/finance.js
├── it/
│   ├── controllers/it.js
│   └── routes/it.js
├── operations/
│   ├── controllers/operations.js
│   └── routes/operations.js
└── sales/
    ├── controllers/sales.js
    └── routes/sales.js
```

---

## All Endpoints  (prefix: `/api`)

### 🏢 Administrator (7 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/administrator/meetings` | Meeting analysis & attendance |
| GET | `/api/administrator/process-throughput` | Task process throughput |
| GET | `/api/administrator/rvs-analytics` | Resources, Venues & Suppliers |
| GET | `/api/administrator/schedule-efficiency` | Schedule efficiency & task progress |
| GET | `/api/administrator/task-completion` | Task completion rate |
| GET | `/api/administrator/visitor-patterns` | Visitor pattern analytics |
| GET | `/api/administrator/wait-time` | Visitor wait time analytics |

### 📰 Editorial (39 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/editorial/cross-platform-engagement` | Average duration by platform |
| GET | `/api/editorial/content-roi` | Content ROI by title |
| GET | `/api/editorial/audience-demographics` | Audience by session medium |
| GET | `/api/editorial/section-performance` | Editorial section performance |
| GET | `/api/editorial/readership-trends` | Readership trends by article |
| GET | `/api/editorial/competitor-benchmarking` | Competitor benchmarking data |
| GET | `/api/editorial/calendar-adherence` | Editorial calendar adherence |
| GET | `/api/editorial/content-throughput` | Content throughput over time |
| GET | `/api/editorial/deadline-compliance` | Article deadline compliance |
| GET | `/api/editorial/breaking-news` | Breaking news / trending stories |
| GET | `/api/editorial/journalist-productivity` | Journalist productivity metrics |
| GET | `/api/editorial/topic-virality` | Topic virality & newsletter stats |
| GET | `/api/editorial/content-freshness` | Content freshness tracking |
| GET | `/api/editorial/update-frequency` | Article update frequency |
| GET | `/api/editorial/backlog-management` | Editorial backlog |
| GET | `/api/editorial/editing-cycle-times` | Editing cycle durations |
| GET | `/api/editorial/error-rates` | Error rates in publishing |
| GET | `/api/editorial/version-control` | Article version control |
| GET | `/api/editorial/byline-performance` | Personal byline performance |
| GET | `/api/editorial/source-effectiveness` | Traffic source effectiveness |
| GET | `/api/editorial/social-amplification` | Social media amplification |
| GET | `/api/editorial/visual-asset-engagement` | Visual asset engagement |
| GET | `/api/editorial/asset-usage-tracking` | Asset usage tracking |
| GET | `/api/editorial/rights-management` | Rights & license management |
| GET | `/api/editorial/segment-popularity` | Content segment popularity |
| GET | `/api/editorial/audience-retention` | Audience retention data |
| GET | `/api/editorial/social-sentiment` | Social sentiment monitoring |
| GET | `/api/editorial/case-resolution` | Case resolution metrics |
| GET | `/api/editorial/compliance-breach` | Compliance breach tracking |
| GET | `/api/editorial/risk-exposure` | Risk exposure dashboards |
| GET | `/api/editorial/mitigation-effectiveness` | Risk mitigation effectiveness |
| GET | `/api/editorial/attendance-rates` | Event attendance rates |
| GET | `/api/editorial/sponsor-roi` | Sponsor ROI metrics |
| GET | `/api/editorial/participant-feedback` | Participant feedback |
| GET | `/api/editorial/recruitment-funnel` | Recruitment funnel |
| GET | `/api/editorial/retention-risk` | Employee retention risk |
| GET | `/api/editorial/training-effectiveness` | Training effectiveness |
| GET | `/api/editorial/data-governance` | Data governance metrics |
| GET | `/api/editorial/insight-adoption` | Insight adoption rates |

### 👔 Executive (14 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/executive/ceo-analytics` | CEO-level KPI dashboard |
| GET | `/api/executive/risk-cases` | Risk exposure & case summary |
| GET | `/api/executive/retention` | Employee retention metrics |
| GET | `/api/executive/compensation` | Compensation benchmarking |
| GET | `/api/executive/company-kpis` | Company-wide weekly KPIs |
| GET | `/api/executive/compliance` | Audits, policies & tasks |
| GET | `/api/executive/control-effectiveness` | Internal control effectiveness |
| GET | `/api/executive/cost-optimization` | Dept cost vs budget |
| GET | `/api/executive/finance-health` | Finance health & profit trends |
| GET | `/api/executive/liquidity-ratios` | Liquidity ratio trends |
| GET | `/api/executive/market-share` | Market share by region & BU |
| GET | `/api/executive/risk-heatmap` | Risk heat map |
| GET | `/api/executive/roi-analysis` | ROI & automation analysis |
| GET | `/api/executive/strategic-initiatives` | Strategic initiative tracking |

### 💰 Finance (20 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/finance/accounts-payable-receivable` | AP/AR entries |
| GET | `/api/finance/asset-depreciation` | Asset depreciation schedules |
| GET | `/api/finance/bad-debt-ratios` | Bad debt ratios by quarter |
| GET | `/api/finance/budget-variance` | Budget vs actual variance |
| GET | `/api/finance/capital-expenditure` | CapEx transactions |
| GET | `/api/finance/collection-efficiency` | Collection efficiency |
| GET | `/api/finance/daily-sales-outstanding` | DSO metrics |
| GET | `/api/finance/expense-categorization` | Categorized expenses |
| GET | `/api/finance/forecasting` | Financial forecasts |
| GET | `/api/finance/general-ledger` | GL reconciliation |
| GET | `/api/finance/invoice-metrics` | Invoice processing KPIs |
| GET | `/api/finance/pipeline-metrics` | Data pipeline health |
| GET | `/api/finance/reporting-accuracy` | Report accuracy summary |
| GET | `/api/finance/statement-variance` | Financial statement variance |
| GET | `/api/finance/system-integration-health` | ERP/CRM integration health |
| GET | `/api/finance/tax-provisioning` | Tax provisioning data |
| GET | `/api/finance/total-asset-value` | Total asset value |
| GET | `/api/finance/close-metrics` | Finance close entries |
| GET | `/api/finance/audit-trail` | Audit trail analysis |
| GET | `/api/finance/regional-pl` | Regional P&L breakdown |

### 💻 IT (10 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/it/server-infrastructure` | Server load & resource usage |
| GET | `/api/it/storage-utilization` | Storage capacity & usage |
| GET | `/api/it/cybersecurity` | Security incidents & posture |
| GET | `/api/it/patch-compliance` | System patch compliance |
| GET | `/api/it/system-health` | Overall system health scores |
| GET | `/api/it/infrastructure-costs` | IT infrastructure costs |
| GET | `/api/it/ticket-sla` | Help desk tickets & SLA |
| GET | `/api/it/user-satisfaction` | IT satisfaction surveys |
| GET | `/api/it/asset-inventory` | IT asset inventory |
| GET | `/api/it/cpu-performance` | CPU performance details |

### ⚙️ Operations (12 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/operations/delivery-timelines` | Print delivery timelines |
| GET | `/api/operations/fuel-consumption` | Vehicle & machine fuel usage |
| GET | `/api/operations/job-scheduling` | Press job scheduling |
| GET | `/api/operations/parts-utilization` | Maintenance parts usage |
| GET | `/api/operations/route-efficiency` | Distribution route efficiency |
| GET | `/api/operations/setup-time` | Machine setup time optimization |
| GET | `/api/operations/signal-quality` | Broadcast signal quality |
| GET | `/api/operations/ticket-resolution` | Maintenance ticket resolution |
| GET | `/api/operations/updown-time` | Machine uptime/downtime logs |
| GET | `/api/operations/material-waste` | Material waste analysis |
| GET | `/api/operations/machine-oee` | Overall Equipment Effectiveness |
| GET | `/api/operations/production-yield` | Production yield metrics |

### 📈 Sales (14 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sales/revenue-attribution` | Revenue by segment & rep |
| GET | `/api/sales/client-lifetime-value` | CLV & churn risk |
| GET | `/api/sales/campaign-roi` | Campaign ROI metrics |
| GET | `/api/sales/territory-performance` | Sales territory performance |
| GET | `/api/sales/lead-efficiency` | Lead funnel efficiency |
| GET | `/api/sales/conversion-funnels` | Conversion funnel stages |
| GET | `/api/sales/click-through-rate` | Ad CTR & engagement |
| GET | `/api/sales/rate-card-utilization` | Ad rate card utilization |
| GET | `/api/sales/impression-share` | Market impression share |
| GET | `/api/sales/ab-test-results` | A/B test results |
| GET | `/api/sales/campaign-attribution` | Multi-touch attribution |
| GET | `/api/sales/brand-lift` | Brand lift studies |
| GET | `/api/sales/contract-value-trends` | Contract value trends |
| GET | `/api/sales/supervisor-analytics` | Sales supervisor analytics |

## Notes

- All routes use `auth: false` — add Strapi policies as needed for production.
- All responses use `ctx.body` (Strapi 5 style — no `ctx.send()`).
- No services layer — all dummy data lives directly in the controller methods.
- To register a custom API in Strapi 5, ensure each `src/api/<name>/` folder contains both a `controllers/` and `routes/` subfolder as shown.
