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

            // Bind inputs
            const contentEl = this.inspectorContentEl.querySelector('#insp-content');
            if (contentEl) {
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

            const durEl = this.inspectorContentEl.querySelector('#insp-duration');
            if (durEl) {
                durEl.onchange = (e) => {
                    this.manager.updateFrame(this.ui.selectedFrameIndex, { duration: parseFloat(e.target.value) });
                };
            }
        }
    }
}