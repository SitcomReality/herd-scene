import { FRAME_TYPES } from './ai/SequenceManager.js';
import { ANIMATION_STATES } from './constants.js';
import { Tutorial } from './Tutorial.js';
import { Timeline } from './ui/Timeline.js';
import { Inspector } from './ui/Inspector.js';

export class SandboxUI {
    constructor(game) {
        this.game = game;
        this.manager = game.sequenceManager;
        this.selectedFrameIndex = -1;
        this.showSettings = false;
        this.dragSourceIndex = null; // for timeline drag-and-drop reordering

        // Whether we are in "view received message" mode (loaded from shared URL)
        this.isShareView = !!this.game.wasLoadedFromShare;
        this.shareUiRestored = false;
        this.lastFrameIndex = -1;

        // Create UI Root
        this.root = document.createElement('div');
        this.root.id = 'ui-root';
        document.body.appendChild(this.root);

        this.render();
        this.bindEvents();

        // Apply initial stripped-down UI if we are in share view mode
        if (this.isShareView) {
            this.applyShareViewHidden(true);
            // Restore hidden UI after 15 seconds or earlier if the sequence completes one loop
            this.shareRestoreTimeout = setTimeout(() => {
                this.restoreShareViewUi();
            }, 15000);
        }

        // Start Tutorial (simplified or full depending on mode)
        this.tutorial = new Tutorial(this, { shareView: this.isShareView });

        // Create submodules
        this.timeline = new Timeline(this);
        this.inspector = new Inspector(this);

        // Subscribe to updates
        this.manager.subscribe(() => this.onSequenceUpdate());

        // Global keyboard shortcuts: U to toggle UI, Space to toggle Play/Stop
        this._keydownHandler = (e) => {
            // Ignore when typing into inputs/textareas/selects
            const active = document.activeElement;
            const tag = active && active.tagName ? active.tagName.toLowerCase() : null;
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || active?.isContentEditable) return;

            // Toggle UI visibility with "U" or "u"
            if (e.key === 'u' || e.key === 'U') {
                e.preventDefault();
                this.toggleUIVisibility();
            }

            // Toggle Play/Stop with Space (use code to be robust)
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.manager.isPlaying) {
                    this.manager.stop();
                } else {
                    this.manager.start();
                }
                // Ensure UI reflects new play state
                this.manager.emitChange();
            }
        };
        window.addEventListener('keydown', this._keydownHandler);
    }

    render() {
        this.root.innerHTML = `
            <div class="top-bar pointer-events-auto">
                <div class="toolbar-group">
                    <button class="btn" id="add-text-btn"><span style="font-weight:bold">T</span> Text</button>
                    <button class="btn" id="add-shape-btn"><span>★</span> Shape</button>
                    <button class="btn" id="add-wander-btn"><span>〰</span> Wander</button>
                </div>
                <div class="toolbar-group">
                    <button class="btn" id="share-btn">🔗 Share</button>
                    <button class="btn" id="settings-toggle">⚙️ Settings</button>
                </div>
            </div>

            <!-- Inspector Panel (Right) -->
            <div id="inspector" class="panel side-panel pointer-events-auto hidden">
                <div class="panel-header">
                    <span>Frame Properties</span>
                    <button class="btn btn-danger" style="padding:2px 6px; font-size:10px" id="delete-frame-btn">🗑</button>
                </div>
                <div id="inspector-content"></div>
            </div>

            <!-- Settings Panel (Right, overlaid) -->
            <div id="settings-panel" class="panel side-panel pointer-events-auto hidden" style="z-index: 10;">
                <div class="panel-header">
                    <span>Global Settings</span>
                    <button class="btn" style="padding:0 4px;" id="close-settings">✕</button>
                </div>
                <div class="form-group">
                    <label>Character Count: <span id="count-display">0</span></label>
                    <div style="display:flex; gap:5px">
                        <button class="btn" id="pop-add-10" style="flex:1">+10</button>
                        <button class="btn" id="pop-add-100" style="flex:1">+100</button>
                        <button class="btn" id="pop-clear" style="flex:1">Clear</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Scale</label>
                    <input type="range" id="scale-slider" min="0.5" max="3" step="0.1" value="1">
                </div>
                 <div class="form-group">
                    <label>AI Speed (Brain)</label>
                    <input type="range" id="brain-speed-slider" min="0.1" max="5" step="0.1" value="1">
                </div>
                <div class="form-group">
                    <label>Game Speed</label>
                    <input type="range" id="game-speed-slider" min="0.1" max="3" step="0.1" value="1">
                </div>
                <div class="form-group">
                     <button class="btn" id="randomize-colors">Randomize Colors</button>
                </div>
            </div>

            <div class="bottom-bar pointer-events-auto">
                <div class="playback-controls">
                    <button class="btn" id="play-btn">▶ Play</button>
                    <button class="btn" id="stop-btn">■ Stop</button>
                    <button class="btn" id="clear-seq-btn">Clear Timeline</button>
                </div>
                <div class="timeline-container" id="timeline">
                    <!-- Frames injected here -->
                </div>
            </div>
        `;

        this.timelineEl = this.root.querySelector('#timeline');
        this.inspectorEl = this.root.querySelector('#inspector');
        this.inspectorContentEl = this.root.querySelector('#inspector-content');
        this.settingsPanelEl = this.root.querySelector('#settings-panel');
        
        // Initial sync
        this.updateSettingsValues();
    }

    bindEvents() {
        // Toolbar
        this.byId('add-text-btn').onclick = () => this.manager.addFrame(FRAME_TYPES.TEXT, 'HELLO', 5);
        this.byId('add-shape-btn').onclick = () => this.manager.addFrame(FRAME_TYPES.SHAPE, 'HEART', 5);
        this.byId('add-wander-btn').onclick = () => this.manager.addFrame(FRAME_TYPES.WANDER, null, 5);
        
        this.byId('share-btn').onclick = () => {
             try {
                 // Get the game's full share URL, extract the encoded 's' param, and attach to fixed base.
                 const full = this.game.getShareLink();
                 const encoded = new URL(full).searchParams.get('s');
                 const shareUrl = `https://herd-scene.on.websim.com/?s=${encodeURIComponent(encoded)}`;
                 navigator.clipboard.writeText(shareUrl).then(() => {
                     alert("Timeline URL copied to clipboard!");
                 }).catch(err => {
                     console.error("Failed to copy", err);
                     prompt("Copy this URL manually:", shareUrl);
                 });
             } catch (err) {
                 console.error("Failed to build share URL", err);
                 alert("Unable to build share link.");
             }
        };

        // Playback
        this.byId('play-btn').onclick = () => this.manager.start();
        this.byId('stop-btn').onclick = () => this.manager.stop();
        this.byId('clear-seq-btn').onclick = () => this.manager.clearSequence();

        // Settings Toggle
        this.byId('settings-toggle').onclick = () => {
            this.showSettings = !this.showSettings;
            this.settingsPanelEl.classList.toggle('hidden', !this.showSettings);
            if(this.showSettings) this.inspectorEl.classList.add('hidden'); // Hide inspector if settings open
        };
        this.byId('close-settings').onclick = () => {
             this.showSettings = false;
             this.settingsPanelEl.classList.add('hidden');
        };

        // Inspector Actions
        this.byId('delete-frame-btn').onclick = () => {
            if (this.selectedFrameIndex > -1) {
                this.manager.removeFrame(this.selectedFrameIndex);
                this.selectedFrameIndex = -1;
                this.updateInspector();
            }
        };

        // Settings Actions
        this.byId('pop-add-10').onclick = () => this.populate(10);
        this.byId('pop-add-100').onclick = () => this.populate(100);
        this.byId('pop-clear').onclick = () => this.game.clearAll();
        this.byId('randomize-colors').onclick = () => this.game.randomizeAllColors();
        
        this.byId('scale-slider').oninput = (e) => {
            this.game.settings.globalScale = parseFloat(e.target.value);
        };
        
        // Wire the Game Speed slider to the game's globalSpeed setting so simulation scales properly
        const gameSpeedEl = this.byId('game-speed-slider');
        if (gameSpeedEl) {
            gameSpeedEl.oninput = (e) => {
                this.game.settings.globalSpeed = parseFloat(e.target.value);
            };
        }
    }

    // Hide or show creation/sharing UI for share-view mode
    applyShareViewHidden(hidden) {
        const idsToToggle = [
            'add-text-btn',
            'add-shape-btn',
            'add-wander-btn',
            'share-btn',
            'clear-seq-btn'
        ];
        idsToToggle.forEach(id => {
            const el = this.byId(id);
            if (el) {
                el.classList.toggle('hidden', hidden);
            }
        });

        // Timeline container
        const timeline = this.byId('timeline');
        if (timeline) {
            timeline.classList.toggle('hidden', hidden);
        }
    }

    restoreShareViewUi() {
        if (!this.isShareView || this.shareUiRestored) return;
        this.shareUiRestored = true;

        // Clear timeout if still pending
        if (this.shareRestoreTimeout) {
            clearTimeout(this.shareRestoreTimeout);
            this.shareRestoreTimeout = null;
        }

        // Reveal the full editing/sharing UI, but do NOT alter overall UI visibility (U toggle)
        this.applyShareViewHidden(false);
    }

    populate(count) {
        for(let i=0; i<count; i++) {
            this.game.addCharacter(
                Math.random() * (this.game.app.screen.width),
                Math.random() * (this.game.app.screen.height)
            );
        }
        this.updateSettingsValues();
    }

    updateSettingsValues() {
        this.byId('count-display').textContent = this.game.characters.length;
        
        // Sync sliders
        const speedSlider = this.byId('game-speed-slider');
        if (speedSlider) speedSlider.value = this.game.settings.globalSpeed;

        const scaleSlider = this.byId('scale-slider');
        if (scaleSlider) scaleSlider.value = this.game.settings.globalScale;
    }

    onSequenceUpdate() {
        // Detect first loop completion in share view:
        if (this.isShareView && !this.shareUiRestored) {
            const seqLen = this.manager.sequence.length;
            const idx = this.manager.currentFrameIndex;
            if (this.manager.isPlaying && seqLen > 0) {
                // Loop occurs when we move from last index to 0
                if (this.lastFrameIndex === seqLen - 1 && idx === 0) {
                    this.restoreShareViewUi();
                }
            }
            this.lastFrameIndex = idx;
        }

        // Delegate timeline rendering to Timeline module
        this.timeline.render();
        
        // Update Play/Pause button text state is handled by Timeline too (but keep backward-compatible hook)
        const playBtn = this.byId('play-btn');
        if (this.manager.isPlaying) {
            playBtn.textContent = '⏸ Pause';
            playBtn.onclick = () => { this.manager.isPlaying = false; this.manager.emitChange(); }; // Simple pause
            playBtn.classList.add('btn-primary');
        } else {
            playBtn.textContent = '▶ Play';
            playBtn.onclick = () => this.manager.start();
            playBtn.classList.remove('btn-primary');
        }

        // Also refresh inspector if selection changed externally
        this.updateInspector();
    }

    selectFrame(index) {
        this.selectedFrameIndex = index;
        this.showSettings = false;
        this.settingsPanelEl.classList.add('hidden');
        // Re-render timeline and inspector
        this.timeline.render();
        this.updateInspector();
    }

    updateInspector() {
        // Delegate inspector rendering and binding
        this.inspector.render();
    }

    // New helper to toggle UI visibility
    toggleUIVisibility() {
        // Toggle a 'hidden' class on the root to hide/show all UI elements
        this.root.classList.toggle('hidden');
        // Ensure settings/inspector panels are hidden when root is hidden
        if (this.root.classList.contains('hidden')) {
            this.settingsPanelEl?.classList.add('hidden');
            this.inspectorEl?.classList.add('hidden');
        } else {
            // restore settings panel state if needed
            if (this.showSettings) this.settingsPanelEl?.classList.remove('hidden');
        }
    }

    byId(id) {
        return this.root.querySelector('#' + id);
    }
}