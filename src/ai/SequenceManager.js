import { ShapeGenerator } from '../utils/ShapeGenerator.js';

export const FRAME_TYPES = {
    WANDER: 'WANDER',
    TEXT: 'TEXT',
    SHAPE: 'SHAPE',
    DRAW: 'DRAW'
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

    // Encode a 16x16 monochrome bitmap (array of 0/1, length 256) into base64
    static encodeBitmapToBase64(pixels) {
        if (!Array.isArray(pixels)) return '';
        const bytes = new Uint8Array(32); // 256 bits / 8 = 32 bytes
        for (let i = 0; i < 256; i++) {
            const bit = pixels[i] ? 1 : 0;
            const byteIndex = i >> 3;
            const bitIndex = 7 - (i & 7); // pack MSB first
            if (bit) {
                bytes[byteIndex] |= (1 << bitIndex);
            }
        }
        let bin = '';
        for (let i = 0; i < bytes.length; i++) {
            bin += String.fromCharCode(bytes[i]);
        }
        return btoa(bin);
    }

    // Decode base64 into a 16x16 monochrome bitmap (array of 0/1, length 256)
    static decodeBitmapFromBase64(b64) {
        if (!b64) {
            return new Array(256).fill(0);
        }
        let bin;
        try {
            bin = atob(b64);
        } catch (e) {
            console.warn('Failed to decode DRAW bitmap base64, using empty bitmap.', e);
            return new Array(256).fill(0);
        }
        const pixels = new Array(256).fill(0);
        for (let i = 0; i < 32 && i < bin.length; i++) {
            const byte = bin.charCodeAt(i);
            for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
                const mask = 1 << (7 - bitIndex);
                const bit = (byte & mask) ? 1 : 0;
                const pixelIndex = (i << 3) + bitIndex;
                if (pixelIndex < 256) {
                    pixels[pixelIndex] = bit;
                }
            }
        }
        return pixels;
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
            c: f.type === FRAME_TYPES.DRAW
                ? SequenceManager.encodeBitmapToBase64(f.content)
                : f.content,
            d: f.duration
        }));
    }

    importData(data) {
        this.clearSequence();
        if (Array.isArray(data)) {
            data.forEach(f => {
                let content = f.c;
                if (f.t === FRAME_TYPES.DRAW) {
                    content = SequenceManager.decodeBitmapFromBase64(f.c);
                }
                this.addFrame(f.t, content, f.d);
            });
        }
    }

    addFrame(type, content, duration) {
        if (type === FRAME_TYPES.DRAW) {
            // Ensure we have a 16x16 bitmap array of 0/1
            if (!Array.isArray(content) || content.length !== 256) {
                content = new Array(256).fill(0);
            }
        }

        this.sequence.push({
            id: Math.random().toString(36).substr(2, 9),
            type,
            content, // Text string, shape type, or bitmap array for DRAW
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
        } else if (frame.type === FRAME_TYPES.DRAW) {
            const pixels = Array.isArray(frame.content) ? frame.content : [];
            const points = [];
            if (pixels.length === 256) {
                // Make the drawing much larger so it spans closer to the top/bottom of the viewport.
                // Previously: const size = Math.min(w, h) * 0.6;
                // Increase to occupy more vertical space while leaving a small margin.
                const marginFactor = 0.05; // 5% margin top/bottom
                const size = Math.min(w, h * (1 - marginFactor * 2)); // prioritize vertical fit
                const cell = size / 16;
                const startX = (w - size) / 2;
                const startY = (h - size) / 2;

                for (let y = 0; y < 16; y++) {
                    for (let x = 0; x < 16; x++) {
                        const idx = y * 16 + x;
                        if (pixels[idx]) {
                            const baseX = startX + x * cell + cell / 2;
                            const baseY = startY + y * cell + cell / 2;
                            points.push({
                                x: baseX + (Math.random() - 0.5) * cell * 0.8,
                                y: baseY + (Math.random() - 0.5) * cell * 0.8
                            });
                        }
                    }
                }
            }
            if (points.length > 0) {
                this.crowdManager.setMode('FORMATION', points);
            } else {
                // If no pixels are lit, just wander
                this.crowdManager.setMode('WANDER');
            }
        }
    }
}