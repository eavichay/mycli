# Feature Specification: Core Framework Bootstrap via Tasks Extension

**Feature Branch**: `001-core-tasks-bootstrap`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Stand up the mycli TUI core framework (renderer, slot registry, keyboard-capture chain, AppContext/StorageAPI) and validate it end-to-end by implementing the Tasks extension — the framework's first real feature and its own integration test."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch to an Empty Dashboard (Priority: P1)

A user runs the CLI for the first time. The terminal fills with the dashboard shell — an empty grid area, a sidebar area, and a status bar — with no extensions loaded yet.

**Why this priority**: Everything else in the app depends on the shell rendering correctly. If this doesn't work, nothing downstream can be validated.

**Independent Test**: Launch the app with zero extensions configured; confirm the shell renders its regions without errors and responds to a quit keypress.

**Acceptance Scenarios**:

1. **Given** a fresh install with no extensions enabled, **When** the user launches the app, **Then** the dashboard shell renders with visible (even if empty) grid, sidebar, and status bar regions.
2. **Given** the app is running, **When** the user presses the quit key, **Then** the app exits cleanly and returns control to the terminal.

---

### User Story 2 - Manage Tasks End-to-End (Priority: P1)

A user wants to track to-dos without leaving the terminal. They add a task, see it listed, mark it complete, and the change is still there the next time they open the app.

**Why this priority**: This is the feature's actual deliverable — a usable, persistent task manager — and simultaneously the mechanism that proves the extension system works.

**Independent Test**: With only the Tasks extension enabled, add a task via keyboard, confirm it appears in both the dashboard peek tile and the full focus view, mark it complete, restart the app, and confirm the state persisted.

**Acceptance Scenarios**:

1. **Given** the dashboard is showing the Tasks peek tile, **When** the user triggers "add task" and types a title, **Then** the new task appears in the peek tile's summary count.
2. **Given** at least one task exists, **When** the user opens the Tasks focus view, **Then** all tasks are listed with their completion state visible.
3. **Given** a task is open in the focus view, **When** the user marks it complete, **Then** its state updates immediately in both focus and peek views.
4. **Given** tasks were added in a previous session, **When** the user relaunches the app, **Then** the same tasks and completion states are restored.

---

### User Story 3 - Move Between Dashboard and Task Details by Keyboard (Priority: P2)

A user navigates from the dashboard into the Tasks focus view and back, entirely by keyboard, with a clear visual cue that they've entered a focused view.

**Why this priority**: Validates the peek-to-focus navigation contract and the visual "focused" treatment that every future extension will rely on.

**Independent Test**: From the dashboard, select the Tasks tile and confirm the view swaps to a framed/highlighted focus view; press the back key and confirm it returns to the dashboard.

**Acceptance Scenarios**:

1. **Given** the dashboard is active with the Tasks tile selectable, **When** the user presses the activation key on the Tasks tile, **Then** the Tasks focus view takes over the main area with a distinct popup/colored-frame visual treatment (no animation).
2. **Given** the Tasks focus view is active, **When** the user presses the back key, **Then** the view returns to the dashboard.

---

### User Story 4 - Predictable Keyboard Handling Across Contexts (Priority: P2)

A user presses a key while inside the Tasks focus view that has a meaning specific to Tasks (e.g., "add task"). The same key, pressed while on the dashboard with no extension focused, does nothing or triggers a different, global action instead.

**Why this priority**: Proves the focused → local → global keybind resolution order, a foundational contract every future extension depends on to avoid keybind collisions.

**Independent Test**: Assign a key that means "add task" only within the Tasks focus view and confirm it has no effect (or a different, global effect) when pressed on the dashboard.

**Acceptance Scenarios**:

1. **Given** the user is inside the Tasks focus view, **When** they press the "add task" key, **Then** the add-task action triggers.
2. **Given** the user is on the dashboard with no extension focused, **When** they press the same key, **Then** the Tasks add-task action does NOT trigger; the key either does nothing or triggers an unrelated global action.
3. **Given** a key is not handled by the currently focused element, **When** it is pressed, **Then** it is passed up to the local scope, and if still unhandled, up to the global scope.

### Edge Cases

- What happens when the user tries to add a task with an empty title? The action is rejected and no task is created.
- What happens when task storage is missing or corrupted on launch? The extension starts with an empty task list rather than crashing the app.
- What happens when two keybinds at different scopes (local vs. global) both claim the same key? The more specific (local/focused) scope wins; the global handler never receives the key.
- What happens when the Tasks extension fails to load (e.g., manifest error)? The dashboard still renders; the Tasks tile shows a load-error state instead of crashing the whole app.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST render a dashboard shell composed of distinct regions: a grid area for extension tiles, a sidebar area, a status bar, and an overlay layer for transient UI (e.g., popups), even when no extensions are loaded.
- **FR-002**: System MUST discover and load extensions from a manifest file describing the extension's identity, provided views, and declared commands, without executing extension code until the manifest is read.
- **FR-003**: System MUST allow an extension to register a compact "peek" view (shown on the dashboard) and an expanded "focus" view (shown when the extension is activated).
- **FR-004**: System MUST support at least one extension rendering into its peek slot without interfering with other slots' rendering.
- **FR-005**: System MUST provide each extension with a private, persistent storage area that survives app restarts and is not shared with other extensions.
- **FR-006**: System MUST resolve keypresses in a fixed order: the currently focused UI element first, then the active extension's local handlers, then global (app-wide) handlers — stopping at the first scope that handles the key.
- **FR-007**: Users MUST be able to add a new task with a title via keyboard input.
- **FR-008**: Users MUST be able to view the full list of tasks, including each task's completion state, in a dedicated detailed view.
- **FR-009**: Users MUST be able to mark a task complete or incomplete via keyboard.
- **FR-010**: System MUST persist task data so it is available again after the app is closed and reopened.
- **FR-011**: System MUST display a live summary (e.g., counts) of tasks in the compact dashboard tile without requiring the user to open the detailed view.
- **FR-012**: Users MUST be able to navigate from the dashboard into an extension's detailed view and back to the dashboard using only the keyboard.
- **FR-013**: System MUST visually distinguish the detailed/focused view from the dashboard using a framed or highlighted presentation, without relying on animation.
- **FR-014**: System MUST continue operating (rendering the dashboard and other extensions) if a single extension fails to load or throws an error, isolating the failure to that extension's tile.
- **FR-015**: System MUST reject task creation attempts with an empty or whitespace-only title.

### Key Entities

- **Task**: A single to-do item. Attributes: title, completion state, created timestamp. Owned exclusively by the Tasks extension's storage.
- **Extension Manifest**: Describes an extension's identity and capabilities (views offered, commands, storage needs) so the framework can load it without running its code first.
- **Dashboard Slot**: A named region of the screen (e.g., grid tile, sidebar, status bar) that a loaded extension's view can be registered into.
- **Keybind Scope**: One of three levels (focused element, local/active-extension, global) used to resolve which handler responds to a keypress.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from app launch to having added their first task in under 15 seconds, using only the keyboard.
- **SC-002**: 100% of tasks marked complete or added in a session are still present, with correct state, after fully closing and relaunching the app.
- **SC-003**: Navigating from the dashboard into a task's detailed view and back takes no more than two keypresses in each direction.
- **SC-004**: A keybind scoped to the Tasks focus view never triggers an unintended action when pressed from the dashboard or another extension's context — verified with zero cross-scope trigger incidents across acceptance testing.
- **SC-005**: If the Tasks extension fails to load, the rest of the dashboard (other tiles, status bar, quit) remains fully usable — verified by a forced-failure test.

## Assumptions

- This feature ships the Tasks extension as a built-in part of the application; installing it from an external marketplace is out of scope.
- Only a single user operates the app at a time on a single machine; multi-user or multi-device sync is out of scope.
- No other extensions (Notes, Agent sidebar, Google integration) are required to be functional for this feature to be considered complete — the dashboard must simply tolerate their absence.
- The "focus" visual treatment (framed/highlighted, no animation) established here is the pattern all future extensions will reuse.
- Task titles are plain text; rich formatting, attachments, and due dates are out of scope for this feature.
