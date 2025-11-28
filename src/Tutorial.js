export class Tutorial {
    constructor(ui, options = {}) {
        this.ui = ui;
        this.currentStep = 0;
        this.isActive = true;
        this.isShareView = !!options.shareView;
        
        if (this.isShareView) {
            // Simplified tutorial for "view received message" experience
            this.steps = [
                {
                    title: "You've received a scene.",
                    text: "Someone sent you this crowd scene to watch. Use the controls below to play or pause it.",
                    target: '.playback-controls'
                },
                {
                    title: "Hide the interface",
                    text: "Press 'U' to hide or show the UI anytime so you can just watch the scene.",
                    target: null
                }
            ];
        } else {
            this.steps = [
                {
                    title: "Welcome!",
                    text: "Herd Scene lets you choreograph crowd simulations using a timeline of events. This quick tour will show you the basics.",
                    target: null
                },
                {
                    title: "Create Frames",
                    text: "Start by adding new frames to your timeline using these buttons. You can add Text, Shapes, or tell the crowd to Wander.",
                    target: '.toolbar-group' // First group
                },
                {
                    title: "The Timeline",
                    text: "Your frames appear here in sequence. You can drag and drop them to reorder the sequence.",
                    target: '#timeline'
                },
                {
                    title: "Edit & Delete",
                    text: "Click any frame to select it. The Inspector panel will appear, letting you change text, shape type, duration, or delete the frame.",
                    target: '#inspector',
                    onStart: () => {
                        // Try to select the first frame so the inspector actually appears
                        if (this.ui.manager.sequence.length > 0) {
                            this.ui.selectFrame(0);
                        }
                    }
                },
                {
                    title: "Playback Control",
                    text: "Use these controls to Play or Stop the simulation. 'Clear Timeline' removes all frames.",
                    target: '.playback-controls'
                },
                {
                    title: "Shortcuts",
                    text: "• Press 'U' to hide/show the UI for a clean view.\n• Press 'Space' to toggle Play/Stop at any time.",
                    target: null
                }
            ];
        }

        // Create Elements
        this.el = document.createElement('div');
        this.el.className = 'tutorial-card';
        document.body.appendChild(this.el);

        this.indicator = document.createElement('div');
        this.indicator.className = 'tutorial-indicator hidden';
        document.body.appendChild(this.indicator);

        // Bind resize
        this.boundUpdate = () => this.updatePosition();
        window.addEventListener('resize', this.boundUpdate);

        this.renderStep();
    }

    renderStep() {
        if (!this.isActive) return;
        const step = this.steps[this.currentStep];
        
        if (step.onStart) step.onStart();

        this.el.innerHTML = `
            <h3>${step.title}</h3>
            <p>${step.text.replace(/\\n/g, '<br>')}</p>
            <div class="tutorial-actions">
                <button class="tutorial-btn" id="tut-skip">Skip</button>
                <button class="tutorial-btn primary" id="tut-next">
                    ${this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next'}
                </button>
            </div>
        `;

        this.el.querySelector('#tut-skip').onclick = () => this.close();
        this.el.querySelector('#tut-next').onclick = () => this.next();

        this.updatePosition();
    }

    updatePosition() {
        if (!this.isActive) return;
        const step = this.steps[this.currentStep];
        
        // Hide indicator by default
        this.indicator.classList.add('hidden');
        
        // If target exists, position relative to it
        if (step.target) {
            const targetEl = document.querySelector(step.target);
            if (targetEl && !targetEl.classList.contains('hidden')) {
                const rect = targetEl.getBoundingClientRect();
                
                // Show indicator around target
                this.indicator.classList.remove('hidden');
                this.indicator.style.top = rect.top + 'px';
                this.indicator.style.left = rect.left + 'px';
                this.indicator.style.width = rect.width + 'px';
                this.indicator.style.height = rect.height + 'px';

                // Position card
                // Default: below target
                let top = rect.bottom + 12;
                let left = rect.left;
                
                // Check bounds
                const cardW = 280;
                const cardH = 200; // approx max

                // If goes off bottom, put on top
                if (top + cardH > window.innerHeight) {
                    top = rect.top - cardH + 40; // Overlap slightly or just above
                }
                
                // If goes off right, clamp
                if (left + cardW > window.innerWidth) {
                    left = window.innerWidth - cardW - 10;
                }
                // If goes off left
                if (left < 10) left = 10;

                this.el.style.top = top + 'px';
                this.el.style.left = left + 'px';
                this.el.style.transform = 'none';
                return;
            }
        }
        
        // Default: Center Screen
        this.el.style.top = '50%';
        this.el.style.left = '50%';
        this.el.style.transform = 'translate(-50%, -50%)';
    }

    next() {
        this.currentStep++;
        if (this.currentStep >= this.steps.length) {
            this.close();
        } else {
            this.renderStep();
        }
    }

    close() {
        this.isActive = false;
        if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
        if (this.indicator.parentNode) this.indicator.parentNode.removeChild(this.indicator);
        window.removeEventListener('resize', this.boundUpdate);
    }
}