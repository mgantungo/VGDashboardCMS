'use strict';

module.exports = {

  // GET /api/editorial/cross-platform-engagement
  async getCrossPlatformEngagement(ctx) {
    ctx.send({
      metric: 'crossPlatformEngagement',
      measuredMetric: 'averageDuration',
      groupBy: 'platform',
      data: [
        { platform: 'Android', value: 14667.86 },
        { platform: 'Web', value: 1284.68 },
        { platform: 'iOS', value: 3675.92 },
      ],
    });
  },

  // GET /api/editorial/content-roi
  async getContentROI(ctx) {
    ctx.send({
      metric: 'contentROI',
      groupBy: 'title',
      data: [
        { title: '(not set)', value: 11975.96, count: 49 },
        {
          title: "Meeya w'e Kasangati yeeyamye okutuusa ku Bannakasangati amazzi amayonjo - Uganda News in Luganda",
          value: 94388,
          count: 1,
        },
        { title: 'Radio - New Vision Official', value: 4256.28, count: 36 },
      ],
    });
  },

  // GET /api/editorial/audience-demographics
  async getAudienceDemographics(ctx) {
    ctx.send({
      metric: 'audienceDemographics',
      measuredMetric: 'averageDuration',
      groupBy: 'sessionMedium',
      data: [
        { sessionMedium: 'twitter', value: 2056.2, count: 5 },
        { sessionMedium: 'cpm', value: 1758.0, count: 1 },
        { sessionMedium: 'email', value: 1631.57, count: 7 },
        { sessionMedium: 'facebook', value: 1493.88, count: 8 },
        { sessionMedium: 'linkedin', value: 1453.0, count: 1 },
        { sessionMedium: 'new_vision', value: 1331.5, count: 2 },
        { sessionMedium: 'notification', value: 3134.83, count: 6 },
      ],
    });
  },

  // GET /api/editorial/section-performance
  async getEditorialSectionPerformance(ctx) {
    ctx.send({
      metric: 'editorialSectionPerformance',
      groupBy: 'category',
      data: [
        {
          category: 'Technology',
          noOfArticles: 5,
          noOfReaders: 130,
          totalBounceRate: 7.2,
          avgBounceRate: 1.44,
          demographics: { males: 60, females: 70 },
          articles: [
            {
              articleTitle: 'The Rise of AI in Africa',
              publishedOn: '2025-07-21',
              authors: ['Zac Jim', 'Jane Doe'],
              editor: 'Editor-in-Chief',
              locations: ['Kampala', 'Nairobi', 'Lagos'],
            },
            {
              articleTitle: 'Tech Startups in East Africa',
              publishedOn: '2025-07-18',
              authors: ['John Smith'],
              editor: 'Senior Editor',
              locations: ['Kigali'],
            },
          ],
        },
        {
          category: 'Politics',
          noOfArticles: 3,
          noOfReaders: 98,
          totalBounceRate: 4.8,
          avgBounceRate: 1.6,
          demographics: { males: 52, females: 46 },
          articles: [
            {
              articleTitle: 'Election Updates 2025',
              publishedOn: '2025-07-15',
              authors: ['Sarah K'],
              editor: 'Political Editor',
              locations: ['Kampala'],
            },
          ],
        },
      ],
    });
  },

  // GET /api/editorial/readership-trends
  async getReadershipTrends(ctx) {
    ctx.send({
      metric: 'readershipTrends',
      groupBy: 'articleTitle',
      data: [
        {
          articleTitle: 'How to Build Modern Web Apps',
          author: 'Jim Tim',
          publishedOn: '2025-02-20T09:15:00Z',
          platform: 'mobile',
          noOfReaders: 620,
          noOfUniqueReaders: 500,
          demographics: {
            males: 310,
            females: 310,
            locations: ['Uganda', 'Kenya'],
          },
          referrerSource: 'twitter.com',
          bounceRate: 40.2,
          averageDurationSeconds: 165,
          percentageScrolled: 84.1,
        },
      ],
    });
  },

  // GET /api/editorial/competitor-benchmarking
  async getCompetitorBenchmarking(ctx) {
    ctx.send({
      metric: 'competitorBenchmarking',
      groupBy: 'competitor',
      data: [
        {
          competitor: 'Daily Monitor',
          totalArticles: 96,
          avgViews: 2649,
          avgEngagement: 405,
          socialMediaReach: 243049,
          totalTraffic: 304168,
          engagementRate: 12.8,
          articleCategoryBreakdown: {
            Politics: 26,
            Sports: 34,
            Entertainment: 43,
            Business: 48,
          },
          monthlyTrafficTrend: [],
        },
      ],
    });
  },

  // GET /api/editorial/calendar-adherence
  async getEditorialCalendarAdherence(ctx) {
    ctx.send({
      metric: 'editorialCalendarAdherence',
      groupBy: 'section',
      count: 100,
      filtersApplied: {},
      data: [
        {
          id: 1,
          title: 'Mock Article 1',
          author: 'John Smith',
          section: 'Sports',
          scheduledPublicationDate: '2025-05-20T03:56:02.185Z',
          actualPublicationDate: '2025-05-20T03:56:02.185Z',
          publicationStatus: 'on-time',
        },
        {
          id: 2,
          title: 'Mock Article 2',
          author: 'Jane Doe',
          section: 'Politics',
          scheduledPublicationDate: '2025-05-22T08:00:00.000Z',
          actualPublicationDate: '2025-05-22T10:15:00.000Z',
          publicationStatus: 'late',
        },
      ],
    });
  },

  // GET /api/editorial/content-throughput
  async getContentThroughput(ctx) {
    ctx.send({
      metric: 'Content Throughput',
      startDate: '2024-07-01T00:00:00.000Z',
      endDate: '2025-07-31T23:59:59.000Z',
      data: [
        { period: '2025-01-27', count: 23 },
        { period: '2025-02-03', count: 18 },
        { period: '2025-02-10', count: 31 },
        { period: '2025-02-17', count: 27 },
        { period: '2025-02-24', count: 22 },
        { period: '2025-03-03', count: 29 },
      ],
    });
  },

  // GET /api/editorial/deadline-compliance
  async getDeadlineCompliance(ctx) {
    ctx.send({
      metric: 'Deadline compliance',
      articles: [
        {
          id: 1,
          title: 'Article 1',
          deadlineDate: '2024-07-24T12:16:18.196Z',
          publishedAt: '2024-07-27T08:24:24.328Z',
          status: 'late',
        },
        {
          id: 2,
          title: 'Article 2',
          deadlineDate: '2024-08-01T09:00:00.000Z',
          publishedAt: '2024-07-31T16:30:00.000Z',
          status: 'on-time',
        },
      ],
    });
  },

  // GET /api/editorial/breaking-news
  async getBreakingNews(ctx) {
    ctx.send({
      metric: 'Breaking News',
      trendingStories: [
        {
          title: 'Business Headline 3',
          percentageScrolled: '69%',
          avgDuration: '00:07:19',
          bounceRate: '39%',
          publishedDate: '2025-09-28',
          pageLocation: '/business/article-3',
          category: 'Business',
          author: 'Robert Williams',
          streamName: 'Sports Vision Stream',
          breakingNews: true,
        },
        {
          title: 'Political Briefing',
          percentageScrolled: '55%',
          avgDuration: '00:05:42',
          bounceRate: '45%',
          publishedDate: '2025-09-29',
          pageLocation: '/politics/briefing-1',
          category: 'Politics',
          author: 'Sarah Nakato',
          streamName: 'New Vision Website',
          breakingNews: true,
        },
      ],
    });
  },

  // GET /api/editorial/journalist-productivity
  async getJournalistProductivity(ctx) {
    ctx.send({
      metric: 'Journalist Productivity',
      data: [
        {
          articleId: 'ART001',
          authorId: 'AUTH001',
          author: 'Charles Etukuri',
          title: 'Karuma bridge to be closed on March 10 for high tech repairs',
          category: 'News',
          avgDuration: '00:18:05',
          bounceRate: 0,
          publishDate: '2025-02-28',
          shares: 150,
          likes: 420,
          views: 8000,
          clicks: 3100,
          platform: 'Web',
          tags: ['infrastructure', 'transport', 'repairs'],
        },
        {
          articleId: 'ART002',
          authorId: 'AUTH002',
          author: 'John Mugisha',
          title: "Uganda's Economy Rebounds in Q1",
          category: 'Business',
          avgDuration: '00:12:30',
          bounceRate: 0.02,
          publishDate: '2025-03-05',
          shares: 210,
          likes: 530,
          views: 12000,
          clicks: 4800,
          platform: 'Web',
          tags: ['economy', 'finance', 'growth'],
        },
      ],
    });
  },

  // GET /api/editorial/topic-virality
  async getTopicVirality(ctx) {
    ctx.send({
      metric: 'Topic Virality',
      data: [
        {
          newsletterId: '132',
          subject: 'The New Vision Premium Content Newsletter 30/04/2025',
          scheduledDate: '2025-04-30 08:15:00',
          totalOpens: 223,
          uniqueOpens: 73,
          totalClicks: 167,
          uniqueClickers: 27,
          clickRate: 74.89,
          estimatedOpenRate: 22300,
          viralityScore: 63.5,
        },
      ],
    });
  },

  // GET /api/editorial/content-freshness
  async getContentFreshness(ctx) {
    ctx.send({
      metric: 'Content Freshness',
      data: [
        {
          id: 101,
          title: 'Government Approves New Budget',
          published_on: '4/30/2025 2:15:00 PM',
          category: { id: 1, name: 'Politics' },
        },
        {
          id: 102,
          title: 'Champions League Final Preview',
          published_on: '4/29/2025 6:10:00 PM',
          category: { id: 2, name: 'Sports' },
        },
      ],
    });
  },

  // GET /api/editorial/update-frequency
  async getUpdateFrequency(ctx) {
    ctx.send({
      metric: 'Update Frequency',
      articles: [
        {
          article_id: 'ART-1',
          title: 'Sample Article 1',
          publish_date: '2025-03-11T20:33:03.858Z',
          author: 'Alice Johnson',
          section: 'Entertainment',
          update_count: 3,
          last_updated_date: '2025-06-19T16:32:06.821Z',
        },
        {
          article_id: 'ART-2',
          title: 'Sample Article 2',
          publish_date: '2025-04-01T10:00:00.000Z',
          author: 'Bob Ssali',
          section: 'Business',
          update_count: 1,
          last_updated_date: '2025-04-05T08:20:00.000Z',
        },
      ],
    });
  },

  // GET /api/editorial/backlog-management
  async getBacklogManagement(ctx) {
    ctx.send({
      metric: 'Backlog Management',
      data: [
        {
          id: 1,
          externalId: 'NV_1',
          created_on: '2025-01-10T08:12:34.000Z',
          published_on: '2025-01-10T12:45:00.000Z',
          last_modified_on: '2025-01-10T13:10:21.000Z',
          title: 'Mock Article 1',
          category: 'Politics',
          author: 'John Smith',
          status: 'published',
          queueTime: 4.5,
          priority: 4,
        },
        {
          id: 2,
          externalId: 'NV_2',
          created_on: '2025-01-11T09:00:00.000Z',
          published_on: null,
          last_modified_on: '2025-01-11T11:30:00.000Z',
          title: 'Mock Article 2',
          category: 'Business',
          author: 'Sarah Kintu',
          status: 'pending',
          queueTime: 2.5,
          priority: 2,
        },
      ],
    });
  },

  // GET /api/editorial/editing-cycle-times
  async getEditingCycleTimes(ctx) {
    ctx.send({
      metric: 'Editing cycle times',
      articles: [
        {
          pageTitle: 'Bunyoro bishop condemns alcoholism',
          author: 'James Opio',
          streamName: 'New Vision Website',
          platform: 'web',
          averageDuration: '00:10:21',
          percentageScrolled: 10,
          bounceRate: 1,
          createdOn: '2025-01-01T16:50:02Z',
          publishedOn: '2025-01-01T19:57:00Z',
          editingDuration: 186,
          editor: 'Douglas Mubiru',
          updatesCount: 0,
          updateLogs: [],
        },
        {
          pageTitle: 'Uganda signs new trade agreement',
          author: 'Grace Nalwanga',
          streamName: 'New Vision Website',
          platform: 'web',
          averageDuration: '00:08:45',
          percentageScrolled: 65,
          bounceRate: 0,
          createdOn: '2025-01-02T10:20:00Z',
          publishedOn: '2025-01-02T13:10:00Z',
          editingDuration: 170,
          editor: 'Hannington Mutabazi',
          updatesCount: 1,
          updateLogs: ['Headline updated after editor review'],
        },
      ],
    });
  },

  // GET /api/editorial/error-rates
  async getErrorRates(ctx) {
    ctx.send({
      metric: 'Error Rates',
      articles: [
        {
          pageTitle: 'Environmental conservation strategies #1',
          author: 'James Opio',
          streamName: 'New Vision Website',
          platform: 'web',
          createdOn: '8/27/2025 8:47:00 AM',
          publishedOn: '8/27/2025 11:55:00 AM',
          editingDuration: 188,
          editor: 'Michael Ssenyonjo',
          updates: 3,
          date: '2025-03-13',
        },
      ],
    });
  },

  // GET /api/editorial/version-control
  async getVersionControl(ctx) {
    ctx.send({
      metric: 'Version control metrics',
      articles: [
        {
          title: 'UCDA, three other agencies officially hand over to agriculture ministry',
          dateCreated: '1/2/2025 8:35:51 PM',
          datePublished: '1/2/2025 10:59:26 PM',
          category: 'News',
          tags: ['UCDA', 'NAADS', 'CDO', 'DDA', 'MAAIF', 'Rationalisation'],
          authors: ['Robert Atuhaire'],
          editor: 'Hannington Mutabazi',
        },
      ],
    });
  },

  // GET /api/editorial/byline-performance
  async getBylinePerformance(ctx) {
    ctx.send({
      metric: 'Personal byline performance',
      data: [
        {
          articleId: 'ART-2026-12345',
          authorId: 'AUTH-001',
          authorName: 'John Mugisha',
          authorRole: 'Senior Reporter',
          articleTitle: "Uganda's Economy Shows Growth in Q1 2026",
          publishedDate: '2026-02-15T08:30:00Z',
          category: 'Business',
          wordCount: 850,
          totalReads: 15420,
          uniqueReaders: 12350,
          averageReadDurationSeconds: 145.5,
          completionRatePercent: 67.5,
          averageScrollDepthPercent: 78.2,
          socialShares: 234,
          comments: 45,
          likes: 567,
          bounceRatePercent: 32.5,
          engagementScore: 78.5,
          readabilityScore: 65.3,
          seoScore: 82.0,
          articleQualityRating: 4.5,
          corrections: 1,
          timeToPublishHours: 6.5,
        },
      ],
    });
  },

  // GET /api/editorial/source-effectiveness
  async getSourceEffectiveness(ctx) {
    ctx.send({
      metric: 'Source effectiveness',
      data: [
        {
          articleId: 'ART-2026-12345',
          sessionStartTime: '2026-02-16T14:25:00Z',
          trafficSource: 'Organic Search',
          sourceDetail: 'Google Organic',
          referrerUrl: 'https://www.google.com/search?q=uganda+economy+2026',
          referrerDomain: 'google.com',
          socialPlatform: 'N/A',
          searchKeywords: 'uganda economy 2026 growth',
          campaignName: null,
          deviceType: 'Mobile',
          sessionDurationSeconds: 312,
          pagesViewed: 4,
          bounced: false,
          converted: true,
          conversionType: 'Newsletter Signup',
          userLocation: 'Kampala',
        },
      ],
    });
  },

  // GET /api/editorial/social-amplification
  async getSocialAmplification(ctx) {
    ctx.send({
      metric: 'Social amplification',
      data: [
        {
          articleId: 'ART-2026-20001',
          articleTitle: 'Uganda Economic Outlook 2026: Growth and Challenges',
          publishedDate: '2026-02-15T08:30:00Z',
          platform: 'All Platforms',
          totalShares: 1820,
          platformSpecificShares: {
            facebook: 640,
            twitter: 410,
            instagram: 320,
            linkedin: 210,
            whatsapp: 180,
            tiktok: 45,
            other: 15,
          },
          totalLikes: 5240,
          totalComments: 612,
          totalRetweets: 390,
          totalReach: 78500,
          viralityScore: 82.4,
          sentimentScore: 0.68,
          sentimentBreakdown: { positive: 480, neutral: 120, negative: 35 },
          influencerShares: 21,
          clickThroughsFromSocial: 6430,
          socialConversionRate: 6.8,
          peakShareTime: '2026-02-15T14:00:00Z',
          sharesFirst24Hours: 1280,
          shareVelocity: 53.3,
          topSharingDemographic: {
            ageGroup: '25-34',
            gender: 'All',
            location: 'Kampala',
          },
        },
      ],
    });
  },

  // GET /api/editorial/visual-asset-engagement
  async getVisualAssetEngagement(ctx) {
    ctx.send({
      metric: 'Visual asset engagement',
      data: [
        {
          externalId: 'NV_225454',
          title: '🌳 Bible verse of the day 31st December, 2025',
          publishedDate: '12/31/2025 8:00:00 AM',
          category: 'News',
          tags: ['Bible verse', 'Vision inspiration'],
          author: 'Godfrey',
          editor: 'Jacquiline Nakandi',
          platform: 'web',
          avgSessionTime: '00:02:15',
          scrollDepth: 45,
          bounceRate: 1,
          views: 43,
          shares: 47,
          comments: 12,
          clicks: 15,
          visualType: 'video',
          visualCount: 3,
          visualEngagementScore: 0.86,
        },
      ],
    });
  },

  // GET /api/editorial/asset-usage-tracking
  async getAssetUsageTracking(ctx) {
    ctx.send({
      metric: 'Usage tracking',
      data: [
        {
          assetId: 'img-001',
          assetType: 'photo',
          usedInArticles: [
            {
              title: 'Floods Hit Kampala',
              url: '/article/floods',
              dateUsed: '2025-08-01',
              author: 'John Doe',
              platform: 'Web',
            },
            {
              title: 'Rescue Operations',
              url: '/article/rescue',
              dateUsed: '2025-08-02',
              author: 'Mary Jane',
              platform: 'App',
            },
          ],
          usageCount: 2,
        },
      ],
    });
  },

  // GET /api/editorial/rights-management
  async getRightsManagement(ctx) {
    ctx.send({
      metric: 'Rights Management',
      data: [
        {
          assetId: 'vid-203',
          assetType: 'video',
          title: 'Wildlife in Uganda',
          license: {
            source: 'Shutterstock',
            terms: 'Royalty-free',
            expiresOn: '2025-06-30',
            attribution: 'Video courtesy of Shutterstock',
            status: 'expired',
          },
          violations: ['Used in sponsored content after license expiry'],
        },
      ],
    });
  },

  // GET /api/editorial/segment-popularity
  async getSegmentPopularity(ctx) {
    ctx.send({
      metric: 'Segment popularity',
      data: [
        {
          category: 'Health',
          articleCount: 51,
          avgDurationSeconds: 516.4,
          avgScrollPercent: 37.1,
          avgBounceRate: 0.06,
        },
        {
          category: 'Tourism',
          articleCount: 12,
          avgDurationSeconds: 479.3,
          avgScrollPercent: 7.5,
          avgBounceRate: 0.04,
        },
        {
          category: 'Politics',
          articleCount: 34,
          avgDurationSeconds: 398.1,
          avgScrollPercent: 52.3,
          avgBounceRate: 0.08,
        },
        {
          category: 'Business',
          articleCount: 28,
          avgDurationSeconds: 442.7,
          avgScrollPercent: 44.6,
          avgBounceRate: 0.05,
        },
      ],
    });
  },

  // GET /api/editorial/audience-retention
  async getAudienceRetention(ctx) {
    ctx.send({
      metric: 'Audience retention',
      data: [
        {
          userId: 'USER-a7b2c9d4e1f6',
          firstVisitDate: '2025-08-15T10:00:00Z',
          lastVisitDate: '2026-02-18T14:30:00Z',
          totalVisits: 52,
          totalArticlesRead: 168,
          averageArticlesPerVisit: 3.23,
          totalTimeSpentMinutes: 1420,
          averageSessionDurationMinutes: 27.3,
          visitFrequency: 'Weekly',
          daysSinceLastVisit: 3,
          userTenureDays: 187,
          retentionCohort: '2025-08',
          isActive: true,
          isRetained: true,
          churnRisk: 'Low',
          preferredCategories: ['Business', 'Politics', 'Technology'],
          preferredAuthors: ['John Mugisha', 'Sarah Nakato'],
          devicePreference: 'Mobile',
          subscriptionStatus: 'Subscriber',
          subscriptionStartDate: '2025-09-01',
          lifetimeValue: 180000,
          engagementActions: {
            totalComments: 24,
            totalShares: 18,
            totalLikes: 96,
            totalSaves: 12,
          },
          weeklyActiveWeeks: 26,
          consecutiveVisitStreak: 4,
          longestVisitStreak: 12,
        },
      ],
    });
  },

  // GET /api/editorial/social-sentiment
  async getSocialSentiment(ctx) {
    ctx.send({
      metric: 'Social sentiment',
      sentiments: [
        {
          date: '2025-06-01',
          mentions: [
            {
              comment: 'Please post more content from Bukedde TV on Threads.',
              platform: 'instagram',
              date: '2025-06-01',
            },
          ],
          ratings: [
            {
              rate: 4.3,
              platform: 'instagram',
              date: '2025-06-01',
            },
          ],
        },
      ],
    });
  },

  // GET /api/editorial/case-resolution
  async getCaseResolution(ctx) {
    ctx.send({
      metric: 'Case Resolution',
      data: [
        {
          case_id: 'C001',
          case_type: 'Production Delay',
          department: 'Production',
          priority: 'Critical',
          status: 'Closed',
          open_date: '2024-04-30',
          close_date: '2024-05-29',
          resolution_time_days: 29,
          description: 'Employee expense reimbursement delays',
          assigned_to: 'Tomas Blick',
        },
        {
          case_id: 'C002',
          case_type: 'Editorial Complaint',
          department: 'Editorial',
          priority: 'Medium',
          status: 'Open',
          open_date: '2025-01-10',
          close_date: null,
          resolution_time_days: null,
          description: 'Reader complaint about article inaccuracy',
          assigned_to: 'Grace Namaganda',
        },
      ],
    });
  },

  // GET /api/editorial/compliance-breach
  async getComplianceBreach(ctx) {
    ctx.send({
      metric: 'Compliance breach tracking',
      data: [
        {
          breach_id: 'B001',
          department: 'Finance',
          breach_type: 'Safety Protocol',
          severity: 'Medium',
          breach_date: '2025-05-21',
          resolved: true,
          resolution_date: '2025-06-17',
          description: 'Editorial bias detected in news coverage',
          corrective_action: 'Editorial guidelines review and update completed',
          reported_by: 'Clayton Simonis',
        },
      ],
    });
  },

  // GET /api/editorial/risk-exposure
  async getRiskExposure(ctx) {
    ctx.send({
      metric: 'Risk exposure dashboards',
      riskExposure: [
        {
          category: 'Financial',
          metrics: {
            cash_flow_variance_percent: 12,
            debt_ratio_percent: 45,
            overdue_invoices_percent: 8,
            budget_deviation_percent: 5,
            liquidity_ratio: 1.8,
          },
          risk_level: 'Moderate',
          trend: 'Stable',
          suggested_action: 'Monitor cash flow closely and reduce overdue invoices.',
        },
        {
          category: 'Operational',
          metrics: {
            cash_flow_variance_percent: 5,
            debt_ratio_percent: 30,
            overdue_invoices_percent: 3,
            budget_deviation_percent: 2,
            liquidity_ratio: 2.1,
          },
          risk_level: 'Low',
          trend: 'Improving',
          suggested_action: 'Continue current operational controls.',
        },
      ],
    });
  },

  // GET /api/editorial/mitigation-effectiveness
  async getMitigationEffectiveness(ctx) {
    ctx.send({
      metric: 'Mitigation effectiveness',
      data: [
        {
          department: 'Finance',
          totalRisks: 28,
          mitigatedRisks: 17,
          mitigationEffectiveness: 61,
          topIneffectiveControls: ['Incident Response', 'System Redundancy'],
          residualRiskScore: 45,
        },
        {
          department: 'Operations',
          totalRisks: 20,
          mitigatedRisks: 20,
          mitigationEffectiveness: 100,
          topIneffectiveControls: ['Vendor Management', 'Incident Response'],
          residualRiskScore: 25,
        },
      ],
    });
  },

  // GET /api/editorial/attendance-rates
  async getAttendanceRates(ctx) {
    ctx.send({
      metric: 'Attendance rates',
      attendanceTrends: [
        {
          recordId: 'ATT-0001',
          eventName: 'Digital Media Growth Summit',
          date: '2025-03-12',
          totalRegistrations: 420,
          totalAttendees: 368,
          totalSeats: 450,
          marketingChannels: {
            SocialMedia: 180,
            EmailCampaign: 120,
            DirectWebsite: 75,
            Partnerships: 45,
          },
        },
      ],
    });
  },

  // GET /api/editorial/sponsor-roi
  async getSponsorROI(ctx) {
    ctx.send({
      metric: 'Sponsor ROI',
      data: [
        {
          recordId: 'SPN-0001',
          sponsorName: 'TechNova Solutions',
          date: '2025-02-15',
          revenue: 125000,
          investment: 80000,
          acquisitions: 320,
          marketingChannels: {
            SocialMedia: 140,
            EmailCampaign: 85,
            PaidAds: 65,
            Partnerships: 30,
          },
        },
      ],
    });
  },

  // GET /api/editorial/participant-feedback
  async getParticipantFeedback(ctx) {
    ctx.send({
      metric: 'Participant feedback',
      data: [
        {
          recordId: 'FBK-0001',
          eventName: 'Digital Media Growth Summit',
          sessionTitle: 'Future of AI in Journalism',
          date: '2025-03-12',
          attended: true,
          gaveFeedback: true,
          rating: 5,
        },
        {
          recordId: 'FBK-0002',
          eventName: 'Digital Media Growth Summit',
          sessionTitle: 'Audience Analytics in 2025',
          date: '2025-03-12',
          attended: true,
          gaveFeedback: true,
          rating: 4,
        },
      ],
    });
  },

  // GET /api/editorial/recruitment-funnel
  async getRecruitmentFunnel(ctx) {
    ctx.send({
      metric: 'Recruitment funnel',
      data: [
        {
          candidateId: 'C001',
          name: 'John Okello',
          age: 28,
          gender: 'Male',
          education: "Bachelor's in Journalism",
          experienceYears: 3,
          recruitmentSource: 'LinkedIn',
          applicationDate: '2025-01-05',
          position: 'Reporter',
          status: 'Applied',
          screeningResult: 'Pass',
          assessmentType: 'Writing Test',
          assessmentResult: 'Good',
          interviewStage: 'Screening',
          interviewDate: '2025-01-10',
          interviewer: 'HR Officer',
          interviewOutcome: 'Pass',
          offerStatus: 'Pending',
          hireDate: null,
        },
      ],
    });
  },

  // GET /api/editorial/retention-risk
  async getRetentionRisk(ctx) {
    ctx.send({
      metric: 'Retention risk',
      data: [
        {
          employeeId: 'E001',
          name: 'John Okello',
          gender: 'Male',
          department: 'Editorial',
          role: 'Journalist',
          hireDate: '2021-04-15',
          recordDate: '2025-08-25',
          jobSatisfaction: 8,
          managerSupport: 7,
          careerGrowth: 7,
          retentionRisk: 'Low',
          likelyToLeave: false,
        },
        {
          employeeId: 'E002',
          name: 'Amina Nakato',
          gender: 'Female',
          department: 'Editorial',
          role: 'Senior Journalist',
          hireDate: '2019-09-01',
          recordDate: '2025-08-25',
          jobSatisfaction: 5,
          managerSupport: 4,
          careerGrowth: 4,
          retentionRisk: 'High',
          likelyToLeave: true,
        },
      ],
    });
  },

  // GET /api/editorial/training-effectiveness
  async getTrainingEffectiveness(ctx) {
    ctx.send({
      metric: 'Training effectiveness',
      data: [
        {
          trainingId: 'T001',
          department: 'Editorial',
          trainer: 'Alice Kim',
          attendanceRate: 44,
          completionRate: 0,
          preAssessmentAverage: 61.4,
          postAssessmentAverage: 85,
          onTheJobPerformanceScore: 80.2,
          participantSatisfaction: 87.8,
          totalParticipants: 5,
        },
      ],
    });
  },

  // GET /api/editorial/data-governance
  async getDataGovernance(ctx) {
    ctx.send({
      metric: 'Data governance',
      data: [
        {
          department: 'Finance',
          system: 'ERP',
          data_quality_score: 91,
          records_checked: 15682,
          duplicates_found: 10,
          compliance_status: 'Compliant',
          classified_datasets: 80,
          access_requests: 30,
          failed_access_attempts: 5,
          metadata_completeness: 81,
          last_audit: '2025-01-06',
        },
      ],
    });
  },

  // GET /api/editorial/insight-adoption
  async getInsightAdoption(ctx) {
    ctx.send({
      metric: 'Insight adoption rates',
      data: [
        {
          recordId: 'INS-001',
          insightName: 'Mobile Audience Growth Report',
          department: 'Editorial',
          date: '2026-02-14',
          views: 142,
          downloads: 38,
          adoptionScore: 72,
        },
        {
          recordId: 'INS-002',
          insightName: 'Q1 Content Performance Digest',
          department: 'Sales',
          date: '2026-02-10',
          views: 87,
          downloads: 22,
          adoptionScore: 55,
        },
      ],
    });
  },
};
