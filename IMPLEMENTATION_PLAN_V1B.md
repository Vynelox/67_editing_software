# IMPLEMENTATION_PLAN_V1B

TL;DR - Rename project strings from "cutforge" to "Juice Cut"; implement a robust undo/redo command stack with keyboard shortcuts; add audio waveforms and video thumbnail rolls in the timeline; fix play needle position and Torus menu layering; make Media Pool and Timeline panels resizable with draggable dividers; add horizontal scrolling and Alt+scroll horizontal zoom on the timeline. Use an action/command history stored in app state (undo/redo stack), compute or cache audio peaks for waveforms, generate thumbnails client-side (with optional preprocessing), and make UI changes in the existing components.

## Steps

1. Project rename (non-destructive string changes)
   - Search-and-replace literal occurrences of "cutforge" → "juice cut" in strings, package metadata, and UI labels. *depends on step 2 (component changes validated)*

2. Design undo/redo architecture (high priority)
   - Choose pattern: command/action objects with inverse or full-state snapshots for complex ops. Use a single source-of-truth state slice `history` in the app-level store or React Context+Reducer.
   - Define `Action` shape and `History` API: `execute(action)`, `undo()`, `redo()`, `canUndo`, `canRedo`.
   - Implement keyboard handling mapping: `Ctrl+Z` → undo; `Ctrl+Shift+Z` or `Ctrl+Y` or `Ctrl+Alt+Z` → redo. Add focus handling so inputs don't intercept.

3. Timeline: audio waveform
   - Decide peak generation strategy: compute peaks on load using `OfflineAudioContext` (client) or accept precomputed peak arrays in media metadata.
   - Create a `Waveform` subcomponent used by `Timeline` clip items. Render with `Canvas` for performance, support devicePixelRatio.
   - Optimize: cache peaks per-file in-memory and optionally in IndexedDB for large projects.

4. Timeline: video thumbnail roll
   - Implement `ThumbnailRoll` subcomponent for video clips. For each clip, sample N frames across duration using an offscreen `HTMLVideoElement` + `Canvas` at async startup or on-demand.
   - Render thumbnails horizontally inside clip area; consider a single strip image or sequence of canvases for performance.
   - Fallback: if browser decoding is expensive, show `poster` or first-frame placeholder.

5. Playneedle & TorusMenu layout fixes
   - Adjust playneedle CSS position (reduce `top` or reposition inside timeline container) in `Timeline` so it sits lower.
   - Raise `TorusMenu` above video player by increasing `z-index` and ensuring position is `fixed` or `absolute` within a high-level container; make sure pointer-events still work. Update `TorusMenu.tsx` and viewer stacking context.

6. Draggable dividers for panels
   - Implement `Splitter` component(s) between `MediaPool` and main workspace and between timeline and viewer so panels can be resized horizontally/vertically.
   - Persist sizes in local state and optionally in localStorage for session persistence.
   - Support mouse and touch dragging with collapse/expand double-click.

7. Timeline scrolling and zoom
   - Implement horizontal pan on wheel events when timeline is focused/hovered: normal scroll (wheel) translates timeline left/right.
   - `Alt + wheel` to zoom horizontally (scale time axis); maintain cursor-centered zoom (zoom toward mouse x-position).
   - Clamp zoom levels and add subtle animated transitions.

8. Integration: connect undo/redo to UI
   - Wrap all user-initiated edits (move clips, trim, delete, split, add media, resize panels) into `Action` objects captured by the history manager.
   - Ensure waveform generation and thumbnail generation do not create undo history entries unless they are user actions.

9. Testing & QA
   - Unit tests for history behavior: multi-step undo/redo, branching, boundary conditions.
   - Manual test checklist for timeline gestures, keyboard shortcuts, resizing, z-index issues, waveform rendering, thumbnail generation.

10. Documentation & final touches
   - Add `IMPLEMENTATION_PLAN_V1B.md` to repo root (or include as developer note) describing how to run/verify.
   - Wire up keyboard shortcuts in `main.tsx` or a top-level input manager and document shortcuts in README.

## Relevant files
- `src/components/Timeline.tsx` — add waveform rendering, thumbnail roll, playneedle position, wheel/zoom handlers, history integration
- `src/components/MediaPool.tsx` — support resizable splitter and media list interactions
- `src/components/Viewer.tsx` — ensure video z-index and interaction with TorusMenu
- `src/components/TorusMenu.tsx` — raise z-index and ensure stacking context
- `src/components/RollDialog.tsx` — thumbnail generation helper UI if used
- `src/main.tsx` — top-level keyboard handler for undo/redo and global event listeners
- `src/App.tsx` — add `Splitter` layout hooks and history provider wiring
- `src/components/MediaPool.tsx` — add draggable divider behaviors

## Verification
1. Automated
   - Unit tests for `history` reducer/manager covering execute/undo/redo, nested actions, and action limits.
   - Small snapshot tests for `Waveform` canvas when given synthetic peaks.
2. Manual QA
   - Rename verification: search UI for "Juice Cut" and verify no remaining "cutforge" labels.
   - Undo/Redo: perform sequence: add clip → move → trim → delete; press `Ctrl+Z` repeatedly to step back; then `Ctrl+Shift+Z` (and `Ctrl+Y`) to redo. Ensure clipboard and focused input cases don't break shortcuts.
   - Waveform: load an audio clip and visually confirm waveform matches audible peaks and is clipped/zoomed when timeline zooms.
   - Thumbnails: verify thumbnails show frames across clip, are not blocking playback, and load progressively.
   - Playneedle/TorusMenu: ensure playneedle vertical position sits lower; Torus menu top isn’t cut off and sits above player.
   - Resizers: drag dividers to resize `MediaPool` width and timeline height; verify content reflows and sizes persist across reload (if persisted).
   - Scrolling/Zoom: wheel scrolls timeline horizontally; `Alt+wheel` zooms; cursor-centered zoom behavior validated.

## Decisions & Assumptions
- Use in-memory history with limited depth (configurable, e.g., 100 entries) unless user requests persistent undo across reloads.
- Prefer client-side waveform generation via `OfflineAudioContext`. Offer optional precomputed peaks if available in media metadata for faster loads.
- Thumbnails will be generated client-side using `HTMLVideoElement` + `Canvas` to avoid server-side dependencies; note this may be slow for very large or many files.
- Use simple `Splitter` components rather than pulling a heavy dependency; keep codebase lightweight.

## Further Considerations
1. Performance: waveform and thumbnail generation can be heavy; consider web workers or batching generation on idle.
2. Accessibility: ensure keyboard-only resizing and clear focus handling for timeline controls.
3. Conflict resolution: keyboard shortcuts must not interfere with browser defaults when input elements are focused.

---

### Checklist (IMPLEMENTATION_PLAN_V1B)
- [ ] Search/replace: `cutforge` → `juice cut` (UI strings, package.json, README)
- [ ] Add `history` manager and `Action` API
- [ ] Wire global keyboard shortcuts in `main.tsx`
- [ ] Implement `Waveform` component (canvas-based) and cache peaks
- [ ] Add `ThumbnailRoll` component for video clips
- [ ] Update `Timeline` to render waveforms & thumbnails and handle wheel/zoom
- [ ] Reposition playneedle in `Timeline.tsx`
- [ ] Raise `TorusMenu` z-index and fix stacking context
- [ ] Implement `Splitter` components and wire into `App.tsx` layout
- [ ] Persist panel sizes (optional: `localStorage`)
- [ ] Integrate undo/redo into user actions across UI
- [ ] Add unit tests for history and waveform helper functions
- [ ] Manual QA pass for all listed verification scenarios
- [ ] Documentation: add `IMPLEMENTATION_PLAN_V1B.md` to repo and update README shortcuts

## Estimated effort
- Discovery & design: 4–8 hours
- Core undo/redo + keyboard wiring: 6–12 hours
- Waveform + thumbnail features: 6–14 hours (depends on caching and performance optimizations)
- UI/UX fixes (playneedle, torus z-index, splitters): 3–6 hours
- Testing & polish: 3–6 hours

## Next steps
- Confirm approach for waveform (client computation vs precomputed) and thumbnail performance expectations.
- If approved, I'll produce task-level PR checklist and the exact file edits to implement first (undo system and keyboard wiring).

---

(This plan file added to repo root by the assistant.)