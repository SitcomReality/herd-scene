import GUI from 'lil-gui'; 
import { ANIMATION_STATES } from './constants.js';
import { FRAME_TYPES } from './ai/SequenceManager.js';

export class SandboxUI {
    constructor(game) {
        this.game = game;
        this.gui = new GUI({ title: 'Sandbox Controls' });

        // Setup Params Object linked to GUI
        const params = {
            state: ANIMATION_STATES.WALK,
            speed: 1.0,
            scale: 1.0,
            addOne: () => game.addCharacter(
                Math.random() * (game.app.screen.width - 100) + 50,
                Math.random() * (game.app.screen.height - 100) + 50
            ),
            addTen: () => {
                for(let i=0; i<10; i++) params.addOne();
            },
            populateForText: () => {
                 // Helper to add enough chars for a decent resolution
                 const current = game.characters.length;
                 const target = 400;
                 if(current < target) {
                     for(let i=0; i<(target-current); i++) params.addOne();
                 }
            },
            removeOne: () => game.removeCharacters(1),
            clear: () => game.clearAll(),
            randomizeColors: () => game.randomizeAllColors(),
            count: 0, // Display only
            useAI: true, // Default to true now for sequence support
            
            // Sequence Params
            seqText: "HELLO",
            seqShape: "HEART",
            seqDuration: 5,
            addToSequence: () => {
                game.sequenceManager.addFrame(FRAME_TYPES.TEXT, params.seqText, params.seqDuration);
            },
            addShapeToSequence: () => {
                game.sequenceManager.addFrame(FRAME_TYPES.SHAPE, params.seqShape, params.seqDuration);
            },
            addWanderToSequence: () => {
                game.sequenceManager.addFrame(FRAME_TYPES.WANDER, null, params.seqDuration);
            },
            playSequence: () => {
                game.settings.useAI = true; // Ensure AI is on
                game.sequenceManager.start();
            },
            stopSequence: () => {
                game.sequenceManager.stop();
            },
            clearSequence: () => {
                game.sequenceManager.clearSequence();
            }
        };

        // --- Sequence Controls (New Primary Goal) ---
        const folderSeq = this.gui.addFolder('Sequence Designer');
        folderSeq.add(params, 'seqText').name('Text Input');
        folderSeq.add(params, 'seqDuration', 1, 20).name('Duration (s)');
        folderSeq.add(params, 'addToSequence').name('Add Text Frame');
        
        folderSeq.add(params, 'seqShape', ['HEART', 'STAR', 'CIRCLE']).name('Shape Type');
        folderSeq.add(params, 'addShapeToSequence').name('Add Shape Frame');

        folderSeq.add(params, 'addWanderToSequence').name('Add Wander Frame');
        folderSeq.add(params, 'playSequence').name('▶ Play Sequence');
        folderSeq.add(params, 'stopSequence').name('■ Stop');
        folderSeq.add(params, 'clearSequence').name('Clear Timeline');
        folderSeq.add(params, 'populateForText').name('Populate (400)');
        
        // --- Existing Controls ---
        const folderPop = this.gui.addFolder('Population');
        folderPop.add(params, 'addOne').name('Add Character');
        folderPop.add(params, 'addTen').name('Add 10');
        folderPop.add(params, 'removeOne').name('Remove 1');
        folderPop.add(params, 'clear').name('Remove All');        
        folderPop.add(game.settings, 'count').name('Count').listen().disable();

        // Appearance Controls
        const folderLook = this.gui.addFolder('Appearance');
        folderLook.add(params, 'scale', 0.5, 3.0).name('Scale').onChange(v => {
            game.settings.globalScale = v;
        });
        folderLook.add(params, 'randomizeColors').name('Randomize Colors');

        // Animation/AI Controls (Moved to bottom)
        const folderAnim = this.gui.addFolder('Manual / AI Settings');
        folderAnim.add(params, 'useAI').name('Enable AI').onChange(v => {
            game.settings.useAI = v;
        });
        folderAnim.add(params, 'state', Object.values(ANIMATION_STATES)).name('Action (Manual)').onChange(v => {
            game.settings.animationState = v;
        });
        folderAnim.add(params, 'speed', 0, 3).name('Speed (Manual)').onChange(v => {
            game.settings.globalSpeed = v;
        });
        params.rotation = 90; 
        folderAnim.add(params, 'rotation', 0, 360).name('Rotation (Manual)').onChange(v => {
            game.settings.globalRotation = v * (Math.PI / 180);
        });

        // Open relevant folders
        folderSeq.open();
        folderAnim.close(); // Collapse manual controls
    }
}