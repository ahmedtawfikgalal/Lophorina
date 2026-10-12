# Design System (lightweight)

Not an enterprise design system. One goal: users always understand camera status, control status, what will happen, and how to stop.

Priorities: **P0** interaction safety → **P1** visual consistency → **P2** reusability.

Stack: React + TypeScript + CSS custom properties + a small in-repo component library. No Tailwind or component framework unless a concrete need appears. Lives in `src/design-system/` until another product needs it.

## Tokens

CSS custom properties are the source of truth. Contrast values are against white (`#FFFFFF`); WCAG AA requires 4.5:1 for normal text, 3:1 for large text and UI graphics.

| Token                    | Value                                                     | Contrast vs white | Usage                                                                |
| ------------------------ | --------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| `--color-primary`        | `#4F46E5`                                                 | ≈ 6.3:1 ✅        | Primary buttons, focus ring, links                                   |
| `--color-primary-hover`  | `#4338CA`                                                 | higher ✅         | Hover/active                                                         |
| `--color-primary-subtle` | `#6366F1`                                                 | ≈ 4.5:1 ⚠️        | Decorative accents, icons, large text only — **not** white body text |
| `--color-success`        | `#059669`                                                 | ≈ 3.8:1           | Icons, badges with dark text, borders — not small white text         |
| `--color-success-text`   | `#047857`                                                 | ≥ 4.5:1 ✅        | Success text on white                                                |
| `--color-warning`        | `#D97706`                                                 | low               | Icons only; pair with `--color-text`                                 |
| `--color-warning-text`   | `#B45309`                                                 | ≥ 4.5:1 ✅        | Warning text on white                                                |
| `--color-danger`         | `#DC2626`                                                 | ≈ 4.8:1 ✅        | **Stop Control** background, errors                                  |
| `--color-text`           | `#111827`                                                 | ✅                | Body text                                                            |
| `--color-text-muted`     | `#4B5563`                                                 | ✅                | Secondary text                                                       |
| `--color-surface`        | `#FFFFFF`                                                 | —                 | Panels, cards                                                        |
| `--color-surface-muted`  | `#F9FAFB`                                                 | —                 | Page background                                                      |
| `--color-border`         | `#E5E7EB`                                                 | —                 | Dividers (decorative only)                                           |
| `--radius-sm/md/lg/xl`   | 4 / 8 / 12 / 16 px                                        |                   |                                                                      |
| `--space-1/2/3/4/6/8/12` | 4 / 8 / 12 / 16 / 24 / 32 / 48 px                         |                   |                                                                      |
| `--font-family`          | Inter (bundled, not Google Fonts CDN), system-ui fallback |                   |                                                                      |

Contrast values are approximate; verify every pair with a checker during implementation.

> Resolved conflicts from context-00: the mockup used `#6366F1` as primary and a lighter red for Stop; both fail AA for white normal-weight text. `#4F46E5` and `#DC2626` are the decisions.

## Typography

| Style   | Size / line height | Weight |
| ------- | ------------------ | ------ |
| Display | 32 / 40            | 700    |
| H1      | 24 / 32            | 700    |
| H2      | 20 / 28            | 600    |
| H3      | 16 / 24            | 600    |
| Body    | 14 / 20            | 400    |
| Caption | 12 / 16            | 400    |

## MVP components

| Component                | Variants / props                                     | Notes                                                      |
| ------------------------ | ---------------------------------------------------- | ---------------------------------------------------------- |
| `Button`                 | primary, secondary, ghost, danger; disabled; loading | Danger = Stop Control                                      |
| `StatusBadge`            | active, inactive, error, calibrating                 | Text + icon always                                         |
| `CameraPreview`          | stream, tracking state, permission error             | Receives state via props                                   |
| `GestureCard`            | icon, label, action, enabled, hold progress          |                                                            |
| `SettingsRow`            | label, description, control slot                     |                                                            |
| `Toast`                  | success, warning, error                              | Rendered inside an `aria-live` region                      |
| `ConfirmDialog`          | —                                                    | Only for genuinely destructive actions; **never** for Stop |
| `CameraStatus` (pattern) | composes badge + preview + stop                      |                                                            |
| `ControlPanel` (pattern) | page layout                                          |                                                            |

Visual components never touch camera or Chrome APIs; they receive state through props.

## Structure

```
src/design-system/
├── tokens/{colors,spacing,typography}.css
├── components/{Button,StatusBadge,CameraPreview,GestureCard,SettingsRow,Toast,ConfirmDialog}.tsx
└── patterns/{CameraStatus,ControlPanel}.tsx
```

## Deferred (NICE TO HAVE)

Dark mode, theming, animation library, icon abstraction layer, drag-and-drop gesture editor, component documentation site, charts.

## Definition of done

- [ ] All components use tokens; no hard-coded colors or spacing.
- [ ] Active and inactive states distinct without color.
- [ ] Hover, focus, disabled, error behaviors defined where applicable.
- [ ] Keyboard navigation and visible focus work.
- [ ] Text and controls meet WCAG AA contrast.
- [ ] Camera status and Stop Control easy to locate at Side Panel widths.
- [ ] No unnecessary dependency added.
