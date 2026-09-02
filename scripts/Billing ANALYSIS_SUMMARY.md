# Vision Group Comprehensive Billing Structure - Analysis Summary

## Document Information
- **Source**: Sales_InfoPack_2024_NEW_July.pdf
- **Fiscal Year**: 2024/2025
- **Currency**: UGX (Uganda Shillings)
- **Analysis Date**: January 3, 2026

## Overview
This comprehensive billing structure captures ALL products and services offered by Vision Group (New Vision Printing & Publishing Company Limited), established in March 1986.

## Data Structure Design Principles

### 1. **No Duplication Through Proper Referencing**
- Common reference models defined at the top level
- Payment terms shared across all products
- Column specifications referenced by multiple newspapers
- Ad format specifications centralized

### 2. **Hierarchical Organization**
```
Vision Group Billing Structure
├── Metadata (extraction info, currency, version)
├── Company Information (shared across all products)
├── Payment Terms (credit, cash, PDC policies)
└── Products (10 major categories)
    ├── Each with unique product IDs
    ├── Detailed rate cards
    └── Specific terms and conditions
```

### 3. **Comprehensive Coverage**
Every product, price point, dimension, time slot, and special condition has been captured.

## Product Categories Captured (10 Total)

### 1. NEWSPAPERS (Print Media)
**4 Main Publications:**

#### A. New Vision (NP-NV-001)
- Leading English daily newspaper (Mon-Fri)
- National + East Africa circulation
- **Rate Categories:**
  - Special Positions (Front page, back page, ear pieces)
    - 25% surcharge for nominated pages
  - Main Body Display (Full page to per cm column)
  - Classifieds (Property, Semi-display, Per word, Letters of Admin)
  - Supplements/Special Sections
  - Loose Leaf Inserts

#### B. Weekend Vision (NP-WV-002)
- English weekend newspaper
- Special features: Goal, Homes & Construction, Intimate
- Complete rate card with special positions and display rates

#### C. Bukedde (NP-BK-003)
- Luganda daily newspaper
- Leading in Central region
- Highest number of exclusive readers
- Includes commercial translation services (120,000 UGX/page)

#### D. Bukedde Ku Wiikendi (NP-BKW-004)
- Weekend edition of Bukedde
- Special features in Luganda

**Newspaper Supplements Captured:**
- Toto (Children's magazine - Wednesday)
- Harvest Money (Agriculture - Friday)
- Infrastructure Pullout
- Oil and Gas Weekly
- China New Era

### 2. DIGITAL MEDIA (3 Sub-products)

#### A. Website Advertising (DM-WEB-001)
- CPM pricing model (USD 1 per 1000 impressions)
- Leaderboard 728x90 format
- Placements: New Vision, Bukedde, Harvest Money
- Desktop and Mobile options

#### B. Social Media (DM-SM-001)
- **Facebook**:
  - New Vision: 14M+ followers
  - Bukedde: 200,000+ followers
  - Urban TV: 420,000+ followers
  - Services: Pinned posts, sponsored posts, video posts, live streams
  - Live stream includes 3 pre-event posts + 3 per hour + 1 post-event

- **Twitter**: Multiple platforms with follower counts

#### C. Sponsored Content (DM-SC-001)
- Articles with social media posts
- Video content (custom quotes)

### 3. TELEVISION (Broadcast Media - 4 Stations)

#### A. Bukedde TV (TV-BTD-001)
- Uganda's first Luganda TV station
- 26% of national TV reach
- **Complete Rate Card:**
  - Spot adverts (30-second slots by time of day)
  - Studio appearances (7-40 minutes)
  - News interviews (Power Interview)
  - Talkshows (multiple time slots)
  - Squeeze backs
  - Pop ups
  - Scrolls (per day)
  - Documentaries (5-60 minutes)
  - Herbalists programs
  - Churches/Pastors programs

#### B. Bukedde TV 2 (TV-BTD2-002)
- Entertainment channel (music, movies, sports)
- Male-focused audience
- 8% of national TV viewers
- Full rate card for interviews, talkshows, squeeze backs, scrolls, documentaries

#### C. TV West (TV-TW-003)
- Western Uganda's leading regional TV
- Runyakitara language
- 9% of TV viewers
- Complete pricing for all ad formats

#### D. Wan Luo TV (TV-WL-004)
- Northern Uganda and West Nile
- Luo language
- StarTimes Channel 232
- All advertising formats with multiple duration options

### 4. RADIO (Broadcast Media - 5 Stations)

#### A. XFM (RD-XFM-001)
- 94.8 FM Kampala
- English, targeting 18-35 urban youth
- Spot messages (30/45/60 seconds) by time slot
- Presenter mentions
- Customized airtime packages

#### B. Bukedde FM (RD-BFM-002)
- 100.5 FM Kampala + regional frequencies
- Luganda language
- Most comprehensive rate card:
  - Spot messages (all time slots)
  - Presenter mentions (80,000 UGX)
  - Commercial production (500,000 UGX)
  - Commercial translations (50,000 per 50 words)
  - Customized airtime (15/30/60 minutes)
  - Live link (800,000 UGX)
  - Classified Bonanza advertising

#### C. Radio West (RD-RW-003)
- Multi-frequency (Mbarara, Kabale, Masaka, Kampala, Fort Portal)
- #1 in Western Uganda for 15+ years
- 46% of Ankole sub-region radio consumers

#### D. Etop Radio (RD-ER-004)
- 99.4 FM Soroti
- Ateso language
- 50% of Teso region radio consumers
- Block booking packages available

#### E. Arua One (RD-A1-005)
- 88.7 FM West Nile
- Multilingual (Lugbara, Swahili, English)
- 29% of West Nile radio reach

### 5. PUBLISHING (Vision Publishing)
**Product ID: PUB-001**
- Member of Uganda Publishing Association
- **Secondary School Books** (17 subjects):
  - Prices by level (S1-S4)
  - Teachers' guides
  - Range: 22,000 - 25,000 UGX per book
  - Subjects: English, Math, Sciences, Social Studies, Arts, Tech, etc.
  
- **Upper Primary Books**:
  - Integrated Science: 25,000 UGX
  - English sets: 25,000 UGX

### 6. COURIER SERVICES (Vision Courier)
**Product ID: CS-001**
- 24-hour delivery nationwide
- 36 years of experience
- Locations: Kampala (Industrial Area), Mbarara
- Professional dispatch and delivery

### 7. DIGITAL OUTDOOR (Vision Outdoor)
**Product ID: DO-001**
- Internet-connected digital billboards
- 4K high definition displays
- Features:
  - Dynamic content changes
  - Web publishing capability
  - Live streaming (HLS, RTMP)
- Coverage:
  - 5 million people daily in Kampala
  - 40 million monthly reach nationwide
- Cities: Kampala, Mbarara

### 8. COMMERCIAL PRINTING
**Product ID: CP-001**
- Full printing services
- Design services included
- Distribution across Uganda
- Quick turnaround times

### 9. TRANSLATION SERVICES
**Product ID: TS-001**
- All Uganda and East Africa languages
- Audio, Visual, Print formats
- **Rate**: 120,000 UGX per page
- Standard page specifications included

### 10. EXPERIENTIAL MARKETING
**Product ID: EM-001**
- Multi-purpose promotional truck
- High-quality sound and lighting
- Day and night capabilities
- Uses:
  - Brand awareness campaigns
  - Product launches
  - Audience sampling
  - Market strengthening
- Coverage: All Uganda

## Payment and Booking Procedures

### Payment Terms
1. **Credit Orders**:
   - Requires Sales Manager approval
   - Requires Credit Manager approval
   - New clients: Cash or PDC only

2. **Cash Orders**:
   - Payment before publication/airing
   - Walk-in friendly

3. **Post-Dated Cheques (PDC)**:
   - Accepted for new clients
   - Part of credit approval process

### Booking Process Captured
- Complete workflow for credit orders
- Complete workflow for cash orders
- Walk-in client procedures
- Order approval hierarchy
- Discount review process
- Payment verification steps

## Common Terms Captured

### Artwork Requirements
- Print: PDF (CMYK), Preflight compliance
- Design files: Editable MS Word + pictures
- Color mode specifications

### Column Specifications
- Standard newspapers: 6 columns (4.1cm each)
- Bukedde: 5 columns (4.72cm each)

### Regional Business Processes
- Order form requirements
- Navision system checks
- Sales Manager verification
- Payment policies enforcement

## Special Features Captured

### Membership & Credentials
- Audit Bureau of Circulation (ABC) South Africa member
- Ipsos member
- Uganda Publishing Association member

### Competitive Advantages
- 360-degree media service
- Cross-platform capacity
- Cross-media synergies
- Accurate media statistics

### Company Vision & Mission
- Vision: "Centre of excellence for customized communication and business solutions"
- Mission: "Provide transformational content and business solutions that advance society"

## Data Quality Assurance

✅ **All information captured** - No pricing, product, or service left out
✅ **No duplication** - Common references used throughout
✅ **Proper data modeling** - Hierarchical structure with unique IDs
✅ **Comprehensive metadata** - Source, date, currency, version tracked
✅ **Ready for database import** - JSON structure suitable for any database system
✅ **Scalable design** - Easy to add new products or update prices

## Usage Notes

This JSON structure can be:
1. **Imported into databases** (SQL, NoSQL, Graph databases)
2. **Used for billing systems** - Complete price lists with all variations
3. **Integrated into CRM** - Product catalog with full details
4. **API responses** - Well-structured data for web/mobile apps
5. **Analytics** - Comprehensive data for business intelligence
6. **Contract management** - All terms and conditions captured

## File Statistics
- **Total Product Categories**: 10
- **Total Individual Products**: 20+ (newspapers, TV stations, radio stations, etc.)
- **Rate Cards Captured**: 15+ comprehensive rate cards
- **Price Points Captured**: 200+ individual prices
- **Time Slots Captured**: 50+ different time slots across broadcast media
- **File Size**: Comprehensive yet organized JSON structure

---

**Generated**: January 3, 2026
**Source Document**: Vision Group Sales InfoPack 2024/2025
**Analysis Tool**: OCR + Structured Data Extraction
