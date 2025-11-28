import { ANIMATION_STATES } from '../constants.js';

// Tweakable NPC parameters (editable via host UI when available)
export const NPC_PARAMS = {
    brainSpeed: 1.0,               // How quickly the NPC decision timer scales (higher = faster decisions)
    idleDurationMin: 5,         // Idle state minimum duration (seconds)
    idleDurationMax: 15,         // Idle state maximum duration (seconds)
    bendDurationMin: 2,         // Bend/inspect state minimum duration (seconds)
    bendDurationMax: 8,         // Bend/inspect state maximum duration (seconds)
    wanderDurationMin: 5,       // Wander state minimum duration (seconds)
    wanderDurationMax: 25,      // Wander state maximum duration (seconds)
    runChance: 0.30,              // Chance to run when starting a wander (0..1)
    walkSpeed: 20,               // Movement speed multiplier when walking
    runSpeed: 40,                // Movement speed multiplier when running
    turnSpeed: 4.0,              // Rotation speed (radians per second)
    
    wanderTurnChance: 0.5,       // Probability to add a curve to the path
    wanderTurnMax: 1.0,          // Max rotational velocity (radians/sec) when wandering
    
    calmFactor: 2,              // Dampening applied to animation speed to make motion calmer
    decisionNoise: 0.15,          // Random noise added to timers (fraction)
    boundaryPadding: 50,          // Padding from screen edge before bouncing
    movementEnabled: true,         // Master toggle — if false, NPCs won't move
    
    formationSpeed: 60,           // Speed when moving to formation target
    formationArrivalDist: 5       // Distance to consider "arrived"
};

export class NPCController {
    constructor(character, screenBounds) {
        this.character = character;
        this.bounds = screenBounds;
        
        this.timer = 0;
        this.state = 'IDLE'; 
        
        // Initialize target to current facing so they don't snap immediately
        this.targetFacing = character.facing || 0;
        this.currentTurnRate = 0;
        
        // Formation Support
        this.mode = 'WANDER'; // 'WANDER' | 'FORMATION'
        this.formationTarget = null; // {x, y}

        // Initial random state, scaled by brainSpeed
        this.decideNextAction();
    }

    setFormationTarget(point) {
        this.mode = 'FORMATION';
        this.formationTarget = point;
        // Immediate reaction
        this.state = 'MOVING_TO_TARGET';
        this.timer = 9999; // Lock state until arrived
    }

    clearFormationTarget() {
        this.mode = 'WANDER';
        this.formationTarget = null;
        this.decideNextAction(); // Reset to standard behavior
    }

    update(dt) {
        // If in formation mode, override standard behavior loop
        if (this.mode === 'FORMATION' && this.formationTarget) {
            this.updateFormationBehavior(dt);
            return;
        }

        // Not in formation behavior; ensure formation-hold flag is cleared
        this.character.isInFormationHold = false;

        // Scale time by brainSpeed so host UI can speed up or slow down decision pacing
        const scaledDt = dt * NPC_PARAMS.brainSpeed;
        this.timer -= scaledDt;
        
        // State transition check
        if (this.timer <= 0) {
            this.decideNextAction();
        }

        // Behavior Logic
        if (this.state === 'WANDER' && NPC_PARAMS.movementEnabled) {
            this.move(dt);
        }
    }

    updateFormationBehavior(dt) {
        const c = this.character;
        const tx = this.formationTarget.x;
        const ty = this.formationTarget.y;

        const dx = tx - c.x;
        const dy = ty - c.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < NPC_PARAMS.formationArrivalDist) {
            // Arrived: ease into a relaxed idle facing the camera (front)
            c.state = ANIMATION_STATES.IDLE;
            c.speed = 0.1; // Slow breathing
            // Mark as holding formation so animation can apply subtle micro motion
            c.isInFormationHold = true;
            
            // Face forward (0) smoothly, but more gently than when running
            const diff = this.shortestAngleDist(c.facing, 0); // 0 is front
            const turnAmount = NPC_PARAMS.turnSpeed * 0.5 * dt;

            if (Math.abs(diff) > 0.01) {
                if (Math.abs(diff) <= turnAmount) {
                    c.facing = 0;
                } else {
                    c.facing += Math.sign(diff) * turnAmount;
                }
            } else {
                c.facing = 0;
            }
        } else {
            // Move towards target with eased slowdown as we approach
            c.isInFormationHold = false;

            // Running animation, but we'll modulate actual movement speed by distance
            c.state = ANIMATION_STATES.RUN;

            // Ease movement speed based on remaining distance
            const slowRadius = NPC_PARAMS.formationArrivalDist * 5;
            const t = Math.min(1, dist / slowRadius);
            const moveSpeed = NPC_PARAMS.formationSpeed * (0.2 + 0.8 * t); // never fully stops until arrival

            // Map movement speed to animation speed so legs match pace
            c.speed = moveSpeed * 0.1;

            // Compute target facing towards the formation point
            const angleToTarget = Math.atan2(dx, dy); 
            
            // Smooth turn
            const diff = this.shortestAngleDist(c.facing, angleToTarget);
            const turnAmount = NPC_PARAMS.turnSpeed * 2 * dt; // Turn fast in formation
            
            if (Math.abs(diff) <= turnAmount) {
                c.facing = angleToTarget;
            } else {
                c.facing += Math.sign(diff) * turnAmount;
            }
            
            // Normalize
            c.facing = (c.facing % (Math.PI * 2));

            // Move
            c.x += Math.sin(c.facing) * moveSpeed * dt;
            c.y += Math.cos(c.facing) * moveSpeed * dt;
        }
    }

    decideNextAction() {
        // Add a bit of noise so NPCs don't all sync perfectly
        const roll = Math.random();
        if (roll < 0.25) {
            // Idle for a bit (longer, calmer)
            const dur = NPC_PARAMS.idleDurationMin + Math.random() * (NPC_PARAMS.idleDurationMax - NPC_PARAMS.idleDurationMin);
            this.changeState('IDLE', dur * (1 + (Math.random() - 0.5) * NPC_PARAMS.decisionNoise));
        } else if (roll < 0.40) {
            // Inspect ground (bend)
            const dur = NPC_PARAMS.bendDurationMin + Math.random() * (NPC_PARAMS.bendDurationMax - NPC_PARAMS.bendDurationMin);
            this.changeState('BEND', dur * (1 + (Math.random() - 0.5) * NPC_PARAMS.decisionNoise));
        } else {
            // Wander somewhere
            const dur = NPC_PARAMS.wanderDurationMin + Math.random() * (NPC_PARAMS.wanderDurationMax - NPC_PARAMS.wanderDurationMin);
            this.changeState('WANDER', dur * (1 + (Math.random() - 0.5) * NPC_PARAMS.decisionNoise));
        }
    }

    changeState(newState, duration) {
        this.state = newState;
        this.timer = duration;
        this.currentTurnRate = 0;
        
        const c = this.character;
        // Any explicit state change (idle/bend/wander) means we're not in a formation hold
        c.isInFormationHold = false;

        if (newState === 'IDLE') {
            c.state = ANIMATION_STATES.IDLE;
            // Slower, gentler idle animation
            c.speed = 0.07 * NPC_PARAMS.calmFactor;
        } else if (newState === 'BEND') {
            c.state = ANIMATION_STATES.BEND;
            // Set speed so that (speed * duration) = PI
            // This ensures exactly one down-up cycle over the duration
            c.speed = Math.PI / duration; 
        } else if (newState === 'WANDER') {
            // Use configured run chance
            const run = Math.random() < NPC_PARAMS.runChance;
            c.state = run ? ANIMATION_STATES.RUN : ANIMATION_STATES.WALK;
            
            // Map to configured speeds
            // Increased walk scalar to prevent sliding look (0.1 -> 0.3)
            c.speed = run ? NPC_PARAMS.runSpeed * 0.1 : NPC_PARAMS.walkSpeed * 0.3; 
            
            // Pick a random target direction
            this.targetFacing = Math.random() * Math.PI * 2;

            // Optional: Curved movement
            if (Math.random() < NPC_PARAMS.wanderTurnChance) {
                this.currentTurnRate = (Math.random() * 2 - 1) * NPC_PARAMS.wanderTurnMax;
            }
        }
    }

    move(dt) {
        const c = this.character;
        
        // Continuous turning (curve the path)
        if (this.currentTurnRate !== 0) {
            this.targetFacing += this.currentTurnRate * dt;
        }

        // 1. Rotate character towards targetFacing
        const diff = this.shortestAngleDist(c.facing, this.targetFacing);
        const turnAmount = NPC_PARAMS.turnSpeed * dt;

        if (Math.abs(diff) <= turnAmount) {
            c.facing = this.targetFacing;
        } else {
            c.facing += Math.sign(diff) * turnAmount;
        }

        // Normalize facing to 0..2PI
        c.facing = (c.facing % (Math.PI * 2));
        if (c.facing < 0) c.facing += Math.PI * 2;

        // 2. Move Forward based on CURRENT facing
        // Coordinate alignment: 0 = Front/Down, PI/2 = Right
        const baseSpeed = c.state === ANIMATION_STATES.RUN ? NPC_PARAMS.runSpeed : NPC_PARAMS.walkSpeed; 
        
        // Use sin for X and cos for Y to align with Renderer's "0 = Front" orientation
        c.x += Math.sin(c.facing) * baseSpeed * dt;
        c.y += Math.cos(c.facing) * baseSpeed * dt;

        // Bounds Checking (Bounce)
        const pad = NPC_PARAMS.boundaryPadding;
        let bouncedX = false;
        let bouncedY = false;

        if (c.x < pad) {
            c.x = pad;
            bouncedX = true;
        } else if (c.x > this.bounds.width - pad) {
            c.x = this.bounds.width - pad;
            bouncedX = true;
        }

        if (c.y < pad) {
            c.y = pad;
            bouncedY = true;
        } else if (c.y > this.bounds.height - pad) {
            c.y = this.bounds.height - pad;
            bouncedY = true;
        }

        if (bouncedX) {
             // Reflect across vertical: angle -> -angle
             // Must update both current and target to preserve turn intention relative to new path
             c.facing = -c.facing;
             this.targetFacing = -this.targetFacing;
             // Don't flip turnRate; a left turn is still a left turn relative to new heading? 
             // Actually, geometrically, if reflecting, the chirality might swap. 
             // But simpler to leave it, they will just spiral the other way relative to world.
        }
        if (bouncedY) {
            // Reflect across horizontal: angle -> PI - angle
            c.facing = Math.PI - c.facing;
            this.targetFacing = Math.PI - this.targetFacing;
        }
    }

    shortestAngleDist(from, to) {
        let diff = to - from;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return diff;
    }
}