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
            
            // Now, assign NPCs to finalTargetPoints prioritizing proximity (Greedy Assignment)
            
            // 1. Generate all possible assignments between available NPCs and selected points
            const assignments = [];
            for (let i = 0; i < npcControllers.length; i++) {
                const controller = npcControllers[i];
                const charPos = controller.character; 
                
                for (let j = 0; j < finalTargetPoints.length; j++) {
                    const point = finalTargetPoints[j];
                    const distanceSq = distSq(charPos, point);
                    
                    assignments.push({
                        controller,
                        point,
                        distanceSq
                    });
                }
            }

            // 2. Sort by minimum distance
            assignments.sort((a, b) => a.distanceSq - b.distanceSq);

            const assignedControllers = new Set();
            const assignedPoints = new Set();
            const assignmentsToApply = [];

            // 3. Greedily assign closest available pairs
            for (const assignment of assignments) {
                const { controller, point } = assignment;
                
                // Use the controller instance and point object reference for Sets
                if (!assignedControllers.has(controller) && !assignedPoints.has(point)) {
                    assignmentsToApply.push({ controller, point });
                    assignedControllers.add(controller);
                    assignedPoints.add(point);

                    // We only need to assign min(N_npc, N_points_selected) pairs.
                    if (assignmentsToApply.length === Math.min(npcCount, finalTargetPoints.length)) {
                        break;
                    }
                }
            }

            // 4. Apply assignments and handle unassigned NPCs
            npcControllers.forEach(controller => {
                const assignment = assignmentsToApply.find(a => a.controller === controller);
                
                if (assignment) {
                    controller.setFormationTarget(assignment.point);
                } else {
                    controller.clearFormationTarget(); 
                }
            });
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