import { ANIMATION_STATES } from '../constants.js';

export class CharacterAnimation {
    constructor(character) {
        this.character = character;

        // State blending (tweening) support
        this.currentState = null;
        this.prevState = null;
        this.blendTime = 0;
        this.blendDuration = 0.2; // seconds for cross-fade between states
        this.blendFromPose = null;
    }

    update(deltaTime, globalSpeed, globalState) {
        const c = this.character;

        // Initialize current state on first update
        if (this.currentState === null) {
            this.currentState = globalState;
        }

        // Detect state change and start blend
        if (globalState !== this.currentState) {
            this.prevState = this.currentState;
            this.currentState = globalState;
            this.blendTime = 0;

            // Capture the current on-screen pose as the start of the blend
            this.blendFromPose = {
                bobOffset: c.bobOffset || 0,
                torsoTilt: c.torsoTilt || 0,
                leftLeg: c.angles.leftLeg || 0,
                rightLeg: c.angles.rightLeg || 0,
                leftArm: c.angles.leftArm || 0,
                rightArm: c.angles.rightArm || 0
            };
        }

        // Update state timer
        c.stateTime += deltaTime * globalSpeed;

        // Update frame counter (with run speed multiplier)
        const stateSpeedMultiplier = this.currentState === ANIMATION_STATES.RUN ? 2.0 : 1.0;
        c.frame += (c.speed * globalSpeed * stateSpeedMultiplier) * deltaTime;

        const t = c.frame;

        // Compute target pose for current state
        const targetPose = this.computePoseForState(this.currentState, t, c.stateTime);

        let finalPose = targetPose;

        // If blending, interpolate from previous pose to target pose
        if (this.blendFromPose && this.blendTime < this.blendDuration) {
            this.blendTime += deltaTime;
            const alpha = Math.min(1, this.blendTime / this.blendDuration);

            const lerp = (a, b, t) => a + (b - a) * t;

            finalPose = {
                bobOffset: lerp(this.blendFromPose.bobOffset, targetPose.bobOffset, alpha),
                torsoTilt: lerp(this.blendFromPose.torsoTilt, targetPose.torsoTilt, alpha),
                leftLeg: lerp(this.blendFromPose.leftLeg, targetPose.leftLeg, alpha),
                rightLeg: lerp(this.blendFromPose.rightLeg, targetPose.rightLeg, alpha),
                leftArm: lerp(this.blendFromPose.leftArm, targetPose.leftArm, alpha),
                rightArm: lerp(this.blendFromPose.rightArm, targetPose.rightArm, alpha)
            };

            // Clear blend source when finished
            if (alpha >= 1) {
                this.blendFromPose = null;
            }
        }

        // Apply final pose to character
        c.bobOffset = finalPose.bobOffset;
        c.torsoTilt = finalPose.torsoTilt;
        c.angles.leftLeg = finalPose.leftLeg;
        c.angles.rightLeg = finalPose.rightLeg;
        c.angles.leftArm = finalPose.leftArm;
        c.angles.rightArm = finalPose.rightArm;
    }

    computePoseForState(state, t, stateTime) {
        const pose = {
            bobOffset: 0,
            torsoTilt: 0,
            leftLeg: 0,
            rightLeg: 0,
            leftArm: 0,
            rightArm: 0
        };

        // Baseline idle parameters used by multiple states
        const idleBob = Math.sin(t * 0.05) * 2;
        const idleLArm = Math.sin(t * 0.05) * 0.1;
        const idleRArm = Math.cos(t * 0.05) * 0.1;

        if (state === ANIMATION_STATES.IDLE) {
            // Breathing / Bobbing
            pose.bobOffset = idleBob;
            pose.torsoTilt = 0;
            pose.leftLeg = 0;
            pose.rightLeg = 0;
            pose.leftArm = idleLArm;
            pose.rightArm = idleRArm;
        } 
        else if (state === ANIMATION_STATES.WALK) {
            pose.bobOffset = Math.abs(Math.sin(t * 0.5)) * 4; // Bob up and down
            pose.torsoTilt = 0;

            // Walk Cycle
            const legAmp = 0.5;
            const armAmp = 0.6;
            const freq = 0.5; // Reduced leg spread previously via amp

            pose.leftLeg = Math.sin(t * freq) * legAmp;
            pose.rightLeg = Math.sin(t * freq + Math.PI) * legAmp;

            pose.leftArm = Math.sin(t * freq + Math.PI) * armAmp;
            pose.rightArm = Math.sin(t * freq) * armAmp;
        } 
        else if (state === ANIMATION_STATES.RUN) {
            // Running bob and forward lean
            pose.bobOffset = Math.abs(Math.sin(t * 0.45)) * 5;
            pose.torsoTilt = 0.30;

            // Run Cycle (More aggressive angles)
            const legAmp = 1.2;
            const armAmp = 0.9;
            const runFreq = 0.45;

            pose.leftLeg = Math.sin(t * runFreq) * legAmp;
            pose.rightLeg = Math.sin(t * runFreq + Math.PI) * legAmp;

            pose.leftArm = Math.sin(t * runFreq + Math.PI) * armAmp;
            pose.rightArm = Math.sin(t * runFreq) * armAmp;
        } 
        else if (state === ANIMATION_STATES.BEND) {
            // Bend forward to pick something up, torso rotates from hips

            // Calculate cycle from stateTime (0 -> PI) based on c.speed (set externally)
            const phase = stateTime * this.character.speed;
            const clampedPhase = Math.max(0, Math.min(Math.PI, phase));
            const cycle = Math.sin(clampedPhase); // 0 -> 1 -> 0

            const maxTilt = 0.9; // radians, about 50 degrees forward

            // Interpolate from IDLE bob (idleBob) to 0 (at max bend)
            pose.bobOffset = idleBob * (1 - cycle);
            pose.torsoTilt = cycle * maxTilt;

            // Slight knee bend
            const legBendBase = 0.3;
            const legBendOsc = 0.1 * Math.sin(stateTime * 4);
            const targetLegAngleL = legBendBase + legBendOsc;
            const targetLegAngleR = legBendBase - legBendOsc;

            pose.leftLeg = targetLegAngleL * cycle;
            pose.rightLeg = targetLegAngleR * cycle;

            // Arms reaching down toward the ground
            const reachBase = -0.6;
            const reachSwing = 0.2 * Math.sin(stateTime * 4 + Math.PI);
            const targetArmAngleL = reachBase + reachSwing;
            const targetArmAngleR = reachBase - reachSwing;

            pose.leftArm = idleLArm * (1 - cycle) + targetArmAngleL * cycle;
            pose.rightArm = idleRArm * (1 - cycle) + targetArmAngleR * cycle;
        } 
        else {
            // Fallback to a neutral pose
            pose.bobOffset = 0;
            pose.torsoTilt = 0;
            pose.leftLeg = 0;
            pose.rightLeg = 0;
            pose.leftArm = idleLArm;
            pose.rightArm = idleRArm;
        }

        return pose;
    }
}