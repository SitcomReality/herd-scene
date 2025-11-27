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
        
        // Config font
        const fontSize = Math.min(width / (text.length * 0.7), height * 0.6);
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        
        ctx.fillText(text, width / 2, height / 2);

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