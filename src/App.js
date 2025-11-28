import * as PIXI from 'pixi.js';
import { Character } from './Character.js';
import { SandboxUI } from './UI.js';
import { ANIMATION_STATES } from './constants.js';
import { CrowdManager } from './ai/CrowdManager.js';
import { SequenceManager, FRAME_TYPES } from './ai/SequenceManager.js';

// Unicode-safe Base64 helpers
function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    }));
}

function b64DecodeUnicode(str) {
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

class GameApp {
    constructor() {
        // Ensure window title matches the app name
        document.title = 'Herd Scene';
        this.characters = [];
        
        // Setup Pixi
        this.app = new PIXI.Application({
            resizeTo: window,
            backgroundColor: 0xdddddd,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        document.body.appendChild(this.app.view);

        // Containers (Layers)
        this.shadowLayer = new PIXI.Container();
        this.characterLayer = new PIXI.Container();
        
        // Z-Index sorting enabled
        this.characterLayer.sortableChildren = true;

        this.app.stage.addChild(this.shadowLayer);
        this.app.stage.addChild(this.characterLayer);

        // AI & Sequence Systems
        this.crowdManager = new CrowdManager(this.app);
        this.sequenceManager = new SequenceManager(this.app, this.crowdManager);

        // Sandbox Settings
        this.settings = {
            count: 0,
            useAI: true, // Default to true so SequenceManager works out of box
            animationState: ANIMATION_STATES.WALK,
            globalSpeed: 1.0,
            globalScale: 1.0,
            globalRotation: Math.PI / 2, // Default side view
        };

        // Flag to indicate if we loaded from a shared URL
        this.wasLoadedFromShare = false;

        // Initialization Logic
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('s');

        if (encodedData) {
            try {
                const json = b64DecodeUnicode(encodedData);
                const data = JSON.parse(json);
                this.initFromData(data);
            } catch (e) {
                console.error("Failed to load sequence from URL", e);
                this.initDefault();
            }
        } else {
            this.initDefault();
        }

        // Initialize UI after data has been loaded (so it can adapt to share mode)
        this.ui = new SandboxUI(this);
        // Ensure UI reflects loaded settings
        this.ui.updateSettingsValues();

        // Event Listeners
        this.app.view.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        
        // Game Loop
        this.app.ticker.add((delta) => this.update(delta));
    }

    initDefault() {
        // Pre-populate Sequence
        this.sequenceManager.addFrame(FRAME_TYPES.TEXT, "SITCOM\nREALITY", 15);
        this.sequenceManager.addFrame(FRAME_TYPES.SHAPE, "HEART", 15);
        this.populate(400);
    }

    initFromData(data) {
        // Mark that we came from a shared link
        this.wasLoadedFromShare = true;

        // Apply settings
        if (typeof data.s === 'number') {
            this.settings.globalSpeed = data.s;
        }
        
        // Apply Sequence
        if (data.q && Array.isArray(data.q)) {
            this.sequenceManager.importData(data.q);
        }

        // Apply Population (Clamp to reasonable limits)
        let count = typeof data.c === 'number' ? data.c : 400;
        count = Math.max(0, Math.min(count, 3000));
        this.populate(count);

        // Auto-start playback so the received message begins immediately
        if (this.sequenceManager.sequence.length > 0) {
            this.sequenceManager.start();
        }
    }

    populate(count) {
        for(let i=0; i<count; i++) {
             this.addCharacter(
                 Math.random() * window.innerWidth, 
                 Math.random() * window.innerHeight
             );
        }
    }

    getShareLink() {
        const state = {
            c: this.characters.length,
            s: this.settings.globalSpeed,
            q: this.sequenceManager.exportData()
        };
        const json = JSON.stringify(state);
        const b64 = b64EncodeUnicode(json);
        
        const url = new URL(window.location.href);
        url.searchParams.set('s', b64);
        return url.toString();
    }

    addCharacter(x, y) {
        // Clamp to screen bounds slightly
        const padding = 50;
        const cx = Math.max(padding, Math.min(this.app.screen.width - padding, x));
        const cy = Math.max(padding, Math.min(this.app.screen.height - padding, y));

        const char = new Character(cx, cy);
        
        // Apply current settings
        char.scale = this.settings.globalScale;
        
        this.characters.push(char);
        this.crowdManager.register(char);

        this.characterLayer.addChild(char.graphics);
        this.shadowLayer.addChild(char.shadow);
        
        // Ensure initial zIndex exists so sortChildren can use it
        char.graphics.zIndex = char.groundY || char.y;

        this.settings.count = this.characters.length;
    }

    removeCharacters(amount) {
        for(let i=0; i<amount; i++) {
            if(this.characters.length === 0) break;
            const char = this.characters.pop();
            
            this.crowdManager.unregister(char);

            this.characterLayer.removeChild(char.graphics);
            this.shadowLayer.removeChild(char.shadow);
            char.destroy();
        }
        this.settings.count = this.characters.length;
    }

    clearAll() {
        this.removeCharacters(this.characters.length);
    }

    randomizeAllColors() {
        this.characters.forEach(char => {
            char.colors = char.getRandomPalette();
        });
    }

    onPointerDown(e) {
        // Only add if not interacting with UI (simplified check)
        // If clicking on canvas, add a character
        this.addCharacter(e.clientX, e.clientY);
    }

    update(delta) {
        // Convert ticker delta (frames) to seconds for consistent timing across systems
        const dtSeconds = delta / 60;

        // Sequence Manager Update
        this.sequenceManager.update(dtSeconds);

        // AI Update
        // Compute simulation delta scaled by globalSpeed so movement & animation speed follow the Game Speed slider
        const simDt = dtSeconds * this.settings.globalSpeed;

        if (this.settings.useAI) {
            this.crowdManager.update(simDt);
        }

        // Sort by Y for simple depth effect
        // Only sort every 10 frames to save perf if we have many characters
        // Update characters and publish each character's graphics.zIndex from renderer-provided groundY,
        // then use Pixi's sortChildren to order by zIndex (ground-level).
        // We throttle sortChildren to every ~10 frames for perf.
        const shouldSort = Math.floor(this.app.ticker.lastTime / (1000 / 60)) % 10 === 0;

        this.characters.forEach(char => {
            // Apply Global settings dynamically ONLY if AI is disabled
            // If AI is enabled, the AI Controller handles state/speed/facing logic
            
            if (!this.settings.useAI) {
                // Manual Override Mode
                char.facing = this.settings.globalRotation;
                char.state = this.settings.animationState;
                // Note: Animation module uses char.speed. 
                // We'll map globalSpeed (0..3) to a reasonable animation speed (0.1 base)
                // Actually CharacterAnimation logic multiplies char.speed * globalSpeed arg.
                // But now we moved to char.update(delta).
                // So we set char.speed to match what the animation module expects.
                char.speed = 0.1 * this.settings.globalSpeed;
            } 
            
            // Always apply scale globally for now (or could be individual)
            char.scale = this.settings.globalScale;

            // Pass seconds to character update (animations expect time in seconds)
            // Use simDt so character movement & animation follow Game Speed, while timeline remains real-time
            char.update(simDt);

            // Use the renderer-computed groundY as zIndex so sorting respects 'shadow height'.
            // Fallback to character y if groundY is not yet available.
            char.graphics.zIndex = typeof char.groundY === 'number' ? char.groundY : char.y;
        });

        if (shouldSort) {
            this.characterLayer.sortChildren();
        }
    }
}

// Start app
new GameApp();