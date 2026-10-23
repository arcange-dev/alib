# Admin Dashboard Page Overrides

> **PROJECT:** ALIB
> **Generated:** 2026-10-23 10:35:05
> **Page Type:** Dashboard / Data View

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1400px or full-width
- **Grid:** 12-column grid for data flexibility
- **Sections:** Hero (product + live preview or status) > Key metrics/indicators > How it works > CTA (Start trial / Contact)

### Spacing Overrides

- **Content Density:** High — optimize for information display

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Dark or neutral. Status colors (green/amber/red). Data-dense but scannable.

### Component Overrides

- Avoid: Use arbitrary large z-index values
- Avoid: No feedback after submit
- Avoid: Single row actions only

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Hover tooltips, chart zoom on click, row highlighting on hover, smooth filter animations, data loading spinners
- Layout: Define z-index scale system (10 20 30 50)
- Forms: Show loading then success/error state
- Data Entry: Allow multi-select and bulk edit
- CTA Placement: Primary CTA in nav + After metrics
