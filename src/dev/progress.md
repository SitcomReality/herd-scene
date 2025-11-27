# Development Progress

## Phase 1: Foundation for Shapes & Sequences
- [x] Implemented `ShapeGenerator` to create point clouds from text and basic geometry.
- [x] Created `SequenceManager` to handle timeline of frames (Shape vs Wander).
- [x] Updated `NPCController` to support a directed `FORMATION` mode where it seeks a specific coordinate.
- [x] Updated `CrowdManager` to handle target assignment (distributing points to NPCs).
- [x] Added UI controls to design a sequence of text/wander frames.

## Todo / Remaining
- [ ] Implement visual timeline editor (currently just text input).
- [ ] Better target assignment algorithm (currently greedy, might cross paths).
- [ ] Add more shape presets (Hearts, Stars, etc).
- [ ] Add transitions/tweens for formation arrival.
- [ ] Add "Hold" logic (NPCs arrive and face forward) - partially implemented.