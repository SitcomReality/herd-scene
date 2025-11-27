export class ShapeGenerator {
    /**
     * Generates a list of {x, y} points representing the text.
     * @param {string} text - The text to render.
     * @param {number} width - screen width.
     * @param {number} height - screen height.
     * @param {number} density - approximate pixels between points.
     */
    static getTextPoints(text, width, height, density = 20) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Fill background white, text black (or check alpha)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Support multiline text: split on newlines and trim empty lines
        const lines = (text || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const safeLines = lines.length > 0 ? lines : ['']; // ensure at least one line

        // Choose font size to fit horizontally and vertically.
        // Compute max font size that fits width per character and also fits total height given number of lines.
        // Start with a width-based estimate and clamp by height-based estimate.
        // Use a conservative per-character estimate (0.7 * fontSize per char width)
        const avgChars = Math.max(...safeLines.map(l => l.length), 1);
        const widthBased = Math.floor(width / (Math.max(avgChars, 1) * 0.7));
        const heightBased = Math.floor((height * 0.8) / safeLines.length); // leave some padding
        const fontSize = Math.max(8, Math.min(widthBased, heightBased));

        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';

        // Vertical layout: center the block of lines in the canvas
        const lineHeight = fontSize * 1.05;
        const blockHeight = lineHeight * safeLines.length;
        const startY = (height / 2) - (blockHeight / 2) + (lineHeight / 2);

        for (let i = 0; i < safeLines.length; i++) {
            ctx.fillText(safeLines[i], width / 2, startY + i * lineHeight);
        }

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const points = [];

        // Scan grid
        // We scan with 'density' step
        for (let y = 0; y < height; y += density) {
            for (let x = 0; x < width; x += density) {
                const i = (y * width + x) * 4;
                // Check Red channel (since we drew white on black)
                if (data[i] > 128) { 
                    // Add some jitter so they aren't in a perfect grid
                    points.push({
                        x: x + (Math.random() - 0.5) * (density * 0.5),
                        y: y + (Math.random() - 0.5) * (density * 0.5)
                    });
                }
            }
        }
        
        // NOTE: Do not shuffle points here.
        // Keeping a stable point order allows us to deterministically
        // distribute a smaller number of NPCs across the full shape
        // inside the CrowdManager target assignment logic.

        return points;
    }

    static getHeartPoints(centerX, centerY, scale, density = 12) {
        return this.getShapeFromCanvas(centerX * 2 + 100, centerY * 2 + 100, (ctx, w, h) => {
             ctx.translate(w/2, h/2);
             ctx.scale(scale, -scale); // Flip Y
             
             ctx.beginPath();
             // Heart Parametric Equation
             const res = 0.1;
             for (let t = -Math.PI; t <= Math.PI; t += res) {
                 const x = 16 * Math.pow(Math.sin(t), 3);
                 const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
                 if(t===-Math.PI) ctx.moveTo(x, y);
                 else ctx.lineTo(x, y);
             }
             ctx.closePath();
             ctx.fillStyle = '#ffffff';
             ctx.fill();
        }, density);
    }
    
    static getStarPoints(centerX, centerY, outerRadius, innerRadius, density = 12) {
        return this.getShapeFromCanvas(centerX * 2 + 100, centerY * 2 + 100, (ctx, w, h) => {
            ctx.translate(w/2, h/2);
            ctx.beginPath();
            const spikes = 5;
            const step = Math.PI / spikes;
            let rot = Math.PI / 2 * 3;
            let x, y;
            
            ctx.moveTo(0, -outerRadius);
            for (let i = 0; i < spikes; i++) {
                x = Math.cos(rot) * outerRadius;
                y = Math.sin(rot) * outerRadius;
                ctx.lineTo(x, y);
                rot += step;

                x = Math.cos(rot) * innerRadius;
                y = Math.sin(rot) * innerRadius;
                ctx.lineTo(x, y);
                rot += step;
            }
            ctx.lineTo(0, -outerRadius);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }, density);
    }

    static getCirclePoints(centerX, centerY, radius, density = 12) {
        return this.getShapeFromCanvas(centerX * 2 + 100, centerY * 2 + 100, (ctx, w, h) => {
            ctx.translate(w/2, h/2);
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }, density);
    }

    static getShapeFromCanvas(width, height, drawFn, density) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        drawFn(ctx, width, height);
        
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const points = [];
        
        // Scan with density step
        for (let y = 0; y < height; y += density) {
            for (let x = 0; x < width; x += density) {
                const i = (y * width + x) * 4;
                if (data[i] > 128) {
                    points.push({
                         x: x + (Math.random() - 0.5) * (density * 0.4),
                         y: y + (Math.random() - 0.5) * (density * 0.4)
                    });
                }
            }
        }
        return points;
    }

    static getRectanglePoints(width, height, count) {
        // Example placeholder for geometric shapes
        const points = [];
        const cols = Math.ceil(Math.sqrt(count * (width/height)));
        const rows = Math.ceil(count / cols);
        const spaceX = width * 0.5 / cols;
        const spaceY = height * 0.5 / rows;
        const startX = width * 0.25;
        const startY = height * 0.25;

        for(let i=0; i<count; i++) {
            const r = Math.floor(i / cols);
            const c = i % cols;
            points.push({
                x: startX + c * spaceX,
                y: startY + r * spaceY
            });
        }
        return points;
    }
}