# Weather App

A lightweight, zero-dependency weather page built with plain HTML, CSS, and JavaScript. Fetches live data from the free [Open-Meteo](https://open-meteo.com/) API — no API key required.

## Files

| File | Purpose |
|------|---------|
| `weather.html` | Page structure and entry point |
| `weather.css` | All styles |
| `weather.js` | Data fetching, rendering, and interactivity |

## Features

- **Current conditions** — temperature, weather description, wind speed and direction
- **3-day forecast** — high/low temperatures and weather icon per day
- **°C / °F toggle** — switches units instantly without a new network request
- **Location picker** — manually search any city or auto-detect via GPS
- **Tagline** — pinned to the top center of the page at all times

## How to run

No build step or server needed — just clone the repo and open the file in any modern browser.

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

Then open `weather.html`:

- **Windows:** double-click `weather.html`, or run `start weather.html` in the terminal
- **macOS:** run `open weather.html` in the terminal
- **Linux:** run `xdg-open weather.html` in the terminal

Or in VS Code: **File → Open File → weather.html**, then open with Live Preview or your default browser.

## Optimizations

### 1. Parallel fetch + instant first paint
The default location (New York) is fetched immediately on page load without waiting for the browser's geolocation prompt. The page renders weather data in one API round trip (~100–300 ms) instead of waiting for GPS first.

**Before:** geolocation (up to 8 s) → weather fetch → render
**After:** weather fetch (default) → render immediately; geolocation runs in parallel

### 2. GPS timeout reduced: 8 s → 3 s
The browser geolocation timeout was cut from 8 seconds to 3 seconds. If GPS doesn't resolve within 3 s, the fallback kicks in quickly rather than leaving the user waiting.

### 3. Silent location upgrade
Once geolocation resolves in the background, the weather cards silently update to the user's real location — only if the user hasn't already manually picked a different city via the location picker.

### 4. No re-fetch on unit toggle
Switching between °C and °F re-renders from the already-fetched data in memory. No additional network request is made.

## APIs used

| API | Endpoint | Purpose |
|-----|----------|---------|
| Open-Meteo Forecast | `api.open-meteo.com/v1/forecast` | Current weather + 3-day forecast |
| Open-Meteo Geocoding | `geocoding-api.open-meteo.com/v1/search` | City name → latitude/longitude |

Both APIs are free and require no authentication.
