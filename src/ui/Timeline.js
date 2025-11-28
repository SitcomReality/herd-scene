import { FRAME_TYPES } from '../ai/SequenceManager.js';

export class Timeline {
    constructor(ui) {
        this.ui = ui;
        this.manager = ui.manager;
        this.root = ui.root;
        this.timelineEl = null;
    }

    render() {
        this.timelineEl = this.ui.byId('timeline');
        if (!this.timelineEl) return;

        // Full re-render of timeline (simple & robust for < 50 frames)
        this.timelineEl.innerHTML = '';

        this.manager.sequence.forEach((frame, index) => {
            const el = document.createElement('div');
            el.className = `timeline-frame ${index === this.manager.currentFrameIndex ? 'active' : ''} ${index === this.ui.selectedFrameIndex ? 'selected' : ''}`;
            el.setAttribute('draggable', 'true');

            let icon = '❓';
            let label = frame.content || '---';
            if(frame.type === FRAME_TYPES.TEXT) icon = '𝗧';
            if(frame.type === FRAME_TYPES.SHAPE) icon = '★';
            if(frame.type === FRAME_TYPES.WANDER) { icon = '〰'; label = 'Wander'; }
            if(frame.type === FRAME_TYPES.DRAW) { icon = '✏️'; label = 'Draw'; }

            el.innerHTML = `
                <div class="frame-icon">${icon}</div>
                <div class="frame-label">${label}</div>
                <div class="frame-duration">${frame.duration}s</div>
            `;

            el.onclick = () => {
                this.ui.selectFrame(index);
            };

            // Drag-and-drop reordering handlers
            el.addEventListener('dragstart', (e) => {
                this.ui.dragSourceIndex = index;
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    // Needed for Firefox
                    e.dataTransfer.setData('text/plain', String(index));
                }
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.ui.dragSourceIndex === null || this.ui.dragSourceIndex === index) return;

                const seq = this.manager.sequence;
                if (!seq || seq.length === 0) return;

                // Capture current active and selected frame IDs before mutation
                const activeIndex = this.manager.currentFrameIndex;
                const activeId = (activeIndex >= 0 && activeIndex < seq.length) ? seq[activeIndex].id : null;
                const selectedIndex = this.ui.selectedFrameIndex;
                const selectedId = (selectedIndex >= 0 && selectedIndex < seq.length) ? seq[selectedIndex].id : null;

                const from = this.ui.dragSourceIndex;
                const to = index;

                const [moved] = seq.splice(from, 1);
                // Adjust target index if removing an earlier element shifts indices
                const insertIndex = from < to ? to - 1 : to;
                seq.splice(insertIndex, 0, moved);

                // Recompute indices based on IDs so active/selected frames follow their data
                const findIndexById = (id) => id == null ? -1 : seq.findIndex(f => f.id === id);

                this.manager.currentFrameIndex = findIndexById(activeId);
                this.ui.selectedFrameIndex = findIndexById(selectedId);

                this.ui.dragSourceIndex = null;

                // Notify manager/UI of sequence change
                this.manager.emitChange();
            });

            el.addEventListener('dragend', () => {
                this.ui.dragSourceIndex = null;
            });

            this.timelineEl.appendChild(el);
        });
    }
}