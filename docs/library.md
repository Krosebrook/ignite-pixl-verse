# Template & Preset Library

## Overview

The Library is a curated collection of installable templates and AI assistants. Items are versioned, support conflict resolution, and can be installed/upgraded per organization.

## Item Types

### Templates
- **Definition**: Pre-built content structures (e.g., "Instagram Post", "YouTube Short")
- **Payload**: Template name, type, content JSON, thumbnail
- **Use Case**: Quickly create assets from proven designs

### Assistants
- **Definition**: AI prompt configurations with specialized personalities
- **Payload**: System prompt, parameters, examples
- **Use Case**: Task-specific AI helpers (e.g., "SEO Copywriter", "Video Scripter")

## Database Schema

### library_items

```sql
CREATE TABLE library_items (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('template', 'assistant')),
  summary TEXT,
  payload JSONB NOT NULL,
  license TEXT DEFAULT 'INTERNAL',
  thumbnail_url TEXT,
  author TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### library_installs

```sql
CREATE TABLE library_installs (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  item_id UUID NOT NULL,
  version TEXT NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT now(),
  installed_by UUID,
  backup_snapshot JSONB, -- Previous version backup
  UNIQUE(org_id, item_id)
);
```

## Pack Format

### Example: Startup Landing Template

**File**: `example_library/startup-landing.v1.json`

```json
{
  "slug": "startup-landing",
  "version": "1.0.0",
  "kind": "template",
  "name": "Startup Landing Page",
  "summary": "Modern landing page for tech startups with hero, features, and CTA sections",
  "license": "ROYALTY_FREE",
  "author": "FlashFusion Team",
  "tags": ["landing", "startup", "saas", "modern"],
  "thumbnail_url": "https://example.com/thumbnails/startup-landing.jpg",
  "payload": {
    "templates": [
      {
        "name": "Hero Section",
        "type": "html",
        "content": {
          "html": "<section class='hero'>...</section>",
          "css": ".hero { background: linear-gradient(...); }",
          "variables": ["headline", "subheadline", "cta_text"]
        }
      },
      {
        "name": "Features Grid",
        "type": "html",
        "content": {
          "html": "<div class='features-grid'>...</div>",
          "css": ".features-grid { display: grid; }",
          "variables": ["feature_count", "feature_icons"]
        }
      }
    ],
    "brand_rules": {
      "colors": ["#FF7B00", "#00B4D8"],
      "fonts": ["Sora", "Inter"]
    }
  }
}
```

### Example: SEO Copywriter Assistant

```json
{
  "slug": "seo-copywriter",
  "version": "1.0.0",
  "kind": "assistant",
  "name": "SEO Copywriter",
  "summary": "Optimizes copy for search engines while maintaining readability",
  "license": "INTERNAL",
  "author": "FlashFusion Team",
  "tags": ["seo", "content", "copywriting"],
  "payload": {
    "system_prompt": "You are an expert SEO copywriter. Write engaging content optimized for search engines. Always include: 1) Target keyword in first paragraph, 2) Semantic keywords naturally integrated, 3) Clear H1-H3 structure, 4) Meta description under 160 chars.",
    "parameters": {
      "temperature": 0.7,
      "max_tokens": 1000,
      "model": "gpt-4o-mini"
    },
    "examples": [
      {
        "input": "Write product description for eco-friendly water bottle",
        "output": "Discover our premium eco-friendly water bottle – the sustainable hydration solution for conscious consumers. Crafted from 100% recycled materials..."
      }
    ]
  }
}
```

## API Contracts

### GET /functions/v1/library-list
**Response**:
```json
{
  "items": [
    {
      "id": "uuid",
      "slug": "startup-landing",
      "name": "Startup Landing Page",
      "version": "1.0.0",
      "kind": "template",
      "summary": "Modern landing page...",
      "license": "ROYALTY_FREE",
      "thumbnail_url": "https://...",
      "author": "FlashFusion Team",
      "tags": ["landing", "startup"]
    }
  ]
}
```

### POST /functions/v1/library-install
**Request**:
```json
{
  "org_id": "uuid",
  "slug": "startup-landing",
  "version": "1.0.0"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Installed Startup Landing Page v1.0.0",
  "item_id": "uuid",
  "version": "1.0.0",
  "had_previous_version": true
}
```

**Response (200 - Idempotent)**:
```json
{
  "success": true,
  "message": "Already installed",
  "item_id": "uuid",
  "version": "1.0.0"
}
```

## Installation Flow

1. **User Browses**: `/library` page lists all items with search/filter
2. **Click Install**: POST to `library-install` with `slug` + `version`
3. **Conflict Check**: 
   - If item already installed at same version → return success (idempotent)
   - If older version installed → create `backup_snapshot` of existing templates
4. **Install Templates/Assistants**:
   - **Templates**: Upsert to `templates` table for org
   - **Assistants**: Store in `org_settings` or dedicated table
5. **Record Installation**: Upsert `library_installs` row
6. **Audit Log**: Log `library_install` action with metadata
7. **Return Success**: Include version info + backup flag

## Versioning

### Semantic Versioning
- **Major.Minor.Patch** (e.g., `1.2.3`)
- **Major**: Breaking changes (incompatible with previous)
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

### Upgrade Policy

When installing a new version over an existing one:
1. **Backup**: Save current templates to `backup_snapshot`
2. **Merge**: Update templates in place (by name match)
3. **Add New**: Any new templates from pack → insert
4. **Preserve Custom**: If user modified template, prefer user's version (flag conflict)

### Rollback

To rollback to previous version:
```sql
-- Restore from backup_snapshot
UPDATE templates SET content = backup.content
FROM library_installs backup
WHERE backup.org_id = 'org_uuid'
  AND backup.item_id = 'item_uuid';
```

## Licensing

### License Types

| License       | Commercial Use | Attribution | Redistribution |
|---------------|----------------|-------------|----------------|
| INTERNAL      | No             | N/A         | No             |
| ROYALTY_FREE  | Yes            | Optional    | No             |
| ATTRIBUTION   | Yes            | Required    | No             |
| OPEN_SOURCE   | Yes            | Required    | Yes (CC-BY-SA) |

### Enforcement

- License shown on Library item card
- Paid plans unlock ROYALTY_FREE items
- INTERNAL items only visible to FlashFusion staff

## UI Components

### Library Page (`/library`)

**Features**:
- Grid view of items with thumbnails
- Search bar (name, summary, tags)
- Filter tabs: All / Templates / Assistants
- License badge
- Install/Installed button
- Version tag

**Example Card**:
```
┌──────────────────────────────┐
│  [Thumbnail Image]           │
│                              │
├──────────────────────────────┤
│  Startup Landing Page   v1.0 │
│  Modern landing for tech...  │
│                              │
│  [landing] [startup] [saas]  │
│                              │
│  ROYALTY_FREE    by Team     │
│  [Install Button]            │
└──────────────────────────────┘
```

## Authoring Guide

### Creating a New Pack

1. **Define Structure**: Choose template or assistant
2. **Write Payload**: Follow JSON schema
3. **Add Thumbnail**: 800x600px, PNG/JPG
4. **Tag Appropriately**: 3-5 relevant tags
5. **Set License**: Choose appropriate license
6. **Test Locally**: Install in dev org, verify render
7. **Submit PR**: Add to `example_library/` folder

### Pack Checklist

- [ ] Unique slug (lowercase, hyphens)
- [ ] Semantic version
- [ ] Clear summary (<100 chars)
- [ ] Valid thumbnail URL
- [ ] 3-5 tags
- [ ] Payload validates against schema
- [ ] License specified
- [ ] Author credited
- [ ] Tested install/uninstall

## Testing

### Unit Tests

```typescript
describe('Library Install', () => {
  it('installs pack and records in library_installs', async () => {
    const result = await installPack('startup-landing', '1.0.0');
    expect(result.success).toBe(true);
    
    const installs = await getInstalls(org_id);
    expect(installs).toContainEqual(expect.objectContaining({
      slug: 'startup-landing',
      version: '1.0.0',
    }));
  });
  
  it('is idempotent when installing same version', async () => {
    await installPack('startup-landing', '1.0.0');
    const result2 = await installPack('startup-landing', '1.0.0');
    expect(result2.message).toContain('Already installed');
  });
  
  it('creates backup when upgrading', async () => {
    await installPack('startup-landing', '1.0.0');
    await installPack('startup-landing', '1.1.0');
    
    const install = await getInstall(org_id, 'startup-landing');
    expect(install.backup_snapshot).toBeDefined();
  });
});
```

### E2E Tests

**Golden Path**:
1. Browse library → Search "landing"
2. Click "Startup Landing Page"
3. Click "Install" → Success toast
4. Button changes to "Installed" with checkmark
5. Navigate to Content Studio
6. See "Startup Landing" in template dropdown
7. Select → Templates populate correctly

## Future Enhancements

- [ ] Community submissions (review queue)
- [ ] Pack ratings & reviews
- [ ] Usage analytics (most popular packs)
- [ ] Private org libraries (custom packs)
- [ ] Pack dependencies (pack A requires pack B)
- [ ] Auto-update subscriptions (notify on new versions)
- [ ] Pack marketplace (paid packs)
