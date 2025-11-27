import { ShapeGenerator } from '../utils/ShapeGenerator.js';

export const FRAME_TYPES = {
    WANDER: 'WANDER',
    TEXT: 'TEXT'
};

export class SequenceManager {
    constructor(app, crowdManager) {
        this.app = app;
        this.crowdManager = crowdManager;
        this.sequence = []; // Array of frame objects
        this.currentFrameIndex = -1;
        this.frameTimer = 0;
        this.isPlaying = false;
    }

    addFrame(type, content, duration) {
        this.sequence.push({
            type,
            content, // Text string or other data
            duration
        });
        console.log(`Frame added: ${type} "${content}" (${duration}s)`);
    }

    clearSequence() {
        this.sequence = [];
        this.stop();
    }

    start() {
        if (this.sequence.length === 0) return;
        this.currentFrameIndex = 0;
        this.frameTimer = 0;
        this.isPlaying = true;
        this.applyFrame(this.sequence[0]);
    }

    stop() {
        this.isPlaying = false;
        this.currentFrameIndex = -1;
        this.crowdManager.setMode('WANDER');
    }

    update(dt) {
        if (!this.isPlaying || this.currentFrameIndex === -1) return;

        this.frameTimer += dt;
        const currentFrame = this.sequence[this.currentFrameIndex];

        if (this.frameTimer >= currentFrame.duration) {
            this.nextFrame();
        }
    }

    nextFrame() {
        this.currentFrameIndex++;
        if (this.currentFrameIndex >= this.sequence.length) {
            // Loop or stop? Let's loop for now as it's more engaging
            this.currentFrameIndex = 0;
        }
        this.frameTimer = 0;
        this.applyFrame(this.sequence[this.currentFrameIndex]);
    }

    applyFrame(frame) {
        console.log(`Applying frame: ${frame.type} - ${frame.content}`);
        if (frame.type === FRAME_TYPES.WANDER) {
            this.crowdManager.setMode('WANDER');
        } else if (frame.type === FRAME_TYPES.TEXT) {
            const points = ShapeGenerator.getTextPoints(
                frame.content, 
                this.app.screen.width, 
                this.app.screen.height
            );
            this.crowdManager.setMode('FORMATION', points);
        }
    }
}