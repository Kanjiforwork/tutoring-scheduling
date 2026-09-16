---
version: "alpha"
name: "Bright Path — Calm Learning Centre"
description: "Visual and interaction specification for a tutoring centre's daily reception scheduling board."
style:
  keywords: [warm, clear, structured, approachable, paper-inspired]
  density: "Compact operational UI with comfortable controls"
  motion: "Minimal functional feedback"
  colorMode: "Light only for v1"
colors:
  canvas: "#F7F8F5"
  surface: "#FFFFFF"
  surfaceMuted: "#EEF2ED"
  textPrimary: "#24352D"
  textSecondary: "#526259"
  border: "#D6DED6"
  controlBorder: "#7C8C81"
  primary: "#286448"
  primaryHover: "#205139"
  primaryText: "#FFFFFF"
  focus: "#2563EB"
  success: "#236343"
  successSurface: "#EDF6EF"
  warning: "#805200"
  warningSurface: "#FFF5DB"
  danger: "#A62F36"
  dangerSurface: "#FFF0F0"
  information: "#285C8C"
  informationSurface: "#EDF4FC"
  decorationSage: "#DCE9DA"
  decorationSand: "#F2E5C8"
typography:
  family: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  pageTitle: { size: "24px", weight: 650, lineHeight: 1.3 }
  sectionTitle: { size: "18px", weight: 600, lineHeight: 1.4 }
  body: { size: "14px", weight: 400, lineHeight: 1.5 }
  label: { size: "14px", weight: 500, lineHeight: 1.4 }
  caption: { size: "12px", weight: 500, lineHeight: 1.5 }
spacing:
  unit: "4px"
  scale: [4, 8, 12, 16, 24, 32, 48]
radius:
  control: "8px"
  panel: "12px"
  badge: "6px"
components:
  buttonPrimary:
    background: "{colors.primary}"
    color: "{colors.primaryText}"
    hoverBackground: "{colors.primaryHover}"
    minHeight: "40px"
    paddingInline: "16px"
    radius: "{radius.control}"
---

# Bright Path UI Design

## Overview

Design an internal scheduling workspace for a tutoring centre in Da Nang. The primary user is the receptionist, who needs to see a day, identify problems, and confidently change a booking. The owner should understand the schedule at a glance. This is an everyday work tool for adults supporting students and families.

Use the supplied Origami Geométrico reference for its explicit tokens, component rules, and restrained paper-inspired depth. Adapt its visual language to a learning centre: warm white surfaces, forest-green actions, subtle sage accents, and clear information hierarchy. Avoid a marketing hero, decorative feature sections, or an elaborate origami theme.

- **Style:** Calm, warm, precise, approachable.
- **Density:** Compact enough to compare daily sessions on a laptop, with room for readable student names and controls.
- **Motion:** Short feedback for state changes; the schedule appears immediately.
- **Language:** English UI, with real student names preserved as supplied.
- **Primary outcome:** Reception can identify who is learning, when, with whom, and where, then understand any issue before saving.

This file defines appearance and interaction. Existing business rules, source analysis, data model, and API decisions are preserved in [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md). Execution and acceptance checks remain in [MASTER_PLAN.md](MASTER_PLAN.md). Monday saves use a separate "Schedule on a closed day?" dialog with date/time/room and Back to editing / Confirm and save actions. This explicitly approved exception does not waive other scheduling rules or imply implementation is complete.

## Colors

Use the front matter as the canonical token list. Every component below refers to the same semantic roles.

| Role | Token | Application |
| --- | --- | --- |
| Page background | canvas | Warm, quiet backdrop around the schedule |
| Main surface | surface | Table, forms, dialogs, expanded details |
| Muted surface | surfaceMuted | Table header, secondary grouping, readonly values |
| Primary text | textPrimary | Student names, dates, times, headings |
| Secondary text | textSecondary | Supporting labels, room metadata, explanatory copy |
| Subtle separator | border | Table rows and panel boundaries |
| Control boundary | controlBorder | Input outlines that remain identifiable on white |
| Main action | primary / primaryText | Add session and Save changes |
| Warning | warning / warningSurface | Historical policy warnings and After cutoff badges |
| Conflict/destructive | danger / dangerSurface | Blocking conflicts, input errors, cancellation confirmation |
| Information | information / informationSurface | Pair marker and explanatory notices |
| Success | success / successSurface | Confirmed saved-state feedback and Booked badges |

Reserve sage and sand for small decorative details, never body text or status distinctions. No tutor-specific rainbow palette. Convey status with text and, where helpful, an icon; color alone is insufficient. Check implemented text contrast against WCAG AA targets (4.5:1 for normal text) and identifiable control/focus contrast (3:1); these are requirements, not a claim that a rendered UI has been audited.

## Typography

Use Inter when available with the defined system fallback; the interface must remain usable if a font cannot load. Prefer one font family throughout. Do not turn the product title into a large landing-page heading.

| Element | Size / line height | Weight |
| --- | --- | --- |
| Selected date / page title | 24px / 1.3 | 650 |
| Dialog heading | 20px / 1.4 | 600 |
| Section heading | 18px / 1.4 | 600 |
| Form values | 16px / 1.5 | 400 |
| Table text and body | 14px / 1.5 | 400 |
| Student name, button, label | 14px / 1.4 | 500-600 |
| Metadata and badge | 12px / 1.5 | 500 |

Use tabular numerals for time ranges and counts. Student names remain more prominent than IDs. Source lesson IDs belong in details rather than competing with names in the main row. Preserve full names through wrapping; do not rely on hover to reveal essential information.

## Layout

### Desktop and laptop

Use a single main workspace with a maximum width of 1440px, centered, and 24px side padding. At 1024-1279px, reduce padding to 16px. Use a minimum dynamic viewport height without locking content to a fixed viewport or clipping long days.

The vertical hierarchy is:

1. **Product header:** Small Bright Path wordmark and a restrained folded-paper mark. A visible secondary demo-clock label stays separate from the selected date.
2. **Day heading:** Selected date and weekday on the left; Previous, Today, and Next grouped nearby. Add session is the primary action on the right.
3. **Filter toolbar:** Tutor and student selectors, Clear filters when relevant, and a concise visible-session count.
4. **Daily schedule:** Main table directly below. Do not insert large summary cards above it.
5. **Changes for this day:** A compact disclosure below the schedule containing changes relevant to this date, including sessions moved away.

Use 24px between major areas and 12-16px within a toolbar. The schedule is the dominant surface. No permanent sidebar is needed for one screen. Aim to expose the supplied default day's rows at a common laptop viewport while allowing natural scrolling and text zoom; never hide records to force a one-screen composition.

### Table structure

Columns: **Time · Students · Tutor · Room · Status · Warnings · Actions**.

Allow the Students column to take remaining space. Give Time approximately 120px, Room 64px, and enough action width for a readable Edit control. These are layout starting points; names and accessible controls take precedence over rigid widths.

Use a muted table header, 1px row separators, 12-16px horizontal cell padding, and approximately 64px minimum single-session row height. Pair rows grow naturally. A subtle row hover helps scanning without suggesting that the entire row is clickable. Keep explicit buttons for actions.

### Tablet and phone

Below 1024px, let toolbars wrap into intentional groups. Below 768px, use 16px page padding, put date navigation on its own row, and present sessions as stacked list items with the same information and ordering.

Each mobile item shows time and status first, students next, then labeled tutor/room, warning text, and explicit actions. Keep both members of a pair together. Do not let the whole page overflow horizontally. Forms become full-width dialogs with an independently scrollable body and reachable footer. Touch targets should be at least 44px in each dimension.

### Layering

Base content: 0. Sticky table header, if used: 10. Dialog backdrop: 100. Dialog: 110. Toast: 200. Ensure popup controls within a dialog remain above its surface and are not clipped.

## Elevation and Depth

Use a 1px border for the main schedule surface. Reserve a soft shadow for dialogs and floating menus; avoid a shadow on every row or field.

- Panel shadow, only when needed: `0 2px 8px rgba(36, 53, 45, 0.04)`.
- Dialog shadow: `0 16px 48px rgba(36, 53, 45, 0.16)`.
- Backdrop: a subdued charcoal overlay that keeps the underlying context recognizable.

Paper-inspired geometry can appear in the small brand mark or a quiet empty-state illustration. Do not place tessellations, polygon masks, folded corners, or decorative diagonals behind table text, warnings, or inputs.

## Shapes

Controls use an 8px corner radius; panels and dialogs use 12px; status badges use 6px. Use a consistent 1px border. Avoid excessive pills, oversized rounding, and ornamental shapes around operational information. Origami influence belongs to small brand accents; form controls should retain familiar shapes.

## Components

### Buttons

- **Primary:** Green fill, white text, 40px minimum desktop height. Hover uses primaryHover. Labels: Add session, Create session, Save changes.
- **Secondary:** White fill, controlBorder outline, primary text. Use for Today, Cancel in a form, and secondary navigation.
- **Ghost:** Transparent with visible text; subtle muted fill on hover. Use for Edit and disclosure controls.
- **Destructive:** Danger fill and white text in the final cancellation confirmation. In the schedule, use a quiet labeled Cancel booking control to avoid a wall of red buttons.
- **Pending:** Keep button dimensions stable, show Saving… or Cancelling…, and prevent duplicate submission. Do not remove the action while it is processing.
- **Focus:** Visible 2px focus ring with 2px offset. Disabled states must remain legible and communicate why an action is unavailable where relevant.

Use a single consistent line-icon family, such as Lucide, at 16-20px. Icon-only previous/next buttons need accessible names. Do not use emojis in UI.

### Session rows and pairs

A session is one visible row or mobile item. Show a time range and smaller duration label. For pair sessions, display a small Pair marker and two vertically aligned student entries, each with its own booking status and Cancel booking action. The shared Edit action applies to the whole session.

For one-to-one sessions, use the Status column for the booking status. For pairs, show each student's status alongside their name; the Status column may summarize “2 booked” or “1 booked · 1 cancelled.” Do not invent a persisted session status or show Booked in a way that hides a student's cancellation.

Cancelled entries remain readable with a neutral Cancelled badge; do not fade the entire row below readable contrast. No-show uses a clearly labeled badge. It must not visually imply that the room has become available.

### Warnings and conflicts

Use a short label such as Student overlap, Tutor overlap, or Closed day with a disclosure control. Expanded details identify the affected student/resource, time, and related source lesson or session IDs. For example: “Le Minh Chau is also booked from 09:00–10:00 with Pham Duc in R2.”

Distinguish three concepts through copy:

- **Existing issue:** A warning on imported history that remains visible.
- **Cannot save:** A blocking validation result on the proposed write.
- **After cutoff:** A change-history label, not proof of a collision or notification.

A pair marker is informational, not a warning. Do not offer an Override button unless business authorization and a corresponding workflow are separately approved. A filter can hide another row but must not hide the explanation of its conflict.

### Form

Use a dialog approximately 560-640px wide on desktop. Labels stay above controls. Date/time and tutor/room may share two-column rows where space allows; collapse to one column on phones. Never use placeholder text as the only label.

Creation fields: date, start time, duration, tutor, room, one-to-one/pair choice, and student selection. Pair requires two clearly labeled student selections. Duration uses explicit 60 min / 90 min choices. Editing allows selecting a replacement student: show a short before/after hint, then cancel the original booking and create the new one atomically on save. A new second booking can also be selected when converting to a pair. Status corrections are audited and checked on the server. Scheduling fields are disabled while the stored session has a no-show or all bookings are cancelled. Ask for the change reason in a secondary dialog after Save changes.

Put field errors directly below the field. Put cross-field conflicts in a compact error summary with related session details. Keep all entered values after rejection. Keep an obvious Close/Cancel route and warn before discarding a changed draft. Do not dismiss a dirty form through an accidental backdrop click.

### Cancellation confirmation

Title: “Cancel booking?” Show the student, day, time, tutor, and room. Require a reason. For a pair with another active student, explain: “The other student's booking stays active. The tutor and room remain reserved.” Do not display a fee calculation in v1.

Actions: Keep booking and Cancel booking. Name the student rather than using an ambiguous “Cancel session” action for a single pair member.

### Change history

Show action, timestamp, reason, and clearly labeled Before / After values. Only changed values need visual emphasis, while the session/student context remains visible. Stack before/after on small screens. Use an After cutoff badge with explanatory text that this records a schedule change and does not confirm the tutor was notified.

Keep moves discoverable from both relevant days as specified in the technical design. Do not manufacture a timeline for imported records without source history.

## UI States and Feedback

| State | Presentation and action |
| --- | --- |
| Initial loading | Static skeleton rows matching the final layout; avoid distracting shimmer |
| Empty day | “No sessions scheduled for this day.” with Add session |
| No filter matches | “No sessions match these filters.” with Clear filters |
| Fetch failure | Inline connection message and Retry; retain the selected date and filters |
| Validation failure | Field messages and/or conflict summary; retain draft and focus the first actionable error |
| Stale version | Explain that the session changed; offer to load its latest state without silently overwriting the draft |
| Save confirmed | Brief success message, then authoritative refreshed row |
| Save confirmed, refresh failed | “Saved, but the schedule could not refresh.” with Reload schedule; do not invite resubmission |
| Save outcome unknown | Explain that confirmation was lost; offer a schedule refresh before retrying |

Announce relevant results with an accessible live region. Toasts may supplement inline feedback but must not be the only place to read an error or act on it.

## Motion

Use 120-180ms ease-out transitions for color, opacity, and small dialog entry changes. If used, dialog entry translates no more than 4px. No staggered session entrances, animated row reordering, hover lifts, bouncing badges, or decorative page transitions. Respect reduced-motion preferences. Keep keyboard focus stable after data refresh.

## Accessibility

Use semantic headings and a real table on desktop. Give form fields programmatic labels; connect error messages to their inputs. Dialogs must trap focus, support deliberate keyboard dismissal with dirty-draft protection, and return focus to their trigger. Avoid hover-only details. Preserve reading order across desktop and mobile. Verify long names, pair rows, 200% text zoom, focus visibility, and contrast during implementation QA.

## Do's and Don'ts

- Do use real source names and realistic times in examples.
- Do prioritize the selected date, students, schedule, and actionable warnings.
- Do keep errors, historical warnings, and change badges semantically distinct.
- Do preserve the receptionist's draft and context during failures.
- Do use restrained paper geometry for brand identity only.
- Do keep the demo clock visible, distinct from the selected day.
- Do not introduce marketing sections, large hero illustrations, student gamification, or unrelated metric cards.
- Do not use decorative stock images, random image URLs, or a background pattern in the schedule.
- Do not silently change business rules through visual affordances.
- Do not indicate that a tutor was notified merely because a change was recorded.
- Do not promise a pixel-perfect one-screen day by clipping content or shrinking essential text.
- Do not use placeholder lorem ipsum, emojis, or promotional copy in the operational interface.

## Scope and Review

This specification is for the daily scheduling board, its forms, warnings, and history only. It is ready to guide a future UI implementation; it is not a rendered mockup or a claim of browser/accessibility verification. Preserve unresolved policy questions in the technical design and assessment decisions rather than solving them with a decorative UI control.


History navigation: audit entries now live on `/history`, reached through the shared Schedule / History navigation. The selected lesson date carries across both pages. History includes date navigation, refresh/retry, empty state, cutoff badges, and expandable before/after snapshots. Moving a session still appears for both its old and new lesson dates. The schedule page no longer embeds the history accordion. This is a separate view of the existing audit feature, not a new write workflow.
