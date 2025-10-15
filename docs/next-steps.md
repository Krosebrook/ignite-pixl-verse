# Next 5 Logical Development Steps

## Overview
This document outlines the next five critical development steps to complete the FlashFusion Creative Mega App MVP and move toward production readiness.

---

## Step 1: Complete Brand Kit Management UI
**Priority:** High  
**Estimated Effort:** 2-3 days

### Why This Matters
Brand consistency is core to the FlashFusion value proposition. Users need a centralized place to define their brand identity (colors, fonts, logos, voice) that feeds into all AI generation.

### What to Build
- **Brand Kit Creation Page** (`/brand-kit`)
  - Form to input brand name, tagline, primary/secondary colors
  - Logo upload to `brand-logos` storage bucket
  - Font family selection dropdown
  - Brand voice/tone settings (casual, professional, playful)
  - Save to `brand_kits` table with org_id association

- **Brand Kit Selector**
  - Dropdown in Content Studio to select active brand kit
  - Apply brand kit parameters to AI prompts automatically
  - Display selected brand kit info in header/sidebar

### Technical Details
```typescript
// Example: Brand kit context in Content Studio
const { data: brandKit } = useQuery({
  queryKey: ["brand-kit", selectedBrandKitId],
  queryFn: async () => {
    const { data } = await supabase
      .from("brand_kits")
      .select("*")
      .eq("id", selectedBrandKitId)
      .single();
    return data;
  },
});

// Inject brand kit into AI prompt
const enrichedPrompt = `${prompt}\nBrand context: ${brandKit.colors}, ${brandKit.voice_tone}`;
```

### Success Criteria
- Users can create and save brand kits
- Brand kit data is applied to content generation prompts
- Logo uploads work and display in UI
- RLS policies ensure users only see their org's brand kits

---

## Step 2: Campaign Creation & Management
**Priority:** High  
**Estimated Effort:** 3-4 days

### Why This Matters
Campaigns group assets, define goals, and orchestrate multi-channel publishing. This is the bridge between content generation and scheduled posting.

### What to Build
- **Campaigns List Page** (`/campaigns`)
  - Table showing campaign name, status, asset count, created date
  - "New Campaign" button to create campaign
  - Edit/Delete actions with confirmation dialogs

- **Campaign Creation Wizard**
  - Step 1: Basic Info (name, description, objectives)
  - Step 2: Select Assets (multi-select from asset library)
  - Step 3: Target Audience (segments from `segments` table)
  - Step 4: Review & Save
  - Call `campaigns-draft` edge function to save

- **Campaign Detail View**
  - Show campaign header with metrics
  - Grid of associated assets
  - Schedule posts button → navigate to `/schedule` with campaign pre-selected

### Technical Details
```typescript
// Edge function call example
const { data, error } = await supabase.functions.invoke("campaigns-draft", {
  body: {
    name: campaignName,
    description,
    asset_ids: selectedAssetIds,
    segment_id: selectedSegmentId,
    brand_kit_id: selectedBrandKitId,
  },
});
```

### Success Criteria
- Users can create campaigns with name, description, and linked assets
- Campaign data persists in `campaigns` table
- Assets can be added/removed from campaigns
- Campaign status (draft, active, archived) is tracked and displayed

---

## Step 3: Scheduling & Publishing UI
**Priority:** High  
**Estimated Effort:** 3-4 days

### Why This Matters
Scheduling transforms static assets into timed social media posts. Users need a visual calendar to plan and manage their posting strategy.

### What to Build
- **Schedule Timeline Page** (`/schedule`)
  - Calendar view (day/week/month) using `react-big-calendar` or similar
  - Drag-and-drop to schedule posts
  - Filter by campaign, platform, status

- **Schedule Post Dialog**
  - Select asset from campaign
  - Choose platform (Twitter, Instagram, LinkedIn)
  - Set publish date/time
  - Add caption/message
  - Preview post rendering
  - Save to `schedules` table

- **Post Queue Management**
  - List of scheduled posts with edit/delete
  - Retry failed posts
  - View post status (pending, published, failed)

### Technical Details
```typescript
// Schedule edge function call
const { data, error } = await supabase.functions.invoke("schedule", {
  body: {
    asset_id: assetId,
    platform: "twitter",
    scheduled_for: scheduledDate.toISOString(),
    caption: postCaption,
    retry_count: 0,
  },
});
```

### Worker Integration
- Ensure `supabase/functions/schedule/index.ts` handles CRON triggers
- Implement retry logic with exponential backoff
- Log publish attempts to `analytics_events`

### Success Criteria
- Users can schedule posts to future dates/times
- Calendar view displays scheduled posts
- Posts are published automatically at scheduled time (via edge function CRON)
- Failed posts can be retried manually

---

## Step 4: User Authentication & Onboarding Flow
**Priority:** High  
**Estimated Effort:** 2-3 days

### Why This Matters
Currently, the app assumes users are authenticated. We need a complete auth flow with signup, login, password reset, and onboarding to get users productive quickly.

### What to Build
- **Enhanced Auth Page** (`/auth`)
  - Tabs for Sign Up / Sign In
  - Email + password forms with validation
  - Google OAuth button (optional)
  - "Forgot Password" link → `/auth/reset-password`
  - Auto-confirm email enabled in Supabase config

- **Onboarding Flow** (after signup)
  - Step 1: Create Organization
    - Input org name
    - Insert into `orgs` table
    - Create `members` entry with role='owner'
  
  - Step 2: Create First Brand Kit
    - Quick form: brand name, primary color, logo upload
    - Insert into `brand_kits` table
  
  - Step 3: Welcome Dashboard
    - Show tutorial cards with "Next Steps"
    - Link to Content Studio to generate first asset

- **Profile Completion**
  - Auto-create profile in `profiles` table on signup (trigger function)
  - Prompt for display_name and avatar on first login

### Technical Details
```sql
-- Trigger to auto-create profile and org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Success Criteria
- Users can sign up with email/password
- Auto-confirm email is enabled (no email verification needed)
- Onboarding wizard creates org and brand kit
- Profile is auto-created with display name
- Users redirected to dashboard after onboarding

---

## Step 5: Marketplace & Template Library
**Priority:** Medium  
**Estimated Effort:** 2-3 days

### Why This Matters
Pre-built template packs accelerate user value. Users can install proven templates (e.g., "E-commerce Product Launch", "YouTube Thumbnail Pack") and customize for their brand.

### What to Build
- **Marketplace Page** (`/marketplace`)
  - Grid of template packs with thumbnails
  - Categories: E-commerce, Social Media, Video, Audio
  - Search/filter by category, popularity
  - Pack detail modal showing included assets

- **Pack Installation**
  - "Install Pack" button calls `marketplace-install` edge function
  - Edge function copies assets from pack JSON to user's org
  - Applies user's brand kit to templates on install
  - Shows success toast with link to installed assets

- **Library Page** (`/library`)
  - Display user's installed packs
  - Browse pack contents
  - "Use This Template" button → pre-fills Content Studio prompt

### Technical Details
```typescript
// Install pack edge function
const { data, error } = await supabase.functions.invoke("marketplace-install", {
  body: {
    pack_id: packId,
    org_id: userOrgId,
    brand_kit_id: userBrandKitId,
  },
});

// Edge function logic:
// 1. Fetch pack JSON from marketplace_items
// 2. Parse assets array
// 3. For each asset, insert into assets table with org_id
// 4. Apply brand kit colors/fonts to asset metadata
// 5. Return installed asset IDs
```

### Example Pack JSON
```json
{
  "id": "ecom-storefront",
  "name": "E-commerce Storefront Pack",
  "description": "Complete set for product launches",
  "category": "ecommerce",
  "assets": [
    {
      "type": "image",
      "name": "Hero Banner Template",
      "prompt": "Product hero banner with [BRAND_COLOR] background"
    },
    {
      "type": "text",
      "name": "Product Description",
      "prompt": "Write a compelling product description in [BRAND_VOICE]"
    }
  ]
}
```

### Success Criteria
- Marketplace displays at least 3 template packs
- Users can install packs with one click
- Installed assets appear in user's asset library
- Brand kit variables are substituted in templates

---

## Implementation Priority

1. **Week 1:** Step 4 (Auth & Onboarding) + Step 1 (Brand Kit UI)
2. **Week 2:** Step 2 (Campaign Management)
3. **Week 3:** Step 3 (Scheduling UI)
4. **Week 4:** Step 5 (Marketplace) + Polish & Testing

---

## What Can Go Wrong

### Technical Risks
1. **Storage Bucket RLS Policies**
   - **Risk:** Users can access other orgs' files
   - **Mitigation:** Implement strict RLS policies on storage.objects with owner_id checks

2. **Edge Function Timeouts**
   - **Risk:** AI generation takes >60s, function times out
   - **Mitigation:** Use async job queue pattern, poll for results

3. **Brand Kit Application**
   - **Risk:** Brand variables not properly injected into prompts
   - **Mitigation:** Unit test prompt enrichment logic

### UX Risks
1. **Onboarding Drop-off**
   - **Risk:** Multi-step onboarding is too long, users abandon
   - **Mitigation:** Make org/brand kit creation optional, allow skip

2. **Scheduling Confusion**
   - **Risk:** Users don't understand timezone handling
   - **Mitigation:** Display user's timezone, show preview of scheduled posts

### Data Risks
1. **Orphaned Assets**
   - **Risk:** Assets not linked to campaigns become lost
   - **Mitigation:** Add "All Assets" view separate from campaigns

2. **RLS Policy Gaps**
   - **Risk:** Missing policies expose data across orgs
   - **Mitigation:** Run `supabase db test` for negative RLS tests

---

## Testing Checklist

### Before Deploying Each Step
- [ ] All RLS policies tested with negative cases
- [ ] Edge functions have error handling and logging
- [ ] UI components have loading/error states
- [ ] Form validation prevents invalid data
- [ ] Mobile responsive design tested
- [ ] Accessibility (WCAG AA) verified
- [ ] Performance budgets met (Lighthouse)

---

## Success Metrics

After completing these 5 steps, measure:
- **Onboarding Completion Rate:** % of signups who complete onboarding
- **Time to First Asset:** How long from signup to first generated asset
- **Campaign Creation Rate:** % of users who create campaigns
- **Schedule Adoption:** % of campaigns with scheduled posts
- **Marketplace Installs:** # of template packs installed per user

---

## Conclusion

These 5 steps transform FlashFusion from a scaffold to a functional MVP. Prioritize user value and data security in every decision. Keep the scope tight—resist adding features not explicitly listed here until these are solid.

**Next after MVP:** Real-time collaboration, team permissions, advanced analytics, webhook integrations, white-label options.
