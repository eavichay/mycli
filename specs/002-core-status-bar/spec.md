# Feature Specification: Contextual Status Bar with Reserved Keys

**Feature Branch**: `002-core-status-bar`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "bottom status-bar showing keyboard hints. Each focused app can dynamically (via the context object) show keyboard bindings + custom message(s). By default - the keyboard bindings from the manifest are being displayed. The root app also has it's own keyboard insertions (navigation, quit, etc) for global commands. If a key from focused app overrides the global key - it wins. We add a list of "reserved" keys that an app can never register. ctrl-q for quit as the first one."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Global Hints on the Dashboard (Priority: P1)

A user launches the app and, with no extension focused, looks at the bottom status bar to learn what keys are available (e.g. how to navigate into an extension, how to quit).

**Why this priority**: The status bar is worthless if it's empty on the very first screen a user sees — this is the baseline the rest of the feature builds on.

**Independent Test**: Launch the app with any extensions enabled but none focused; confirm the status bar displays the global commands (at minimum, quit) and no extension-specific content.

**Acceptance Scenarios**:

1. **Given** the dashboard is active with no extension focused, **When** the user looks at the status bar, **Then** it lists the global commands and their keys (including quit).
2. **Given** the user navigates into an extension's focus view and back to the dashboard, **When** they return, **Then** the status bar reverts to showing the global commands.

---

### User Story 2 - See an Extension's Manifest Keybindings by Default (Priority: P1)

A user opens an extension's focus view. Without that extension doing anything special, the status bar shows the keybindings the extension declared in its manifest, so the user immediately knows what they can press.

**Why this priority**: This is the default, zero-effort behavior every extension gets "for free" — it must work before any extension customizes its hints.

**Independent Test**: Focus an extension that declares commands in its manifest but does not customize its status-bar hints at runtime; confirm the status bar shows exactly those manifest-declared keybindings.

**Acceptance Scenarios**:

1. **Given** an extension's manifest declares one or more commands with keybindings, **When** the user focuses that extension and it has not customized its hints, **Then** the status bar displays those manifest keybindings.
2. **Given** the focused extension's manifest declares no commands, **When** the user views the status bar, **Then** it shows no extension-specific keybindings (only global ones, per User Story 1's behavior for whatever isn't overridden).

---

### User Story 3 - An Extension Customizes Its Own Hints (Priority: P2)

An extension developer wants the status bar to show something more useful than the raw manifest keybindings while a specific mode is active (e.g. "Enter: save, Esc: cancel" while editing a task) — so they update the hints dynamically through the context object.

**Why this priority**: This is the feature's actual value-add beyond a static manifest display — proves the dynamic context-driven hint mechanism works.

**Independent Test**: With an extension focused, trigger a mode change that updates its status-bar hints via the context object; confirm the status bar immediately reflects the new hints instead of the manifest defaults.

**Acceptance Scenarios**:

1. **Given** an extension is focused and showing its default manifest-derived hints, **When** the extension updates its hints via the context object, **Then** the status bar immediately shows the new hints instead of the manifest defaults.
2. **Given** an extension has supplied a custom message (not tied to a specific key) via the context object, **When** the user views the status bar, **Then** that message is visible alongside the extension's (and any unclaimed global) keybind hints, sharing the available width.
3. **Given** an extension had customized its hints, **When** the user leaves that extension's focus view, **Then** the customization does not persist — the status bar reverts to global commands (per User Story 1), and re-focusing the extension starts again from its manifest defaults unless the extension re-applies a customization.

---

### User Story 4 - Focused Hints Override Global Hints for the Same Key (Priority: P2)

A user is inside an extension's focus view. A key that has a global meaning on the dashboard (but is not reserved) is repurposed by the focused extension for something else. The status bar must show the extension's meaning for that key, not the global one, matching what actually happens when the key is pressed.

**Why this priority**: The status bar must never lie about what a keypress will do — if it did, it would be actively misleading rather than merely incomplete.

**Independent Test**: Configure a non-reserved key with both a global meaning and a focused-extension meaning; confirm the status bar shows only the extension's meaning while that extension is focused, and the global meaning again once it isn't.

**Acceptance Scenarios**:

1. **Given** a key has both a global command and a focused extension's command bound to it, **When** the user is inside that extension's focus view, **Then** the status bar shows only the focused extension's hint for that key.
2. **Given** the same situation, **When** the user leaves the focus view, **Then** the status bar shows the global command's hint for that key again.
3. **Given** a global command's key is not claimed by the focused extension (e.g. the back key), **When** the user is inside that extension's focus view, **Then** the status bar still shows that global command's hint alongside the extension's own hints.

---

### User Story 5 - Reserved Keys Can Never Be Claimed by an Extension (Priority: P1)

An extension's manifest (or its runtime customization) attempts to bind a reserved key, such as the quit key. The system must prevent this from ever taking effect, regardless of what the extension declares.

**Why this priority**: This is a safety guarantee every user and every future extension author depends on — without it, an extension could accidentally or deliberately make quitting (or other reserved actions) impossible.

**Independent Test**: Configure an extension's manifest to declare a command on a reserved key; confirm the extension still loads and functions normally, the reserved key's global action still fires when pressed, and the status bar never shows the extension's hint for that key.

**Acceptance Scenarios**:

1. **Given** an extension's manifest declares a command bound to a reserved key, **When** the extension loads, **Then** the extension loads successfully but that specific keybinding is not registered.
2. **Given** the same extension is focused, **When** the user presses the reserved key, **Then** the reserved key's global action fires (e.g. quitting), not the extension's declared command.
3. **Given** an extension attempts to customize its status-bar hints at runtime to display a reserved key as one of its own, **When** the status bar renders, **Then** the reserved key is not shown as belonging to that extension.

### Edge Cases

- What happens when an extension supplies hint text long enough that it doesn't fit the status bar? The text is truncated so the status bar never wraps to a second line or pushes other UI regions out of place.
- What happens when the combined message, extension hints, and global hints don't all fit? Reserved-key hints (e.g. quit) are always shown in full first; all other content (extension hints, custom message, other global hints) is truncated to fit what's left.
- What happens when two non-reserved keys — one global, one from the focused extension — collide? The focused extension's hint and behavior win (User Story 4); this is not a conflict requiring special handling, it's the documented precedence.
- What happens when an extension's manifest declares a reserved key alongside otherwise-valid commands? The reserved keybinding is dropped; every other declared command still loads and registers normally (User Story 5).
- What happens when the focused extension neither customizes its hints nor declares any manifest commands? The status bar shows no extension-specific content for that extension.

## Clarifications

### Session 2026-07-10

- Q: When an extension is focused, do unclaimed global command hints (e.g. "Esc: back") stay visible in the status bar alongside the extension's hints, or does focusing an extension replace the entire global hint set? → A: Merge — unclaimed global hints remain visible alongside the focused extension's hints; only the specific key(s) the extension overrides drop their global hint.
- Q: Can an extension show a custom message and custom keybind hints at the same time, or does supplying a message replace the hints entirely? → A: Both shown together — message and hints share the status-bar line, whichever fits after truncation.
- Q: When status-bar content doesn't all fit, should reserved-key hints (e.g. quit) always stay visible, or can they be truncated away like anything else? → A: Reserved-key hints are truncation-exempt — always shown in full; everything else truncates first.
- Q: After Ctrl+Q becomes the reserved quit key, what happens to the previous `q` binding? → A: `q` becomes free — no longer bound to anything globally; extensions may use it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display, in the status bar, the set of currently active global commands and their keys whenever no extension is focused.
- **FR-002**: System MUST, by default, display the focused extension's manifest-declared commands and keybindings in the status bar whenever an extension's focus view is active and that extension has not supplied custom hints.
- **FR-003**: System MUST provide the focused extension a way, via its context object, to dynamically supply custom keybind hint labels and/or free-text message(s) that replace the manifest-derived default display.
- **FR-004**: System MUST update the status bar immediately when the focused extension changes its hints or messages through the context object, with no user action required to refresh it.
- **FR-005**: System MUST clear any extension-supplied hint/message customization when that extension's focus view is exited, so the next time it (or any extension) is focused, the default manifest-derived display applies unless re-customized.
- **FR-006**: System MUST display, for any key bound both globally and by the focused extension (and not reserved), only the focused extension's hint — never both, and never the global one — while that extension is focused.
- **FR-006a**: System MUST continue displaying the hints for any global command whose key is *not* claimed by the focused extension, merged alongside that extension's hints, for as long as an extension is focused.
- **FR-007**: System MUST maintain a fixed list of reserved keys that no extension may register a command against, at any scope, via manifest or runtime customization.
- **FR-008**: System MUST include Ctrl+Q, bound to the quit action, as the first entry in the reserved keys list, replacing any prior global binding of the quit action to a different key.
- **FR-008a**: System MUST NOT reserve or globally bind the plain `q` key once Ctrl+Q becomes the quit key — `q` becomes available for extensions to bind their own commands to, like any other non-reserved key.
- **FR-009**: System MUST reject registration of any extension-declared command bound to a reserved key, while still loading and registering that extension's other valid commands normally.
- **FR-010**: System MUST ensure that pressing a reserved key always triggers that key's global/reserved action, regardless of which extension is focused or what that extension's manifest declares.
- **FR-011**: System MUST prevent an extension from displaying a reserved key as one of its own hints in the status bar, even if the extension attempts to via runtime customization.
- **FR-012**: System MUST truncate status-bar content that exceeds the available width rather than wrapping or resizing the status bar region, always fully preserving reserved-key hints and truncating all other content (extension hints, custom message, other global hints) first.
- **FR-013**: System MUST display an extension's custom message together with its (and any unclaimed global) keybind hints on the same status-bar line, sharing the available width, rather than one replacing the other.

### Key Entities

- **Status Bar Hint**: A single displayable entry pairing a key (or key combination) with a short label describing what pressing it does. Sourced either from an extension's manifest-declared commands (default) or from that extension's runtime context customization (override).
- **Status Bar Message**: Optional free-text content supplied by the focused extension via its context object, shown independently of any specific key.
- **Reserved Key**: An entry in a fixed, framework-owned list of keys that no extension may ever bind a command to, at manifest-load time or at runtime. Ctrl+Q (quit) is the first reserved key.
- **Global Command**: A command owned by the root application itself (e.g. quit, navigate into/out of a focus view), always available regardless of which extension is focused, displayed in the status bar whenever no focused-extension hint overrides its key.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can determine what any given keypress will do, correct 100% of the time, by reading the status bar — verified by comparing status-bar content against actual keypress behavior across all defined scenarios (global-only, manifest-default, custom-override, reserved-key).
- **SC-002**: 100% of attempts by an extension (via manifest or runtime customization) to bind or display a reserved key are blocked, verified by a forced-conflict test for each reserved key.
- **SC-003**: The status bar reflects a change in focused extension or in that extension's custom hints immediately — no stale hint remains visible once the situation it describes has changed.
- **SC-004**: Reserved-key enforcement never prevents an otherwise-valid extension from loading — verified by a test extension that declares one reserved-key command alongside other valid commands, confirming the extension loads and its other commands work.

## Assumptions

- This feature is additive to the existing dashboard shell's `statusbar` slot and the existing three-level (focused → local → global) keybind resolution chain established in `001-core-tasks-bootstrap`; neither the slot nor the resolution order changes — this feature governs what is *displayed* in that slot and adds a registration-time guard against reserved keys.
- The status bar remains a single-line region, consistent with the shell established in `001-core-tasks-bootstrap`; content that would overflow is truncated rather than causing the bar to grow.
- The reserved keys list starts with just Ctrl+Q (quit) for this feature; the list is designed to be extended later (e.g. for other framework-owned global actions) without requiring extensions to change how they check for or avoid reserved keys.
- Custom status-bar messages are plain, unformatted text — no rich text, icons, or color customization beyond what the framework's own rendering provides.
- When a reserved-key conflict is dropped from an extension's manifest at load time, this is treated as a silent, expected accommodation (not a load error/warning surfaced to the end user) — the extension author is expected to discover this during their own development/testing, not the end user at runtime.
- This feature changes the quit action's global keybinding from `q` (as established in `001-core-tasks-bootstrap`) to `Ctrl+Q`. This is an intentional, user-facing behavior change to align with the terminal-standard convention this feature's reserved-keys mechanism is modeled on; `q` is not preserved as a secondary quit alias.
- Manifest-derived default hints (FR-002) currently display using each command's `id` as its label (e.g. `a: tasks.add`), since the extension manifest format has no separate friendly-label field for commands. This is a known readability limitation, not a functional gap — an extension can always work around it by calling `setHints()` with a nicer label (FR-003).
