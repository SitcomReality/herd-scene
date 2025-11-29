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
                // Constraint 2: Fewer NPCs than points. 
                // Since points are now pre-shuffled by Generator, we can just take the first N
                // to get a random uniform distribution of the shape.
                finalTargetPoints = targetPoints.slice(0, npcCount);
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
            // If there are more NPCs than points, have the extras run toward edge-flee points
            if (npcCount > finalTargetPoints.length) {
                // Generate a set of edge targets (spread around the viewport edges)
                const screen = this.app.screen;
                const edgeTargets = [];
                // Create one edge target per extra NPC distributed around edges
                const extras = npcCount - finalTargetPoints.length;
                for (let i = 0; i < extras; i++) {
                    // Choose an edge (0=top,1=right,2=bottom,3=left) and a random offset along that edge
                    const edge = i % 4;
                    const t = (i / extras); // spreads along edges
                    if (edge === 0) { // top
                        edgeTargets.push({ x: screen.width * (0.1 + 0.8 * t), y: -50 });
                    } else if (edge === 1) { // right
                        edgeTargets.push({ x: screen.width + 50, y: screen.height * (0.1 + 0.8 * t) });
                    } else if (edge === 2) { // bottom
                        edgeTargets.push({ x: screen.width * (0.9 - 0.8 * t), y: screen.height + 50 });
                    } else { // left
                        edgeTargets.push({ x: -50, y: screen.height * (0.9 - 0.8 * t) });
                    }
                }

                // Assign edge targets to the remaining NPC controllers
                for (let i = pairs; i < npcCount; i++) {
                    const extraIndex = i - pairs;
                    const target = edgeTargets[extraIndex % edgeTargets.length];
                    // Use setFormationTarget so NPCController will actively move to the point
                    npcControllers[i].setFormationTarget(target);
                }
            } else {
                // No extras, ensure none are left in formation without a point
                for (let i = pairs; i < npcCount; i++) {
                    npcControllers[i].clearFormationTarget();
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