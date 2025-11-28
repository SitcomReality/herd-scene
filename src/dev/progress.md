# Development Progress

## Phase 1: Foundation for Shapes & Sequences
- [x] Implemented `ShapeGenerator` to create point clouds from text and basic geometry.
- [x] Created `SequenceManager` to handle timeline of frames (Shape vs Wander).
- [x] Updated `NPCController` to support a directed `FORMATION` mode where it seeks a specific coordinate.
- [x] Updated `CrowdManager` to handle target assignment (distributing points to NPCs).
- [x] Added UI controls to design a sequence of text/wander frames.

## Phase 2: Refinement & Variety
- [x] Added more shape presets: Heart, Star, Circle using canvas scan method.
- [x] Improved target assignment algorithm using spatial sorting (Y then X) to minimize path crossing.
- [x] Updated SequenceManager to handle `SHAPE` frame types.
- [x] Updated UI to include Shape selection and insertion.

## Phase 3: UX Overhaul (Current)
- [x] Implemented observable pattern in SequenceManager to support UI reactivity.
- [x] Created custom "Visual Timeline" UI to replace debug controls.
- [x] Added Inspector panel for fine-tuning individual frames.
- [x] Added Global Settings panel for simulation parameters.
- [x] Implemented greedy minimum-distance target assignment to reduce NPC travel distances while maintaining shape diffusion.
- [x] Refined formation target assignment to reduce late “musical chairs” cross-map treks.
- [x] Added multiline TEXT frame support so multiple lines render as separate rows.
- [x] Added keyboard shortcuts: U to hide/show UI, Space to toggle Play/Stop.
- [x] Added drag-and-drop reordering to the timeline so frames can be rearranged visually.
- [x] Added eased formation arrival so NPCs slow down as they reach targets and settle into a natural front-facing idle pose.

## Todo / Remaining
- [x] "Hold" logic refinement: add subtle idle variation while holding formation (micro head/torso motion).
- [ ] Add "Explode" or "Scatter" transition effect between frames?
- [ ] Performance: Optimize spatial sort if NPC count > 1000.