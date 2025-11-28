import * as PIXI from 'pixi.js';
import { Character } from './Character.js';
import { SandboxUI } from './UI.js';
import { ANIMATION_STATES } from './constants.js';
import { CrowdManager } from './ai/CrowdManager.js';
import { SequenceManager, FRAME_TYPES } from './ai/SequenceManager.js';

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

        // Initialize UI
        this.ui = new SandboxUI(this);

        // Pre-populate Sequence
        this.sequenceManager.addFrame(FRAME_TYPES.TEXT, "SITCOM\nREALITY", 15);
        this.sequenceManager.addFrame(FRAME_TYPES.SHAPE, "HEART", 15);

        // Initial Population
        // Add enough to make a shape visible immediately?
        for(let i=0; i<400; i++) {
             this.addCharacter(
                 Math.random() * window.innerWidth, 
                 Math.random() * window.innerHeight
             );
        }

        // Event Listeners
        this.app.view.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        
        // Game Loop
        this.app.ticker.add((delta) => this.update(delta));
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