/**
 * @file Main application logic for the Sense Bengaluru dashboard.
 * @author Arpan Mondal
 * 
 * This script handles:
 * - Fetching and processing data from a JSON source.
 * - Managing UI interactions (card expansion/collapse).
 * - Driving the data visualizations for each module (Weather, AQI, Traffic, etc.).
 * - Initializing and controlling p5.js sketches for canvas-based animations.
 */

// --- GLOBAL STATE & CONSTANTS ---

// Holds the data fetched from the JSON file.
let MOCK_DATA = {};

// DOM element references
const cards = document.querySelectorAll(".card");
const closeBtn = document.getElementById("close-btn");
const geigerAudio = document.getElementById("geiger-audio");

// State variables to manage UI and animations.
let activeCardId = null;
let geigerTimeout = null;
let aqiP5, metroP5; // p5.js instance holders


// --- INITIALIZATION ---

/**
 * Initializes the dashboard. Fetches data, sets up p5 sketches, and populates initial values.
 */
async function initDashboard() {
    try {
        // Append a timestamp to the data file URL to prevent browser caching.
        const timestamp = new Date().getTime();
        const response = await fetch(`data.json?t=${timestamp}`);
        MOCK_DATA = await response.json();
        console.log("Dashboard data loaded successfully:", MOCK_DATA);

        // Initialize p5 sketches for the AQI and Metro modules.
        aqiP5 = new p5(aqiSketch);
        metroP5 = new p5(metroSketch);

        // Populate static data points on the dashboard.
        document.getElementById("aqi-val").innerText = MOCK_DATA.aqi;
        document.getElementById("temp-val").innerText = MOCK_DATA.weather?.temp || "--";
        updateLastUpdatedTimestamp();

    } catch (error) {
        console.error("Failed to fetch primary data. Using fallback data.", error);
        loadFallbackData();
        aqiP5 = new p5(aqiSketch);
        metroP5 = new p5(metroSketch);
    }
}

/**
 * Populates the dashboard with hardcoded data if the initial fetch fails.
 */
function loadFallbackData() {
    MOCK_DATA = {
        weather: { temp: 24, condition: "sunny" },
        aqi: 160,
        traffic: { speed_kmh: 25 },
        metro_density: "medium",
        news_sentiment: 0.7,
        flight_count: 8
    };
}

/**
 * Formats and displays the "last updated" timestamp from the data.
 */
function updateLastUpdatedTimestamp() {
    const lastUpdatedEl = document.getElementById("last-updated");
    if (MOCK_DATA.last_updated && lastUpdatedEl) {
        const dt = new Date(MOCK_DATA.last_updated);
        const formatted = dt.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
        lastUpdatedEl.textContent = `Last updated: ${formatted}`;
    }
}


// --- EVENT HANDLING ---

// Add click listeners to each card to handle expansion.
cards.forEach(card => {
    card.addEventListener("click", () => {
        // Prevent opening a new card if one is already active.
        if (activeCardId) return;

        activeCardId = card.id;
        card.classList.add("expanded");
        closeBtn.classList.add("visible");
        
        // A short delay allows the card expansion animation to start before running heavy logic.
        setTimeout(() => {
            // Special handling for p5 canvases that need resizing.
            if (card.id === 'card-metro' && metroP5) {
                metroP5.resizeCanvas(window.innerWidth, window.innerHeight);
            }
            runModuleLogic(activeCardId);
        }, 150);
    });
});

// Add a click listener to the close button to collapse the active card.
closeBtn.addEventListener("click", () => {
    if (!activeCardId) return;

    document.getElementById(activeCardId).classList.remove("expanded");
    closeBtn.classList.remove("visible");
    stopModuleLogic(activeCardId);
    activeCardId = null; // Reset state
});


// --- MODULE-SPECIFIC LOGIC ---

/**
 * Routes to the correct function to start a module's visualization.
 * @param {string} id - The ID of the card to activate.
 */
function runModuleLogic(id) {
    switch (id) {
        case 'card-traffic':
            updateTraffic();
            break;
        case 'card-news':
            updateNews(true); // `true` to start the sound
            break;
        case 'card-radar':
            updateRadar();
            break;
        case 'card-weather':
            updateWeather();
            break;
        case 'card-aqi':
            if (aqiP5) aqiP5.loop(); // Start p5 draw loop
            break;
        case 'card-metro':
            if (metroP5) metroP5.loop(); // Start p5 draw loop
            break;
    }
}

/**
 * Stops any ongoing animations or sounds for a given module.
 * @param {string} id - The ID of the card to deactivate.
 */
function stopModuleLogic(id) {
    // Stop Geiger counter sound for the news module.
    if (id === 'card-news') {
        if (geigerTimeout) clearTimeout(geigerTimeout);
        geigerAudio.pause();
        geigerAudio.currentTime = 0;
    }
    // Stop p5 draw loops for canvas-based modules.
    if (id === 'card-aqi' && aqiP5) aqiP5.noLoop();
    if (id === 'card-metro' && metroP5) metroP5.noLoop();
}

/**
 * Updates the traffic speedometer needle based on traffic speed.
 */
function updateTraffic() {
    const speed = MOCK_DATA.traffic?.speed_kmh || 0;
    const needle = document.getElementById("traffic-needle");
    // Map speed (0-120km/h) to an angle (-90 to 90 degrees).
    let angle = (speed / 120) * 180 - 90;
    angle = Math.max(-90, Math.min(90, angle)); // Clamp angle
    
    needle.style.setProperty('--speed-angle', `${angle}deg`);
    needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    
    // Add a jittering effect for visual feedback if speed is above a threshold.
    if (speed > 5) needle.classList.add("jittering");
    else needle.classList.remove("jittering");
}

/**
 * Manages the Geiger counter sound effect.
 * @param {number} delay - The interval between clicks.
 */
function playGeigerRecursive(delay) {
    geigerAudio.currentTime = 0;
    geigerAudio.play().catch(() => {}); // Play sound, ignore potential errors.
    geigerTimeout = setTimeout(() => playGeigerRecursive(delay), delay);
}

/**
 * Updates the news sentiment Geiger counter visualization.
 * @param {boolean} playSound - Whether to start the clicking sound.
 */
function updateNews(playSound) {
    const sentiment = MOCK_DATA.news_sentiment || 0;
    const needle = document.getElementById("news-needle");
    // Map sentiment (0-1) to an angle.
    let angle = (sentiment * 90) - 45;
    
    needle.style.setProperty('--curr-angle', `${angle}deg`);
    needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;

    if (playSound) {
        if (geigerTimeout) clearTimeout(geigerTimeout);
        if (sentiment < 0.1) {
            needle.classList.remove("vibrating");
        } else {
            // Increase click frequency as sentiment gets more chaotic (closer to 1).
            const delay = 1500 - ((sentiment - 0.1) / 0.9) * 1400;
            playGeigerRecursive(delay);
            needle.classList.add("vibrating");
        }
    }
}

/**
 * Generates and displays random dots ("blips") on the flight radar.
 */
function updateRadar() {
    const count = MOCK_DATA.flight_count || 0;
    const layer = document.getElementById("radar-dots-layer");
    layer.innerHTML = ""; // Clear previous blips

    for (let i = 0; i < count; i++) {
        const dot = document.createElement("div");
        dot.className = "blip";
        // Randomize blip positions within the radar circle.
        dot.style.top = (20 + Math.random() * 60) + "%";
        dot.style.left = (20 + Math.random() * 60) + "%";
        layer.appendChild(dot);
    }
    document.getElementById("flight-val").innerText = count;
}

/**
 * Updates the weather mascot GIF based on the weather condition.
 */
function updateWeather() {
    const condition = MOCK_DATA.weather?.condition || "sunny";
    document.getElementById("weather-mascot").src = `assets/weather_${condition}.gif`;
}


// --- P5.JS SKETCHES ---

/**
 * p5.js sketch for the AQI visualization (Conway's Game of Life).
 * Cell survival is inversely related to the AQI value.
 */
const aqiSketch = (p) => {
    let grid, cols, rows;
    const resolution = 8; // Pixel size of each cell

    p.setup = () => {
        const size = Math.min(window.innerWidth * 0.6, 600);
        let c = p.createCanvas(size, size);
        c.parent("canvas-aqi");
        p.frameRate(6);
        cols = Math.floor(p.width / resolution);
        rows = Math.floor(p.height / resolution);
        
        // Initialize grid based on AQI
        grid = make2DArray(cols, rows);
        const aqi = MOCK_DATA.aqi || 50;
        let density = 0.4; // Initial population density
        if (aqi > 100) density = 0.25;
        if (aqi > 150) density = 0.12;
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                grid[i][j] = p.random(1) < density ? 1 : 0;
            }
        }
        p.noLoop(); // Start paused
    };

    p.draw = () => {
        p.clear(); // Use transparent background
        p.fill(50);
        p.noStroke();

        // Display living cells
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                if (grid[i][j] == 1) {
                    p.rect(i * resolution, j * resolution, resolution - 1, resolution - 1);
                }
            }
        }

        // --- Game of Life Logic ---
        let next = make2DArray(cols, rows);
        const aqi = MOCK_DATA.aqi || 50;
        let deathRate = 0; // Extra chance of dying due to pollution
        if (aqi > 100) deathRate = 0.02;
        if (aqi > 150) deathRate = 0.05;

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                let state = grid[i][j];
                let neighbors = countNeighbors(grid, i, j);

                // Apply Game of Life rules
                if (state == 0 && neighbors == 3) next[i][j] = 1;
                else if (state == 1 && (neighbors < 2 || neighbors > 3)) next[i][j] = 0;
                else next[i][j] = state;

                // Apply pollution death rate
                if (next[i][j] == 1 && Math.random() < deathRate) next[i][j] = 0;
            }
        }
        grid = next;
    };

    function make2DArray(c, r) {
        return new Array(c).fill(0).map(() => new Array(r).fill(0));
    }

    function countNeighbors(grid, x, y) {
        let sum = 0;
        for (let i = -1; i < 2; i++) {
            for (let j = -1; j < 2; j++) {
                // Wrap around edges
                let col = (x + i + cols) % cols;
                let row = (y + j + rows) % rows;
                sum += grid[col][row];
            }
        }
        return sum - grid[x][y]; // Subtract self
    }
};


/**
 * p5.js sketch for the Metro Crowd Density (Gas Simulation).
 * Simulates gas particles (O2 vs CO2) to represent crowd levels.
 */
const metroSketch = (p) => {
    let particles = [];
    
    p.setup = () => {
        let c = p.createCanvas(p.windowWidth, p.windowHeight);
        c.parent("canvas-metro");
        p.noLoop(); // Start paused
    };

    p.draw = () => {
        p.clear();
        // Add new particles if below the max count
        if (particles.length < 150) {
            particles.push(new GasParticle(p));
        }

        // Update and display all particles
        for (let i = particles.length - 1; i >= 0; i--) {
            let ptc = particles[i];
            ptc.update();
            ptc.show();
            if (ptc.finished()) particles.splice(i, 1); // Remove off-screen particles
        }
    };
    
    class GasParticle {
        constructor(p) {
            this.p = p;
            this.x = p.random(p.width);
            this.y = p.height + 20; // Start below the screen

            const density = (MOCK_DATA.metro_density || "").toLowerCase();
            let isCO2 = false; // Represents a person (crowd)
            
            // Set particle type based on crowd density
            if (density === 'high') isCO2 = p.random(1) < 0.7;
            else if (density === 'medium') isCO2 = p.random(1) < 0.3;
            else isCO2 = p.random(1) < 0.1;

            if (isCO2) { // Slower, larger "CO2" particles
                this.col = [255, 100, 0];
                this.size = p.random(p.width * 0.02, p.width * 0.035);
                this.vx = p.random(-0.5, 0.5);
                this.vy = p.random(-3, -1.5);
            } else { // Faster, smaller "O2" particles
                this.col = [0, 200, 255];
                this.size = p.random(p.width * 0.01, p.width * 0.02);
                this.vx = p.random(-2, 2);
                this.vy = p.random(-7, -3);
            }
            
            this.alpha = 255;
            this.fadeStart = p.height * 0.3; // Y-position to start fading
        }

        finished() {
            return this.y < -50;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            // Fade out particle as it reaches the top
            if (this.y < this.fadeStart) this.alpha -= 2;
        }

        show() {
            this.p.noStroke();
            this.p.fill(this.col[0], this.col[1], this.col[2], this.alpha);
            this.p.ellipse(this.x, this.y, this.size);
        }
    }
};

// --- STARTUP ---
// Kick everything off when the script loads.
initDashboard();
