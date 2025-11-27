import { NPCController } from './NPCController.js';

export class CrowdManager {
    constructor(app) {
        this.app = app;
        this.controllers = new Map(); // Map<Character, NPCController>
        this.mode = 'WANDER';
    }

    register(character) {
        if (!this.controllers.has(character)) {
            const controller = new NPCController(character, this.app.screen);
            // If we are currently in a formation, new characters should know?
            // For simplicity, new characters start in Wander, but next frame update might catch them.
            this.controllers.set(character, controller);
        }
    }

    unregister(character) {
        if (this.controllers.has(character)) {
            this.controllers.delete(character);
        }
    }

    clear() {
        this.controllers.clear();
    }

    setMode(mode, targetPoints = []) {
        this.mode = mode;
        const controllers = Array.from(this.controllers.values());

        if (mode === 'WANDER') {
            controllers.forEach(c => c.clearFormationTarget());
        } else if (mode === 'FORMATION') {
            const npcCount = controllers.length;
            const pointCount = targetPoints.length;

            if (pointCount === 0) {
                // Nothing to form; fall back to wander
                controllers.forEach(c => c.clearFormationTarget());
                return;
            }

            let activePoints = [];

            if (npcCount <= pointCount) {
                // Fewer NPCs than points: spread them evenly across the whole shape
                const step = pointCount / npcCount;
                for (let i = 0; i < npcCount; i++) {
                    const idx = Math.floor(i * step);
                    activePoints.push(targetPoints[idx]);
                }
            } else {
                // More NPCs than points: first fill all points, extras wander
                activePoints = [...targetPoints];
            }

            // --- Spatial Assignment Optimization ---
            // Sort characters and points by vertical (Y) then horizontal (X) position.
            // This simple heuristic minimizes path crossing significantly compared to random assignment.
            
            // 1. Sort Controllers by current Y then X
            const sortedControllers = [...controllers].sort((a, b) => {
                const ca = a.character;
                const cb = b.character;
                // Bucket Y by 10px to create "rows" for X sorting stability
                if (Math.abs(ca.y - cb.y) > 10) return ca.y - cb.y;
                return ca.x - cb.x;
            });

            // 2. Sort Target Points by Y then X
            activePoints.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
                return a.x - b.x;
            });

            // 3. Assign
            for (let i = 0; i < sortedControllers.length; i++) {
                const controller = sortedControllers[i];
                if (i < activePoints.length) {
                    controller.setFormationTarget(activePoints[i]);
                } else {
                    controller.clearFormationTarget();
                }
            }
        }
    }

    assignTargets(points) {
        // Alias for setMode('FORMATION', points)
        this.setMode('FORMATION', points);
    }

    update(dt) {
        // Update all active AI controllers
        // dt is now in seconds (game ticker delta converted in App)
        for (const controller of this.controllers.values()) {
            controller.update(dt);
        }
    }
}