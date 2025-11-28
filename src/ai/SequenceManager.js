import { ShapeGenerator } from '../utils/ShapeGenerator.js';

export const FRAME_TYPES = {
    WANDER: 'WANDER',
    TEXT: 'TEXT',
    SHAPE: 'SHAPE'
};

export class SequenceManager {
    constructor(app, crowdManager) {
        this.app = app;
        this.crowdManager = crowdManager;
        this.sequence = []; // Array of frame objects
        this.currentFrameIndex = -1;
        this.frameTimer = 0;
        this.isPlaying = false;
        this.listeners = [];
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    emitChange() {
        this.listeners.forEach(cb => cb(this));
    }

    exportData() {
        return this.sequence.map(f => ({
            t: f.type,
            c: f.content,
            d: f.duration
        }));
    }

    importData(data) {
        this.clearSequence();
        if (Array.isArray(data)) {
            data.forEach(f => {
                this.addFrame(f.t, f.c, f.d);
            });
        }
    }

    addFrame(type, content, duration) {
        this.sequence.push({
            id: Math.random().toString(36).substr(2, 9),
            type,
            content, // Text string or other data
            duration
        });
        console.log(`Frame added: ${type} "${content}" (${duration}s)`);
        this.emitChange();
    }

    updateFrame(index, updates) {
        if (this.sequence[index]) {
            Object.assign(this.sequence[index], updates);
            // If we are currently playing this frame, we might want to re-apply it?
            // For now, simple update is fine.
            this.emitChange();
        }
    }

    removeFrame(index) {
        this.sequence.splice(index, 1);
        if (this.currentFrameIndex >= this.sequence.length) {
            this.currentFrameIndex = -1;
            this.stop();
        }
        this.emitChange();
    }

    clearSequence() {
        this.sequence = [];
        this.stop();
        this.emitChange();
    }

    start() {
        if (this.sequence.length === 0) return;
        this.currentFrameIndex = 0;
        this.frameTimer = 0;
        this.isPlaying = true;
        this.applyFrame(this.sequence[0]);
        this.emitChange();
    }

    stop() {
        this.isPlaying = false;
        this.currentFrameIndex = -1;
        this.crowdManager.setMode('WANDER');
        this.emitChange();
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
        this.emitChange();
    }

    applyFrame(frame) {
        console.log(`Applying frame: ${frame.type} - ${frame.content}`);
        const w = this.app.screen.width;
        const h = this.app.screen.height;
        const cx = w / 2;
        const cy = h / 2;

        if (frame.type === FRAME_TYPES.WANDER) {
            this.crowdManager.setMode('WANDER');
        } else if (frame.type === FRAME_TYPES.TEXT) {
            const points = ShapeGenerator.getTextPoints(
                frame.content, 
                this.app.screen.width, 
                this.app.screen.height
            );
            this.crowdManager.setMode('FORMATION', points);
        } else if (frame.type === FRAME_TYPES.SHAPE) {
            let points = [];
            const s = Math.min(w, h) / 3; // Base scale
            
            switch(frame.content) {
                case 'HEART':
                    // Heart math is small (-16 to 16), so we scale up significantly
                    points = ShapeGenerator.getHeartPoints(cx, cy, s / 15);
                    break;
                case 'STAR':
                    points = ShapeGenerator.getStarPoints(cx, cy, s, s * 0.4);
                    break;
                case 'CIRCLE':
                    points = ShapeGenerator.getCirclePoints(cx, cy, s * 0.8);
                    break;
                default:
                    points = ShapeGenerator.getCirclePoints(cx, cy, s);
            }
            this.crowdManager.setMode('FORMATION', points);
        }
    }
}