# FlashFusion Brand Guidelines

**Version**: 1.0.0  
**Last Updated**: 2025-10-01

---

## Brand Identity

### Mission
Empower creators and businesses to produce stunning, on-brand content at the speed of thought.

### Voice & Tone
- **Professional but approachable**: Expert without being condescending
- **Confident, not cocky**: Assertive about capabilities, humble about limitations
- **Playful, not childish**: Inject energy without sacrificing credibility
- **Helpful, not pushy**: Guide users, don't overwhelm them

### Values
1. **Speed**: Ship fast, iterate faster
2. **Quality**: Beautiful by default, customizable always
3. **Transparency**: Show your work (provenance tracking)
4. **Inclusivity**: Tools for pros and beginners alike

---

## Visual Identity

### Logo

**Primary Logo**: FlashFusion wordmark with lightning bolt accent  
**Formats**: SVG (preferred), PNG (fallback)  
**Clearspace**: Minimum 20px on all sides  
**Minimum Size**: 120px wide (web), 0.5" (print)

**Usage Rules**:
- Always use on dark backgrounds (#0F172A or darker)
- Never stretch, rotate, or apply effects
- Never place on busy images without a solid overlay

### Color Palette

#### Primary Colors

| Color | Hex | HSL | Usage |
|-------|-----|-----|-------|
| **FF Orange** | `#FF7B00` | `hsl(30, 100%, 50%)` | Primary CTA, brand accents, hero elements |
| **Cyan Blue** | `#00B4D8` | `hsl(193, 100%, 42%)` | Secondary actions, info states, links |
| **Accent Pink** | `#E91E63` | `hsl(340, 82%, 52%)` | Highlights, special features, badges |

#### Neutral Colors

| Color | Hex | HSL | Usage |
|-------|-----|-----|-------|
| **Deep Navy** | `#0F172A` | `hsl(222, 47%, 11%)` | Main background |
| **Dark Slate** | `#1E293B` | `hsl(217, 33%, 17%)` | Card backgrounds, surfaces |
| **Slate Gray** | `#334155` | `hsl(215, 25%, 27%)` | Borders, dividers |
| **Cool Gray** | `#94A3B8` | `hsl(214, 20%, 69%)` | Secondary text, placeholders |
| **Light Gray** | `#E5E7EB` | `hsl(220, 13%, 91%)` | Primary text, headings |

#### Semantic Colors

| Type | Color | Hex | Usage |
|------|-------|-----|-------|
| Success | Green | `#10B981` | Confirmations, success states |
| Warning | Amber | `#F59E0B` | Warnings, cautionary actions |
| Error | Red | `#EF4444` | Errors, destructive actions |
| Info | Blue | `#3B82F6` | Informational messages |

### Typography

#### Fonts

**Display Font**: [Sora](https://fonts.google.com/specimen/Sora) (Google Fonts)  
- Weights: 600 (SemiBold), 700 (Bold), 800 (ExtraBold)
- Usage: Headings, hero text, CTAs
- Fallback: `system-ui, sans-serif`

**Body Font**: [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts)  
- Weights: 400 (Regular), 500 (Medium), 600 (SemiBold)
- Usage: Body text, UI elements, forms
- Fallback: `system-ui, sans-serif`

**Code Font**: [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)  
- Weight: 400 (Regular)
- Usage: Code snippets, technical docs
- Fallback: `'Courier New', monospace`

#### Type Scale (Fluid Clamp)

```css
--text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);    /* 12-14px */
--text-sm: clamp(0.875rem, 0.8rem + 0.3vw, 1rem);        /* 14-16px */
--text-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);    /* 16-18px */
--text-lg: clamp(1.125rem, 1rem + 0.5vw, 1.375rem);      /* 18-22px */
--text-xl: clamp(1.375rem, 1.2rem + 0.75vw, 1.875rem);   /* 22-30px */
--text-2xl: clamp(1.875rem, 1.5rem + 1.5vw, 3rem);       /* 30-48px */
--text-3xl: clamp(2.5rem, 2rem + 2vw, 4rem);             /* 40-64px */
```

#### Line Height

- **Headings**: 1.2 (tight, for impact)
- **Body**: 1.6 (comfortable reading)
- **UI Elements**: 1.5 (compact but legible)

#### Letter Spacing

- **Display (hero)**: -0.02em (tight)
- **Headings**: -0.01em (slight tightening)
- **Body**: 0 (normal)
- **Uppercase**: 0.05em (tracking for all-caps)

---

## Spacing & Layout

### Grid System

- **Base Unit**: 8px (0.5rem)
- **Scale**: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128px
- **Max Width**: 1280px (container)
- **Columns**: 12-column grid (CSS Grid preferred)

### Spacing Tokens

```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

### Breakpoints

```css
/* Mobile-first approach */
sm: 640px   /* Tablet portrait */
md: 768px   /* Tablet landscape */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Ultra-wide */
```

---

## Components

### Buttons

**Primary Button** (FF Orange)
- Background: `hsl(var(--primary))`
- Hover: Lighten 10%, scale 1.02
- Active: Darken 10%, scale 0.98
- Text: White, SemiBold (600)
- Padding: 12px 24px (base)

**Secondary Button** (Outline)
- Border: `hsl(var(--secondary))`
- Text: `hsl(var(--secondary))`
- Hover: Fill with secondary color, white text

**Disabled State**
- Opacity: 0.5
- Cursor: not-allowed
- No hover effects

### Cards

- Background: `hsl(var(--card))` (Dark Slate)
- Border: 1px solid `hsl(var(--border))` (Slate Gray)
- Border Radius: 12px
- Padding: 24px (desktop), 16px (mobile)
- Shadow: `0 4px 6px rgba(0, 0, 0, 0.1)`

### Forms

**Input Fields**
- Background: `rgba(255, 255, 255, 0.05)`
- Border: 1px solid `hsl(var(--border))`
- Focus: Border color to `hsl(var(--primary))`, add glow
- Padding: 12px 16px
- Font: Inter 400

**Labels**
- Color: `hsl(var(--muted-foreground))`
- Font Size: 14px
- Margin Bottom: 8px

---

## Iconography

### Icon Library
**Primary**: [Lucide React](https://lucide.dev)  
- Style: Outline, 2px stroke
- Size: 20px (base), 16px (small), 24px (large)
- Color: Match text color (inherit)

### Custom Icons
- Must match Lucide style (outline, consistent stroke)
- SVG format, optimized (<5KB)
- Include title and desc tags for accessibility

---

## Motion & Animation

### Principles
1. **Purposeful**: Animations should have a functional purpose
2. **Subtle**: Don't distract from content
3. **Fast**: <300ms for most interactions
4. **Natural**: Use easing curves (cubic-bezier)

### Timing Functions

```css
--ease-out: cubic-bezier(0, 0, 0.2, 1);       /* Standard exit */
--ease-in: cubic-bezier(0.4, 0, 1, 1);        /* Standard entrance */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);  /* Standard movement */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Playful */
```

### Animation Library

**Fade In** (page transitions)
- Duration: 200ms
- Easing: ease-out
- Opacity: 0 → 1

**Slide Up** (modals, cards)
- Duration: 300ms
- Easing: ease-out
- Transform: translateY(20px) → translateY(0)

**Scale** (button clicks)
- Duration: 150ms
- Easing: ease-in-out
- Transform: scale(0.98) → scale(1)

**Shimmer** (loading states)
- Duration: 1500ms
- Easing: linear
- Background gradient: -100% → 100%

---

## Accessibility

### WCAG 2.2 AA Compliance

**Color Contrast**
- Text on Dark Navy: Minimum 4.5:1 contrast ratio
- Large Text (18px+): Minimum 3:1 contrast ratio
- FF Orange on Dark Navy: 7.2:1 ✅
- Cyan Blue on Dark Navy: 6.8:1 ✅

**Focus States**
- All interactive elements must have visible focus
- Focus ring: 2px solid `hsl(var(--primary))`, 2px offset
- Never use `outline: none` without a replacement

**Keyboard Navigation**
- All actions accessible via keyboard (Tab, Enter, Escape)
- Skip links for navigation
- Modal traps focus until closed

**Screen Readers**
- All images have `alt` text
- Icon-only buttons have `aria-label`
- Form fields have associated `<label>` elements
- Status messages use `aria-live` regions

---

## Content Guidelines

### Writing for UI

**Buttons**
- Use verbs: "Generate Image", "Save Campaign", "Schedule Post"
- Keep to 1-3 words when possible
- Avoid generic labels like "Submit" or "Click Here"

**Error Messages**
- Be specific: "Email already registered" > "Error"
- Offer solutions: "Email already registered. Try signing in instead."
- Avoid blame: "Invalid password" > "You entered the wrong password"

**Empty States**
- Explain why it's empty: "You haven't created any campaigns yet."
- Provide next steps: "Click 'New Campaign' to get started."
- Optional: Add illustration for visual interest

### Tone Examples

❌ **Bad**: "An error occurred. Please try again later."  
✅ **Good**: "Couldn't generate your image. Our AI is taking a quick break. Try again in a few seconds."

❌ **Bad**: "Warning: This action cannot be undone."  
✅ **Good**: "This will permanently delete your campaign. There's no undo button for this one."

---

## Brand Assets

### Download Resources

- **Logo Pack**: [Figma Link] (Coming Soon)
- **Design Tokens**: [GitHub Repo](./tailwind.config.ts)
- **Component Library**: [Storybook] (Coming Soon)
- **Brand Deck**: [PDF] (Coming Soon)

### Usage Restrictions

- ✅ OK: Use in presentations, case studies, partner materials
- ✅ OK: Modify colors for accessibility (with approval)
- ❌ Not OK: Alter logo, create unofficial branded materials
- ❌ Not OK: Use brand assets to imply endorsement

---

## Questions?

Contact the Brand Team:  
📧 brand@flashfusion.co  
💬 Slack: #brand-guidelines

---

**Last Updated**: 2025-10-01  
**Maintained By**: Design Team
