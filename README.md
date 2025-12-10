## Overview

Sense Bengaluru is a static site powered by a scheduled Python script that periodically fetches real-world data (weather, air quality, traffic, flights, and news sentiment) and writes it to `data.json`.
The frontend (HTML/CSS/JS + p5.js) reads this JSON and turns the city’s state into interactive “instruments” like a petri dish, speedometer, metro gas particles, Geiger counter, and radar.

Check it out on https://arpanmondalz.github.io/sense-bengaluru/

## Features

- **Weather Sketchbook**  
  A hand-drawn mascot on a sketchbook background that changes with the current weather condition (sunny, rain, cloudy, cold), driven by OpenWeatherMap data.

- **AQI Petri Dish**  
  A Conway’s Game of Life simulation rendered inside a circular petri-dish frame, where AQI controls initial cell density and death rate—clean air looks lively, polluted air looks sparse and dying.

- **Traffic Speedometer**  
  An analog speedometer UI whose needle angle and subtle jitter reflect estimated average speed between Silk Board and Hebbal using TomTom routing data.

- **Metro Gas Simulation**  
  A particle system running in p5.js where blue O₂ molecules and orange CO₂ bubbles float through a metro coach background; the O₂/CO₂ ratio and motion profile change with “low / medium / high” metro density.

- **News Geiger Counter**  
  A Geiger-counter style interface where needle angle and click frequency represent news sentiment for Bengaluru, computed via a scheduled backend script using an LLM sentiment score

- **Flight Radar**  
  A stylized radar panel that shows a rotating sweep and glowing blips for flights over Bengaluru, driven by a periodic flight count from OpenSky.

## Tech Stack

- **Frontend**
  - HTML5, CSS3 (responsive grid, card flip animation, analog UI styling)
  - Vanilla JavaScript for card interactions, state management, and DOM updates
  - p5.js for the AQI Game of Life and metro particle simulations

- **Data Pipeline**
  - Python script (`update_data.py`) that:
    - Fetches current weather and AQI from OpenWeatherMap
    - Computes traffic speed using TomTom routing between Silk Board and Hebbal
    - Simulates metro density based on local time
    - Derives a normalized news “chaos” score using Gemini given Bengaluru news headlines
    - Counts flights over a Bengaluru bounding box via OpenSky
  - Outputs a single `data.json` consumed by the frontend.

- **Deployment**
  - Static hosting on GitHub Pages from the `main` branch
  - GitHub Actions workflow that:
    - Runs `update_data.py` every 30 minutes via cron
    - Commits updated `data.json` back to the repo, triggering a fresh Pages build

## Project Structure

- `index.html` – Main layout, cards, and module containers.
- `style.css` – Grid layout, analog UI styling, card flip animation, petri/radar/metro visuals.
- `script.js` – Card expand/close logic, data binding, p5.js sketch setup, and all instrument behaviors.
- `data.json` – Generated data snapshot (weather, AQI, traffic, metro density, news sentiment, flight count). 
- `assets/` – Visual assets such as thumbnails, mascots, metro interior, Geiger face, radar base, and favicon.

## Running Locally

1. **Clone the repo**

```bash
git clone https://github.com/Arpanmondalz/sense-bengaluru.git
cd sense-bengaluru
```

2. **Serve with a local HTTP server** (required for `fetch("data.json")`)

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

3. **(Optional) Run the Python data generator**

Create a virtual environment, install dependencies, set environment variables (`OWM_API_KEY`, `TOMTOM_API_KEY`, `GEMINI_API_KEY`), and run:

```bash
python update_data.py
```

This will overwrite `data.json` with a fresh snapshot.

## GitHub Actions / Automation

The repo includes a GitHub Actions workflow under `.github/workflows/` that:

- Runs every 30 minutes via cron.  
- Installs Python and `requests`.  
- Executes `update_data.py` with API keys injected from GitHub Secrets.  
- Commits and pushes `data.json` if it changed.  

This pattern keeps the public site purely static (no runtime API calls from users) while still feeling live and timely.
