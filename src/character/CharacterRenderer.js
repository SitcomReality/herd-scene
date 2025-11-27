import { SHAPES } from '../constants.js';

export class CharacterRenderer {
    constructor(character) {
        this.character = character;
        this.initialized = false;
        this.lastPalette = null;
    }

    init() {
        const c = this.character;
        this.lastPalette = c.colors;
        
        // Base geometries (drawn once at scale 1, we use transform scale later)
        // We draw them relative to their pivots.
        
        // Configs
        const outline = SHAPES.OUTLINE_THICKNESS;
        const bodyW = SHAPES.BODY_WIDTH;
        const bodyH = SHAPES.BODY_HEIGHT * c.variations.bodyHeight;
        const headR = SHAPES.HEAD_RADIUS;
        const limbW = SHAPES.LIMB_WIDTH;
        const limbH = SHAPES.LIMB_HEIGHT; // base height, we scale Y for length variations

        // Helpers
        const drawLimb = (g, color) => {
            g.clear();
            g.lineStyle(outline, 0x000000, 1, 0.5);
            g.beginFill(color);
            // Pivot top-center: (-w/2, 0)
            g.drawRoundedRect(-limbW / 2, 0, limbW, limbH, limbW / 2);
            g.endFill();
        };

        drawLimb(c.leftLeg, c.colors.legs);
        drawLimb(c.rightLeg, c.colors.legs);
        drawLimb(c.leftArm, c.colors.arms);
        drawLimb(c.rightArm, c.colors.arms);

        // Body: Draw relative to Hip (bottom-center)
        const bodyG = c.bodyG;
        bodyG.clear();
        bodyG.lineStyle(outline, 0x000000, 1, 0.5);
        bodyG.beginFill(c.colors.body);
        // Hip is (0,0). Body goes up.
        bodyG.drawRoundedRect(-bodyW / 2, -bodyH, bodyW, bodyH, 4);
        
        // Fake Shadow under body (drawn on bodyG)
        bodyG.lineStyle(0);
        bodyG.beginFill(0x000000, 0.2);
        bodyG.drawRect(
            -bodyW / 2 + outline,
            -6,
            bodyW - outline * 2,
            4
        );
        bodyG.endFill();

        // Head: Separate graphic now
        const headG = c.headG;
        headG.clear();
        headG.lineStyle(outline, 0x000000, 1, 0.5);
        headG.beginFill(c.colors.head);
        // Pivot is Neck (bottom of head). Head circle center is at (0, -headR) relative to neck?
        // Let's say pivot is center of head for easier rotation.
        // Actually neck pivot is better for "looking".
        // Let's draw head such that (0,0) is the neck attachment point.
        // Circle center is (0, -headR + overlap).
        const neckOverlap = 4;
        headG.drawCircle(0, -headR + neckOverlap, headR);

        // Highlight
        headG.lineStyle(0);
        headG.beginFill(0xFFFFFF, 0.3);
        headG.drawCircle(-headR / 3, -headR + neckOverlap - headR/3, headR / 3);
        headG.endFill();

        // Shadow
        const shadow = c.shadow;
        shadow.clear();
        shadow.beginFill(0x000000);
        shadow.drawEllipse(0, 0, bodyW * 0.9, 6);
        shadow.endFill();

        this.initialized = true;
    }

    draw() {
        const c = this.character;
        
        // Redraw cached shapes if colors changed
        if (!this.initialized || c.colors !== this.lastPalette) {
            this.init();
        }

        // Apply Global Scale to the entire container
        // This scales outline thickness too, which is acceptable and performant.
        c.graphics.scale.set(c.scale);
        c.shadow.scale.set(c.scale);

        // Constants adjusted for scale (layout only, graphics are pre-scaled 1)
        // Actually, since we scale the container, we calculate positions in "Unscaled" space
        // and Pixi scales the final result.
        const s = 1.0; 
        const bodyBaseH = SHAPES.BODY_HEIGHT * c.variations.bodyHeight;
        const limbH = SHAPES.LIMB_HEIGHT;
        const bodyW = SHAPES.BODY_WIDTH;
        const headR = SHAPES.HEAD_RADIUS;

        // --- CENTER OF CHARACTER ---
        // Base center Y (ground anchored)
        const baseCenterY = -20;
        const centerY = baseCenterY - c.bobOffset;

        // --- FACING LOGIC ---
        const cosA = Math.cos(c.facing);
        const sinA = Math.sin(c.facing);
        const viewSideFactor = Math.abs(sinA);
        const viewFrontFactor = 1.0 - viewSideFactor;

        // Perspective shortening for torso when leaning
        const rawTorsoTilt = c.torsoTilt || 0;
        const torsoLeanAmount = Math.abs(rawTorsoTilt);
        const torsoPerspectiveScale = 1 - torsoLeanAmount * viewFrontFactor * 0.15;
        const visualBodyH = bodyBaseH * torsoPerspectiveScale;

        // Limb X Offsets (Sliding)
        const armXOffset = (bodyW / 2) * cosA;
        const legXOffset = 6 * cosA;

        // Z-Sorting
        let zFarArm = 10, zFarLeg = 20, zBody = 30, zNearLeg = 40, zNearArm = 50;
        if (sinA >= 0) { // Facing Right
            c.leftArm.zIndex = zNearArm; c.leftLeg.zIndex = zNearLeg; c.bodyG.zIndex = zBody; c.headG.zIndex = zBody + 1;
            c.rightLeg.zIndex = zFarLeg; c.rightArm.zIndex = zFarArm;
        } else { // Facing Left
            c.leftArm.zIndex = zFarArm; c.leftLeg.zIndex = zFarLeg; c.bodyG.zIndex = zBody; c.headG.zIndex = zBody + 1;
            c.rightLeg.zIndex = zNearLeg; c.rightArm.zIndex = zNearArm;
        }

        const leftIsFar = (sinA < 0);
        const rightIsFar = !leftIsFar;
        const farLimbLift = -2 * viewSideFactor;

        // --- ANIMATION PERSPECTIVE ---
        const rotScale = 0.2 + (0.8 * viewSideFactor);

        // Shorten limbs when swinging towards camera
        // We use Scale Y to simulate shortening.
        const getForeshorteningScale = (angle) => {
             const swingAmt = Math.abs(angle);
             return 1.0 - (swingAmt * viewFrontFactor * 0.3);
        };

        const rLegScale = getForeshorteningScale(c.angles.rightLeg) * c.variations.legLength;
        const lLegScale = getForeshorteningScale(c.angles.leftLeg) * c.variations.legLength;
        const rArmScale = getForeshorteningScale(c.angles.rightArm) * c.variations.armLength;
        const lArmScale = getForeshorteningScale(c.angles.leftArm) * c.variations.armLength;

        // Apply angles (flattened for front view)
        const rArmAng = c.angles.rightArm * rotScale;
        const lArmAng = c.angles.leftArm * rotScale;
        const rLegAng = c.angles.rightLeg * rotScale;
        const lLegAng = c.angles.leftLeg * rotScale;

        // Base attachment positions
        const legBaseY = centerY + visualBodyH / 2 - 2;
        const hipX = 0;
        const hipY = legBaseY; // Pivot for body

        // Torso & Head Rotation
        const sideSign = sinA >= 0 ? 1 : -1;
        const visualTorsoTilt = rawTorsoTilt * viewSideFactor;
        const tTilt = visualTorsoTilt * sideSign;
        
        const visualHeadTilt = (c.headTilt || 0) * viewSideFactor;
        const hTilt = visualHeadTilt * sideSign;

        // Calculate Shoulder Positions (rotate with torso)
        const armRelY = -visualBodyH + (visualBodyH * 0.25); // Shoulders are down from top
        const cosT = Math.cos(tTilt);
        const sinT = Math.sin(tTilt);

        const getShoulderPos = (sSign) => {
            const lx = sSign * armXOffset; 
            const ly = armRelY; // Relative to hip
            // Rotate around hip
            const rx = lx * cosT - ly * sinT;
            const ry = lx * sinT + ly * cosT;
            return { x: hipX + rx, y: hipY + ry };
        };

        const lShoulder = getShoulderPos(-1);
        const rShoulder = getShoulderPos(1);

        // --- APPLY TRANSFORMS ---
        
        // Legs
        c.leftLeg.position.set(hipX - legXOffset, legBaseY + (leftIsFar ? farLimbLift : 0));
        c.leftLeg.rotation = lLegAng;
        c.leftLeg.scale.set(1, lLegScale);

        c.rightLeg.position.set(hipX + legXOffset, legBaseY + (rightIsFar ? farLimbLift : 0));
        c.rightLeg.rotation = rLegAng;
        c.rightLeg.scale.set(1, rLegScale);

        // Arms
        c.leftArm.position.set(lShoulder.x, lShoulder.y + (leftIsFar ? farLimbLift : 0));
        c.leftArm.rotation = lArmAng + tTilt;
        c.leftArm.scale.set(0.8, lArmScale); // Arms are naturally thinner (0.8)

        c.rightArm.position.set(rShoulder.x, rShoulder.y + (rightIsFar ? farLimbLift : 0));
        c.rightArm.rotation = rArmAng + tTilt;
        c.rightArm.scale.set(0.8, rArmScale);

        // Body
        c.bodyG.position.set(hipX, hipY);
        c.bodyG.rotation = tTilt;
        // Scale body height if leaning for perspective
        c.bodyG.scale.set(1, torsoPerspectiveScale);

        // Head
        // Calculate Neck position relative to Hip
        // Neck is at top of body (local 0, -bodyBaseH)
        // Rotated by Torso Tilt
        const neckLocalX = 0;
        const neckLocalY = -bodyBaseH; // use unscaled height, we rotate the vector
        const neckWorldX = hipX + (neckLocalX * cosT - neckLocalY * sinT);
        const neckWorldY = hipY + (neckLocalX * sinT + neckLocalY * cosT);

        c.headG.position.set(neckWorldX, neckWorldY);
        c.headG.rotation = tTilt + hTilt; // Add head tilt to torso tilt
        c.headG.scale.set(1, 1); // Head stays round

        // Shadow
        const shadowYOffset = baseCenterY + visualBodyH / 2 + (limbH * c.variations.legLength) - 2;
        c.shadow.position.y = shadowYOffset; // Relative to character container
        // We set shadow scale Y to flatten it
        // c.shadow.scale was set to global scale earlier. 
        // We need to flatten it locally? 
        // No, we drew it as an ellipse. So uniform scale keeps it an ellipse.
        
        // Ground Y for sorting
        c.groundY = c.y + (shadowYOffset * c.scale);
    }
}