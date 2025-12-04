"""
Script: update_data.py
Author: Arpan Mondal
Purpose: Fetches live data for the Sense Bengaluru dashboard.
         Aggregates data from multiple APIs (OpenWeatherMap, TomTom, Gemini, OpenSky)
         and saves it to a JSON file for the frontend to consume.
"""

import os
import json
import requests
from datetime import datetime, timezone

# --- CONFIGURATION & API KEYS ---
# Keys are fetched from environment variables.

OWM_API_KEY = os.environ.get("OWM_API_KEY")
TOMTOM_API_KEY = os.environ.get("TOMTOM_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Geospatial Constants for Bengaluru
LAT, LON = 12.9716, 77.5946
SILK_BOARD_COORDS = "12.9172,77.6227"
HEBBAL_COORDS = "13.0358,77.5970"


# --- 1. WEATHER & AQI (Source: OpenWeatherMap) ---
def get_weather_and_aqi():
    """
    Fetches current weather and Air Quality Index (AQI).
    Returns a simplified weather condition string for the mascot animation.
    """
    print("🌤️ Fetching Weather & AQI...")
    try:
        # Fetch Weather Data
        w_url = f"https://api.openweathermap.org/data/2.5/weather?lat={LAT}&lon={LON}&units=metric&appid={OWM_API_KEY}"
        w_data = requests.get(w_url).json()
        
        temp = w_data["main"]["temp"]
        desc = w_data["weather"][0]["main"].lower()

        # Determine condition logic for the frontend mascot
        condition = "sunny"
        if temp < 17:
            condition = "cold"
        elif "rain" in desc or "thunderstorm" in desc or "drizzle" in desc:
            condition = "rain"
        elif "cloud" in desc:
            condition = "cloudy"

        # Fetch Air Quality Data
        a_url = f"http://api.openweathermap.org/data/2.5/air_pollution?lat={LAT}&lon={LON}&appid={OWM_API_KEY}"
        a_data = requests.get(a_url).json()
        
        # OpenWeatherMap returns AQI from 1 (Good) to 5 (Very Poor).
        # We multiply by 50 to approximate a standard AQI scale for the visualization.
        owm_aqi = a_data["list"][0]["main"]["aqi"]
        aqi_val = owm_aqi * 50 

        return {"temp": round(temp, 1), "condition": condition}, aqi_val

    except Exception as e:
        print(f"⚠️ Weather Error: {e}")
        return {"temp": 28, "condition": "sunny"}, 120  # Default fallback


# --- 2. TRAFFIC (Source: TomTom Routing API) ---
def get_traffic_speed():
    """
    Calculates average traffic speed between Silk Board and Hebbal.
    Lower speeds indicate higher congestion.
    """
    print("🚗 Fetching Traffic...")
    try:
        url = f"https://api.tomtom.com/routing/1/calculateRoute/{SILK_BOARD_COORDS}:{HEBBAL_COORDS}/json?key={TOMTOM_API_KEY}&traffic=true"
        data = requests.get(url).json()
        
        summary = data["routes"][0]["summary"]
        # Convert m/s to km/h
        speed_kmh = (summary["lengthInMeters"] / summary["travelTimeInSeconds"]) * 3.6
        
        return {"speed_kmh": int(speed_kmh)}

    except Exception as e:
        print(f"⚠️ Traffic Error: {e}")
        return {"speed_kmh": 25} # Default moderate traffic speed


# --- 3. NEWS SENTIMENT (Source: Google News RSS + Gemini AI) ---
def get_news_sentiment():
    """
    Analyzes recent news headlines about Bengaluru using Gemini AI.
    Returns a 'chaos score' from 0.0 (Peaceful) to 1.0 (Chaotic).
    """
    print("📰 Analyzing News Sentiment (Gemini 2.5 Flash)...")
    try:
        # 1. Fetch Headlines (RSS Feed)
        rss_url = "https://news.google.com/rss/search?q=Bengaluru+when:1d&hl=en-IN&gl=IN&ceid=IN:en"
        rss_data = requests.get(rss_url).text

        # 2. Analyze with Gemini 2.5 Flash
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        headers = {"Content-Type": "application/json"}

        prompt_text = f"""
        Analyze the sentiment of these news headlines about Bengaluru.
        Return ONLY a single number between 0.0 (Calm/Positive) and 1.0 (Chaotic/Negative/Crisis).
        Do not include any other text or explanation. Just the number.
        
        Headlines RSS Data:
        {rss_data[:3000]}
        """
        
        payload = {
            "contents": [{
                "parts": [{"text": prompt_text}]
            }]
        }

        response = requests.post(gemini_url, headers=headers, json=payload)
        result = response.json()

        # Extract and parse the numeric score
        sentiment_str = result['candidates'][0]['content']['parts'][0]['text'].strip()
        sentiment_score = float(sentiment_str)

        # Clamp result between 0.0 and 1.0 for safety
        return max(0.0, min(1.0, sentiment_score))

    except Exception as e:
        print(f"⚠️ Sentiment Error: {e}")
        if 'result' in locals():
            print(f"Debug Response: {result}")
        return 0.5 # Default neutral sentiment


# --- 4. METRO DENSITY (Simulation based on Time) ---
def simulate_metro_density():
    """
    Simulates crowd density based on the current time of day in Bengaluru (IST).
    Real-time metro data is not publicly available, so we use rush hour logic.
    """
    try:
        # Calculate current IST hour
        utc_hour = datetime.now(timezone.utc).hour
        ist_hour = (utc_hour + 5.5) % 24
        weekday = datetime.now(timezone.utc).weekday()

        if weekday < 5: # Monday to Friday
            # Morning Rush (8-11 AM) & Evening Rush (5-8 PM)
            if (8 <= ist_hour <= 11) or (17 <= ist_hour <= 20):
                return "high"
            # Mid-day Moderate
            elif (11 < ist_hour < 17):
                return "medium"
            else:
                return "low"
        else: # Weekends
            # Weekend evenings are moderately busy
            return "medium" if (18 <= ist_hour <= 21) else "low"

    except:
        return "medium"


# --- 5. FLIGHTS (Source: OpenSky Network) ---
def get_flight_count():
    """
    Counts live aircraft within a bounding box covering Bengaluru airspace.
    """
    print("✈️ Fetching Flights...")
    try:
        # Bounding box coordinates for Bengaluru
        url = "https://opensky-network.org/api/states/all?lamin=12.8&lomin=77.4&lamax=13.2&lomax=77.8"
        resp = requests.get(url, timeout=10).json()
        
        return len(resp["states"]) if resp["states"] else 0

    except:
        return 6 # Default fallback value


# --- MAIN EXECUTION FLOW ---
def main():
    # Fetch all data points
    weather_aqi = get_weather_and_aqi()

    final_json = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "weather": weather_aqi[0],
        "aqi": weather_aqi[1],
        "traffic": get_traffic_speed(),
        "metro_density": simulate_metro_density(),
        "news_sentiment": get_news_sentiment(),
        "flight_count": get_flight_count()
    }

    # Write to JSON file
    with open("data.json", "w") as f:
        json.dump(final_json, f, indent=2)

    print("✅ Data Update Complete")

if __name__ == "__main__":
    main()
