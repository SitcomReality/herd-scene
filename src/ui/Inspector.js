import { FRAME_TYPES } from '../ai/SequenceManager.js';

export class Inspector {
    constructor(ui) {
        this.ui = ui;
        this.manager = ui.manager;
        this.inspectorEl = ui.inspectorEl;
        this.inspectorContentEl = ui.inspectorContentEl;
    }

    render() {
        // Re-query elements in case UI re-rendered
        this.inspectorEl = this.ui.inspectorEl;
        this.inspectorContentEl = this.ui.inspectorContentEl;

        const frame = this.manager.sequence[this.ui.selectedFrameIndex];
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
        } else if (frame.type === FRAME_TYPES.DRAW) {
            contentInput = `
                <div class="form-group">
                    <label>Drawing (16×16)</label>
                    <div id="insp-draw-grid" style="display:grid;grid-template-columns:repeat(16,1fr);gap:2px;background:#222;padding:4px;border-radius:4px;border:1px solid #555;"></div>
                </div>
            `;
        } else {
            contentInput = `<div class="form-group"><label>Type</label><div class="badge">WANDER</div></div>`;
        }

        // Preserve focus if user is actively editing the content textarea.
        const active = document.activeElement;
        const isEditingContent = active && active.id === 'insp-content';

        if (isEditingContent && frame.type === FRAME_TYPES.TEXT) {
            // Don't replace the entire content while user is typing.
            // Only update the duration field if present.
            const durElExisting = this.inspectorContentEl.querySelector('#insp-duration');
            if (durElExisting) {
                durElExisting.value = frame.duration;
            }
        } else {
            // Safe to fully re-render inspector contents
            this.inspectorContentEl.innerHTML = `
                ${contentInput}
                <div class="form-group">
                    <label>Duration (seconds)</label>
                    <input type="number" id="insp-duration" value="${frame.duration}" step="0.5" min="0.5">
                </div>
            `;

            // Bind inputs for TEXT and SHAPE
            const contentEl = this.inspectorContentEl.querySelector('#insp-content');
            if (contentEl && frame.type !== FRAME_TYPES.DRAW) {
                // For textarea we want live updates; for select use change
                if (contentEl.tagName.toLowerCase() === 'textarea') {
                    contentEl.oninput = (e) => {
                        this.manager.updateFrame(this.ui.selectedFrameIndex, { content: e.target.value });
                    };
                } else {
                    contentEl.onchange = (e) => {
                        this.manager.updateFrame(this.ui.selectedFrameIndex, { content: e.target.value });
                    };
                }
            }

            // Bind DRAW grid
            if (frame.type === FRAME_TYPES.DRAW) {
                const grid = this.inspectorContentEl.querySelector('#insp-draw-grid');
                if (grid) {
                    // Ensure bitmap exists and is correct size
                    if (!Array.isArray(frame.content) || frame.content.length !== 256) {
                        frame.content = new Array(256).fill(0);
                    }
                    const pixels = frame.content;

                    grid.innerHTML = '';
                    for (let i = 0; i < 256; i++) {
                        const cell = document.createElement('div');
                        cell.style.width = '12px';
                        cell.style.height = '12px';
                        cell.style.borderRadius = '2px';
                        cell.style.boxSizing = 'border-box';
                        cell.style.cursor = 'pointer';
                        cell.style.border = '1px solid #444';
                        const setVisual = () => {
                            if (pixels[i]) {
                                cell.style.background = '#f4a261';
                            } else {
                                cell.style.background = 'transparent';
                            }
                        };
                        setVisual();
                        cell.onclick = () => {
                            pixels[i] = pixels[i] ? 0 : 1;
                            setVisual();
                            this.manager.updateFrame(this.ui.selectedFrameIndex, { content: pixels });
                        };
                        grid.appendChild(cell);
                    }
                }
            }

            const durEl = this.inspectorContentEl.querySelector('#insp-duration');
            if (durEl) {
                durEl.onchange = (e) => {
                    this.manager.updateFrame(this.ui.selectedFrameIndex, { duration: parseFloat(e.target.value) });
                };
            }
        }
    }
}