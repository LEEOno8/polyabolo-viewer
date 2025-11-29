// --- Configuration ---
// Define all available datasets and their corresponding folder names
const DATASETS = {
    'Set 1 (Tangrams)': 'web_data',
    'Set 2 (Sei Shonagon chie-no-ita)': 'web_data_set2', // <--- Change this name if your new folder is different
    // Add more datasets here: 'Display Name': 'folder_name'
};
const SHAPES_PER_CHUNK = 100000; // Must match Python script setting
const DEFAULT_COLOR = "#cccccc";

// Rendering color configuration (translated from main2.py)
const TYPE_COLORS = {
    3: "#ff6b6b",  // BOTTOM_RIGHT
    6: "#f0e68c",  // TOP_RIGHT
    9: "#4ecdc4",  // BOTTOM_LEFT
    12: "#45b7d1", // TOP_LEFT
    15: "#a07d5c"  // SQUARE
};

let totalShapes = 0;
let activeDataFolder = DATASETS[Object.keys(DATASETS)[0]]; // Start with the first one

const canvas = document.getElementById('shapeCanvas');
const ctx = canvas.getContext('2d');
const totalShapesEl = document.getElementById('totalShapes');
const shapeIdInput = document.getElementById('shapeIdInput');
const messageEl = document.getElementById('message');
const datasetSelect = document.getElementById('datasetSelect');


/**
 * Initializes the dropdown and loads the first dataset metadata.
 */
function init() {
    // 1. Populate the Dataset Dropdown
    for (const name in DATASETS) {
        const option = document.createElement('option');
        option.value = DATASETS[name];
        option.textContent = name;
        datasetSelect.appendChild(option);
    }

    // Set initial active folder
    activeDataFolder = datasetSelect.value;

    // 2. Add Event Listeners
    datasetSelect.addEventListener('change', handleDatasetChange);
    document.getElementById('loadButton').addEventListener('click', loadAndDrawShape);
    shapeIdInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loadAndDrawShape();
        }
    });

    // 3. Load Metadata for the initial dataset
    loadMetadata();
}

/**
 * Handles the change of dataset selection.
 */
function handleDatasetChange(event) {
    activeDataFolder = event.target.value;
    loadMetadata();
}


/**
 * Loads the info.json for the currently active dataset.
 */
async function loadMetadata() {
    const infoUrl = `./${activeDataFolder}/info.json`;
    messageEl.textContent = 'Loading metadata...';

    try {
        const response = await fetch(infoUrl);
        if (!response.ok) {
             throw new Error(`Data folder '${activeDataFolder}' not found.`);
        }
        const info = await response.json();
        totalShapes = info.total_shapes;

        totalShapesEl.textContent = `Total Unique Shapes: ${totalShapes.toLocaleString()}`;
        shapeIdInput.max = totalShapes;
        messageEl.textContent = `Successfully loaded metadata for: ${activeDataFolder}. Enter an ID between 1 and ${totalShapes.toLocaleString()}.`;
        shapeIdInput.value = 1; // Reset to 1 for the new set
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas

    } catch (error) {
        messageEl.textContent = `Error: Could not load data info for ${activeDataFolder}. Please check the folder and file paths.`;
        totalShapes = 0;
        totalShapesEl.textContent = 'Total Unique Shapes: N/A';
        console.error("Metadata Loading Error:", error);
    }
}


/**
 * Core function: Finds the shape by ID and renders it.
 */
async function loadAndDrawShape() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    const shapeId = parseInt(shapeIdInput.value);

    if (totalShapes === 0) {
        messageEl.textContent = "Error: Cannot load. Metadata failed to load.";
        return;
    }

    if (isNaN(shapeId) || shapeId < 1 || shapeId > totalShapes) {
        messageEl.textContent = `Invalid ID. Please enter a number between 1 and ${totalShapes.toLocaleString()}.`;
        return;
    }

    messageEl.textContent = `Loading Shape #${shapeId.toLocaleString()}...`;

    // --- Lookup Logic: Calculate Chunk ID ---
    const chunkIndex = Math.ceil(shapeId / SHAPES_PER_CHUNK);
    const chunkUrl = `./${activeDataFolder}/chunks/chunk_${chunkIndex}.json`;

    try {
        // Step 1: Fetch the entire JSONL chunk file
        const response = await fetch(chunkUrl);
        if (!response.ok) {
            throw new Error(`Could not find chunk file ${chunkIndex}.`);
        }
        const jsonlText = await response.text();

        // Step 2: Parse JSONL data and find the target shape
        const lines = jsonlText.trim().split('\n');

        let targetShape = null;
        for (const line of lines) {
            if (line.trim()) {
                const shape = JSON.parse(line);
                if (shape.id === shapeId) {
                    targetShape = shape;
                    break;
                }
            }
        }

        if (targetShape) {
            drawShape(targetShape.blocks);
            messageEl.textContent = `Successfully displayed Shape #${shapeId.toLocaleString()} from ${activeDataFolder}.`;
        } else {
            messageEl.textContent = `Warning: ID #${shapeId} not found in chunk ${chunkIndex}.`;
        }

    } catch (error) {
        messageEl.textContent = `Data load failed: ${error.message}`;
        console.error("Load Error:", error);
    }
}

/**
 * Rendering function: Draws the shape block data onto the Canvas.
 */
function drawShape(blocks) {
    if (!blocks || blocks.length === 0) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Determine shape boundaries for scaling
    const minX = Math.min(...blocks.map(b => b.x));
    const maxX = Math.max(...blocks.map(b => b.x));
    const minY = Math.min(...blocks.map(b => b.y));
    const maxY = Math.max(...blocks.map(b => b.y));

    const shapeWidthUnits = maxX - minX + 1;
    const shapeHeightUnits = maxY - minY + 1;

    // Calculate scaling factor and offset
    const PADDING = 20;
    const scaleX = (canvasWidth - PADDING) / shapeWidthUnits;
    const scaleY = (canvasHeight - PADDING) / shapeHeightUnits;
    const scaleFactor = Math.min(scaleX, scaleY);

    const shapeWidthPixels = shapeWidthUnits * scaleFactor;
    const shapeHeightPixels = shapeHeightUnits * scaleFactor;

    // Centering offset
    const offsetX = (canvasWidth - shapeWidthPixels) / 2 - minX * scaleFactor;
    const offsetY = (canvasHeight - shapeHeightPixels) / 2 - minY * scaleFactor;

    ctx.lineWidth = 1;

    for (const block of blocks) {
        const { x, y, type } = block;

        // Pixel coordinates for the unit square
        const x0 = x * scaleFactor + offsetX;
        const y0 = y * scaleFactor + offsetY;
        const x1 = x0 + scaleFactor;
        const y1 = y0 + scaleFactor;

        const color = TYPE_COLORS[type] || DEFAULT_COLOR;

        let points = [];
        ctx.beginPath();

        // Define points for triangles/squares based on type (consistent with main2.py)
        if (type === 3) { // BOTTOM_RIGHT
            points = [[x0, y1], [x1, y1], [x1, y0]];
        } else if (type === 6) { // TOP_RIGHT
            points = [[x0, y0], [x1, y0], [x1, y1]];
        } else if (type === 9) { // BOTTOM_LEFT
            points = [[x0, y0], [x0, y1], [x1, y1]];
        } else if (type === 12) { // TOP_LEFT
            points = [[x0, y0], [x1, y0], [x0, y1]];
        } else if (type === 15) { // SQUARE
            points = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        }

        if (points.length > 0) {
            ctx.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i][0], points[i][1]);
            }
            ctx.closePath();

            ctx.fillStyle = color;
            ctx.strokeStyle = "black";

            ctx.fill();
            ctx.stroke();
        }
    }
}

// --- Event Binding ---
window.onload = init;