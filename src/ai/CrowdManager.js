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

            if (npcCount <= pointCount) {
                // Fewer NPCs than points: spread them evenly across the whole shape
                const step = pointCount / npcCount;
                for (let i = 0; i < npcCount; i++) {
                    const idx = Math.floor(i * step);
                    controllers[i].setFormationTarget(targetPoints[idx]);
                }
            } else {
                // More NPCs than points: first fill all points, extras wander
                for (let i = 0; i < npcCount; i++) {
                    if (i < pointCount) {
                        controllers[i].setFormationTarget(targetPoints[i]);
                    } else {
                        controllers[i].clearFormationTarget();
                    }
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