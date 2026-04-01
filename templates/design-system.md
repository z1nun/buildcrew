# Design System

## Colors

### Brand
| Token | Value | Usage |
|-------|-------|-------|
| `primary` | [#hex] | CTAs, links, active states |
| `secondary` | [#hex] | Secondary buttons, borders |
| `accent` | [#hex] | Highlights, badges |

### Semantic
| Token | Value | Usage |
|-------|-------|-------|
| `success` | [#hex] | Success messages, confirmations |
| `error` | [#hex] | Error messages, destructive actions |
| `warning` | [#hex] | Warnings, caution states |
| `info` | [#hex] | Informational messages |

### Neutral
| Token | Value | Usage |
|-------|-------|-------|
| `bg` | [#hex] | Page background |
| `surface` | [#hex] | Card/modal backgrounds |
| `border` | [#hex] | Borders, dividers |
| `text` | [#hex] | Primary text |
| `text-muted` | [#hex] | Secondary text, labels |

## Typography

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| H1 | [rem] | [weight] | [lh] | Page titles |
| H2 | [rem] | [weight] | [lh] | Section titles |
| H3 | [rem] | [weight] | [lh] | Card titles |
| Body | [rem] | [weight] | [lh] | Default text |
| Small | [rem] | [weight] | [lh] | Captions, labels |

## Spacing
- **Base unit**: [4px / 8px]
- **Scale**: 4, 8, 12, 16, 24, 32, 48, 64

## Border Radius
- **Small**: [4px] — inputs, small cards
- **Medium**: [8px] — cards, modals
- **Large**: [16px] — large containers
- **Full**: [9999px] — pills, avatars

## Shadows
- **Small**: [shadow] — hover states
- **Medium**: [shadow] — cards, dropdowns
- **Large**: [shadow] — modals, popovers

## Components
| Component | Variants | Location |
|-----------|----------|----------|
| Button | primary, secondary, ghost, destructive | `src/components/Button` |
| [Component] | [variants] | [path] |

## Animation
- **Duration**: fast (150ms), normal (300ms), slow (500ms)
- **Easing**: ease-out for enter, ease-in for exit
- **Library**: [Framer Motion / CSS transitions / etc.]

---
*Agents use this to create visually consistent components, pick correct tokens, and follow established patterns.*
