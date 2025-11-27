import { NPCController } from './NPCController.js';

const distSq = (p1, p2) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
};

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
            
            if (targetPoints.length === 0) {
                controllers.forEach(c => c.clearFormationTarget());
                return;
            }

            const npcControllers = Array.from(this.controllers.values());
            const npcCount = npcControllers.length;
            const pointCount = targetPoints.length;

            let finalTargetPoints = [];

            if (npcCount < pointCount) {
                // Constraint 2: Fewer NPCs than points. Spread them evenly across the whole shape.
                // targetPoints must be stable (spatially sorted) for this sampling to work.
                const step = pointCount / npcCount;
                for (let i = 0; i < npcCount; i++) {
                    const idx = Math.floor(i * step);
                    finalTargetPoints.push(targetPoints[idx]);
                }
            } else {
                // Constraint 1: Enough NPCs. Use all points.
                finalTargetPoints = [...targetPoints];
            }
            
            // Now, assign NPCs to finalTargetPoints using spatial sorting to avoid "last-chair" long treks.

            // 1. Sort NPCs by position (primary X, secondary Y)
            npcControllers.sort((a, b) => {
                const ax = a.character.x;
                const bx = b.character.x;
                if (ax === bx) {
                    return a.character.y - b.character.y;
                }
                return ax - bx;
            });

            // 2. Sort points by position (primary X, secondary Y)
            finalTargetPoints.sort((p1, p2) => {
                if (p1.x === p2.x) {
                    return p1.y - p2.y;
                }
                return p1.x - p2.x;
            });

            // 3. Pair by index so nearby NPCs get nearby points along the sweep
            const pairs = Math.min(npcCount, finalTargetPoints.length);
            for (let i = 0; i < pairs; i++) {
                npcControllers[i].setFormationTarget(finalTargetPoints[i]);
            }

            // 4. Any extra NPCs without a target go back to wandering behavior
            for (let i = pairs; i < npcCount; i++) {
                npcControllers[i].clearFormationTarget();
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