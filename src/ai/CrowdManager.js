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
            // Assign points to NPCs
            // Simple approach: Assign i-th point to i-th NPC
            // If points > NPCs, some points are ignored.
            // If NPCs > points, extras wander/idle? Let's have them move to edges or just wander.
            
            // Randomize array to prevent "striping" artifacts if the list is ordered by creation
            // (Optional, skipping for stability for now)

            for (let i = 0; i < controllers.length; i++) {
                if (i < targetPoints.length) {
                    controllers[i].setFormationTarget(targetPoints[i]);
                } else {
                    // Extra NPC
                    // Send to a random spot on the edge or just let wander?
                    // Let's force them to wander away from center to clear the canvas
                    // or just let them wander normally.
                    controllers[i].clearFormationTarget(); 
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