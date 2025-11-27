import { SHAPES } from '../constants.js';

export class CharacterRenderer {
    constructor(character) {
        this.character = character;
    }

    draw() {
        const c = this.character;
        const g = c.graphics;

        // Configs
        const s = c.scale;
        const outline = SHAPES.OUTLINE_THICKNESS * s;
        const bodyBaseH = SHAPES.BODY_HEIGHT * s * c.variations.bodyHeight;
        const headR = SHAPES.HEAD_RADIUS * s;
        const limbW = SHAPES.LIMB_WIDTH * s;
        const limbH = SHAPES.LIMB_HEIGHT * s;

        // --- CENTER OF CHARACTER ---
        const centerX = 0;
        // Base center Y (ground anchored) - bobOffset raises the visible body above this base.
        const baseCenterY = -20 * s;
        const centerY = baseCenterY - c.bobOffset; // Lift body up visually while keeping a ground reference

        // --- FACING LOGIC ---
        // 0 = Front, PI/2 = Right, PI = Back, 3PI/2 = Left
        const cosA = Math.cos(c.facing);
        const sinA = Math.sin(c.facing);

        // View Factor: 1.0 = Side View, 0.0 = Front/Back View
        const viewSideFactor = Math.abs(sinA);
        const viewFrontFactor = 1.0 - viewSideFactor;

        // Perspective shortening for torso when leaning and facing front/back.
        const rawTorsoTilt = c.torsoTilt || 0;
        const torsoLeanAmount = Math.abs(rawTorsoTilt);
        const torsoPerspectiveScale = 1 - torsoLeanAmount * viewFrontFactor * 0.15;
        const bodyH = bodyBaseH * torsoPerspectiveScale;

        // Limb Positioning (Sliding)
        // At Front view (cos=1), limbs are at max width (+/- bodyW/2)
        // At Side view (cos=0), limbs are centered (0)
        const bodyW = SHAPES.BODY_WIDTH * s;
        const armXOffset = (bodyW / 2) * cosA;
        const legXOffset = (6 * s) * cosA;

        // Z-Sorting Weights
        // We need explicit order: visually-correct motion/facing with:
        // FarArm (back) < FarLeg < Body < NearLeg < NearArm (front)
        // Note: numerically lower zIndex is rendered behind in Pixi.
        let zFarArm = 10;
        let zFarLeg = 20;
        let zBody = 30;
        let zNearLeg = 40;
        let zNearArm = 50;

        if (sinA >= 0) {
            // Facing Right: left limbs are visually nearer, right limbs are visually farther
            c.leftArm.zIndex = zNearArm;
            c.leftLeg.zIndex = zNearLeg;
            c.bodyG.zIndex = zBody;
            c.rightLeg.zIndex = zFarLeg;
            c.rightArm.zIndex = zFarArm;
        } else {
            // Facing Left: right limbs are visually nearer, left limbs are visually farther
            c.leftArm.zIndex = zFarArm;
            c.leftLeg.zIndex = zFarLeg;
            c.bodyG.zIndex = zBody;
            c.rightLeg.zIndex = zNearLeg;
            c.rightArm.zIndex = zNearArm;
        }

        // Determine which limbs are on the far side for vertical offset
        // "Far" = visually behind (lower zIndex set above).
        const leftIsFar = (sinA < 0);   // when facing Left, left side is farther
        const rightIsFar = !leftIsFar;
        // Far-side limbs lift up to 2 units, scaled by character scale and side-view factor
        // Negative Y is "Up" in screen space, so this raises the far limbs slightly higher.
        const farLimbLift = -2 * s * viewSideFactor;

        // --- ANIMATION PERSPECTIVE ---
        // Flatten the rotation arc when facing front (it becomes vertical movement/scaling)
        // We keep 20% rotation even at front view so it's not totally stiff
        const rotScale = 0.2 + (0.8 * viewSideFactor);

        // Shorten limbs when they swing "towards" camera in front view
        const getShortenedLen = (baseLen, angle) => {
            const swingAmt = Math.abs(angle); 
            // Shorten proportional to swing angle * frontness
            const shortenAmt = swingAmt * viewFrontFactor * 0.3;
            return baseLen * (1.0 - shortenAmt);
        };

        const rArmLen = getShortenedLen(limbH * c.variations.armLength, c.angles.rightArm);
        const lArmLen = getShortenedLen(limbH * c.variations.armLength, c.angles.leftArm);
        const rLegLen = getShortenedLen(limbH * c.variations.legLength, c.angles.rightLeg);
        const lLegLen = getShortenedLen(limbH * c.variations.legLength, c.angles.leftLeg);

        const rArmAng = c.angles.rightArm * rotScale;
        const lArmAng = c.angles.leftArm * rotScale;
        const rLegAng = c.angles.rightLeg * rotScale;
        const lLegAng = c.angles.leftLeg * rotScale;

        // Base attachment Y positions
        const legBaseY = centerY + bodyH / 2 - 2 * s;
        const armBaseY = centerY - bodyH / 4;
        const hipX = centerX;
        const hipY = legBaseY; // top of legs, bottom-center of torso

        // Calculate arm attachment Y relative to hip (bodyG pivot)
        const armRelY = armBaseY - hipY; 

        // Torso Rotation Helpers
        // Flip torso tilt sign depending on which side is facing the viewer.
        // When facing right (sinA >= 0) keep positive tilt, when facing left invert it.
        const sideSign = sinA >= 0 ? 1 : -1;
        const visualTorsoTilt = rawTorsoTilt * viewSideFactor;
        const tTilt = visualTorsoTilt * sideSign;
        const cosT = Math.cos(tTilt);
        const sinT = Math.sin(tTilt);

        // Calculate Shoulder Positions in World Space (relative to graphics container)
        // This ensures arms move with torso but can be Z-sorted independently
        const getShoulderPos = (sideSign) => {
            // sideSign: -1 for Left, 1 for Right
            const lx = sideSign * armXOffset; 
            const ly = armRelY;

            // Rotate (lx, ly) by tTilt around (0,0) which is Hip
            const rx = lx * cosT - ly * sinT;
            const ry = lx * sinT + ly * cosT;

            return { x: hipX + rx, y: hipY + ry };
        };

        const lShoulder = getShoulderPos(-1);
        const rShoulder = getShoulderPos(1);

        // --- SHADOW ---
        const shadow = c.shadow;
        shadow.clear();
        // Move shadow down roughly by the leg length so it sits under the feet
        // Keep shadow anchored to the ground (ignore bobOffset) so it doesn't rise with the body
        const shadowYOffset = baseCenterY + bodyH / 2 + (limbH * c.variations.legLength) - 2 * s;
        shadow.beginFill(0x000000);
        shadow.drawEllipse(0, shadowYOffset, bodyW * 0.9, 6 * s);
        shadow.endFill();

        // Publish a stable "ground Y" for the character so external systems can sort by ground level.
        // shadow.position.y is c.shadow.y (set from Character.update), so the world-space ground Y is:
        c.groundY = c.shadow.y + shadowYOffset;
        
        // --- DRAW LIMBS ---
        // Left leg
        this.drawLimbShape(
            c.leftLeg,
            centerX - legXOffset,
            legBaseY + (leftIsFar ? farLimbLift : 0),
            limbW,
            lLegLen,
            lLegAng,
            c.colors.legs,
            outline
        );

        // Right leg
        this.drawLimbShape(
            c.rightLeg,
            centerX + legXOffset,
            legBaseY + (rightIsFar ? farLimbLift : 0),
            limbW,
            rLegLen,
            rLegAng,
            c.colors.legs,
            outline
        );

        // Left arm
        this.drawLimbShape(
            c.leftArm,
            lShoulder.x,
            lShoulder.y + (leftIsFar ? farLimbLift : 0),
            limbW * 0.8,
            lArmLen,
            lArmAng + tTilt, // Add torso tilt (now view-attenuated and flipped correctly) to arm angle
            c.colors.arms,
            outline
        );

        // Right arm
        this.drawLimbShape(
            c.rightArm,
            rShoulder.x,
            rShoulder.y + (rightIsFar ? farLimbLift : 0),
            limbW * 0.8,
            rArmLen,
            rArmAng + tTilt, // Add torso tilt (now view-attenuated and flipped correctly) to arm angle
            c.colors.arms,
            outline
        );

        // --- BODY + HEAD (reuse bodyG), rotated around hip joint ---
        const bodyG = c.bodyG;
        bodyG.clear();

        // Position the body container at the hip and rotate the whole torso/head
        bodyG.position.set(hipX, hipY);
        bodyG.rotation = tTilt;

        // Body
        bodyG.lineStyle(outline, 0x000000, 1, 0.5); // Outer alignment
        bodyG.beginFill(c.colors.body);
        // Draw torso so that hip is at bottom-center of this rect
        bodyG.drawRoundedRect(-bodyW / 2, -bodyH, bodyW, bodyH, 4 * s);

        // Fake Shadow under body (near the hip)
        bodyG.lineStyle(0);
        bodyG.beginFill(0x000000, 0.2); // Semi transparent shadow
        bodyG.drawRect(
            -bodyW / 2 + outline,
            -6 * s,
            bodyW - outline * 2,
            4 * s
        );
        bodyG.endFill();

        // Head
        bodyG.lineStyle(outline, 0x000000, 1, 0.5);
        bodyG.beginFill(c.colors.head);
        bodyG.drawCircle(0, -bodyH - headR + 4 * s, headR);

        // Highlight on head
        bodyG.lineStyle(0);
        bodyG.beginFill(0xFFFFFF, 0.3);
        bodyG.drawCircle(-headR / 3, -bodyH - headR, headR / 3);
        bodyG.endFill();
    }

    drawLimbShape(graphics, x, y, w, h, angle, color, outline) {
        graphics.clear();
        graphics.position.set(x, y);
        graphics.rotation = angle;

        graphics.lineStyle(outline, 0x000000, 1, 0.5);
        graphics.beginFill(color);
        // Pivot is top center of limb: draw from ( -w/2, 0 )
        graphics.drawRoundedRect(-w / 2, 0, w, h, w / 2);
        graphics.endFill();
    }
}