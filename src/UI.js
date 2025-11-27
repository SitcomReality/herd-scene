import { FRAME_TYPES } from './ai/SequenceManager.js';
import { ANIMATION_STATES } from './constants.js';

export class SandboxUI {
    constructor(game) {
        this.game = game;
        this.manager = game.sequenceManager;
        this.selectedFrameIndex = -1;
        this.showSettings = false;

        // Create UI Root
        this.root = document.createElement('div');
        this.root.id = 'ui-root';
        document.body.appendChild(this.root);

        this.render();
        this.bindEvents();

        // Subscribe to updates
        this.manager.subscribe(() => this.onSequenceUpdate());
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
        
        // Need to access NPC_PARAMS via import or if exposed on window. 
        // For now, let's assume we can modify them if we import them, but we can't easily import a live object from here 
        // unless we expose it in App. Let's assume App exposes it or we just skip detailed AI tuning for this pass.
        // Actually, we can hook into game.crowdManager if we want? 
        // Let's stick to valid scopes. We'll skip deep AI params in this iteration to ensure stability.
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
    }

    onSequenceUpdate() {
        // Full re-render of timeline (simple & robust for < 50 frames)
        this.timelineEl.innerHTML = '';
        
        this.manager.sequence.forEach((frame, index) => {
            const el = document.createElement('div');
            el.className = `timeline-frame ${index === this.manager.currentFrameIndex ? 'active' : ''} ${index === this.selectedFrameIndex ? 'selected' : ''}`;
            
            let icon = '❓';
            let label = frame.content || '---';
            if(frame.type === FRAME_TYPES.TEXT) icon = '𝗧';
            if(frame.type === FRAME_TYPES.SHAPE) icon = '★';
            if(frame.type === FRAME_TYPES.WANDER) { icon = '〰'; label = 'Wander'; }

            el.innerHTML = `
                <div class="frame-icon">${icon}</div>
                <div class="frame-label">${label}</div>
                <div class="frame-duration">${frame.duration}s</div>
            `;

            el.onclick = () => {
                this.selectedFrameIndex = index;
                this.showSettings = false;
                this.settingsPanelEl.classList.add('hidden');
                this.onSequenceUpdate(); // Re-render to show selection
                this.updateInspector();
            };

            this.timelineEl.appendChild(el);
        });

        // Update Play/Pause button text state
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
    }

    updateInspector() {
        const frame = this.manager.sequence[this.selectedFrameIndex];
        if (!frame) {
            this.inspectorEl.classList.add('hidden');
            return;
        }

        this.inspectorEl.classList.remove('hidden');
        
        let contentInput = '';
        if (frame.type === FRAME_TYPES.TEXT) {
            // Use a textarea to allow multiple lines
            contentInput = `
                <div class="form-group">
                    <label>Text (use Enter for new lines)</label>
                    <textarea id="insp-content" style="width:100%; height:80px; background:#333; color:#fff; border:1px solid #555; padding:6px; border-radius:4px;">${frame.content || ''}</textarea>
                </div>
            `;
        } else if (frame.type === FRAME_TYPES.SHAPE) {
            contentInput = `
                <div class="form-group">
                    <label>Shape</label>
                    <select id="insp-content">
                        <option value="HEART" ${frame.content==='HEART'?'selected':''}>Heart</option>
                        <option value="STAR" ${frame.content==='STAR'?'selected':''}>Star</option>
                        <option value="CIRCLE" ${frame.content==='CIRCLE'?'selected':''}>Circle</option>
                    </select>
                </div>
            `;
        } else {
            contentInput = `<div class="form-group"><label>Type</label><div class="badge">WANDER</div></div>`;
        }

        this.inspectorContentEl.innerHTML = `
            ${contentInput}
            <div class="form-group">
                <label>Duration (seconds)</label>
                <input type="number" id="insp-duration" value="${frame.duration}" step="0.5" min="0.5">
            </div>
        `;

        // Bind inputs
        const contentEl = this.inspectorContentEl.querySelector('#insp-content');
        if (contentEl) {
            // For textarea we want live updates; for select use change
            if (contentEl.tagName.toLowerCase() === 'textarea') {
                contentEl.oninput = (e) => {
                    this.manager.updateFrame(this.selectedFrameIndex, { content: e.target.value });
                };
            } else {
                contentEl.onchange = (e) => {
                    this.manager.updateFrame(this.selectedFrameIndex, { content: e.target.value });
                };
            }
        }

        const durEl = this.inspectorContentEl.querySelector('#insp-duration');
        if (durEl) {
            durEl.onchange = (e) => {
                this.manager.updateFrame(this.selectedFrameIndex, { duration: parseFloat(e.target.value) });
            };
        }
    }

    byId(id) {
        return this.root.querySelector('#' + id);
    }
}