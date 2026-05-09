/**
 * WMO weather interpretation codes mapped to human-readable labels and emojis.
 * @type {Object.<number, {label: string, emoji: string}>}
 */
const WMO = {
  0:  { label: 'Clear sky',            emoji: '☀️'  },
  1:  { label: 'Mainly clear',         emoji: '🌤️' },
  2:  { label: 'Partly cloudy',        emoji: '⛅'  },
  3:  { label: 'Overcast',             emoji: '☁️'  },
  45: { label: 'Foggy',                emoji: '🌫️' },
  48: { label: 'Icy fog',              emoji: '🌫️' },
  51: { label: 'Light drizzle',        emoji: '🌦️' },
  53: { label: 'Drizzle',              emoji: '🌦️' },
  55: { label: 'Heavy drizzle',        emoji: '🌦️' },
  61: { label: 'Light rain',           emoji: '🌧️' },
  63: { label: 'Rain',                 emoji: '🌧️' },
  65: { label: 'Heavy rain',           emoji: '🌧️' },
  71: { label: 'Light snow',           emoji: '🌨️' },
  73: { label: 'Snow',                 emoji: '❄️'  },
  75: { label: 'Heavy snow',           emoji: '❄️'  },
  77: { label: 'Snow grains',          emoji: '🌨️' },
  80: { label: 'Light showers',        emoji: '🌦️' },
  81: { label: 'Showers',              emoji: '🌧️' },
  82: { label: 'Heavy showers',        emoji: '⛈️'  },
  85: { label: 'Snow showers',         emoji: '🌨️' },
  86: { label: 'Heavy snow showers',   emoji: '❄️'  },
  95: { label: 'Thunderstorm',         emoji: '⛈️'  },
  96: { label: 'Thunderstorm w/ hail', emoji: '⛈️'  },
  99: { label: 'Thunderstorm w/ hail', emoji: '⛈️'  },
};

/**
 * Default fallback location used on initial load and when geolocation is unavailable.
 * @type {{lat: number, lon: number, label: string}}
 */
const DEFAULT_LOCATION = { lat: 40.71, lon: -74.01, label: 'New York (default)' };

// ── Helpers

/**
 * Looks up a WMO weather code and returns its label and emoji.
 * @param {number} code - WMO weather interpretation code.
 * @returns {{label: string, emoji: string}}
 */
function wmo(code) {
  return WMO[code] ?? { label: 'Unknown', emoji: '🌡️' };
}

/**
 * Converts a wind direction in degrees to a compass abbreviation.
 * @param {number} deg - Wind direction in degrees (0–360).
 * @returns {string} Compass abbreviation, e.g. 'N', 'SW'.
 */
function windDir(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * Converts Celsius to Fahrenheit.
 * @param {number} c - Temperature in Celsius.
 * @returns {string} Temperature in Fahrenheit, fixed to one decimal place.
 */
function toF(c) { return (c * 9 / 5 + 32).toFixed(1); }

/**
 * Formats a Celsius temperature as a display string in the given unit.
 * Accepts a string unit so new units (e.g. 'K') can be added without modifying
 * existing branches — satisfying the Open/Closed Principle.
 * @param {number} c - Temperature in Celsius.
 * @param {'C'|'F'} unit - Target display unit.
 * @returns {string} Formatted temperature string, e.g. '22°C' or '71.6°F'.
 */
function formatTemp(c, unit) {
  return unit === 'F' ? `${toF(c)}°F` : `${c}°C`;
}

// ── State

/** @type {Object|null} Most recently fetched weather API response, with an added `_locationLabel` string. */
let weatherData = null;

/** @type {boolean} Whether to display temperatures in Fahrenheit (true) or Celsius (false). */
let useF = false;

// ── API

/**
 * Fetches current weather and a 3-day daily forecast from the Open-Meteo API.
 * @param {number} lat - Latitude of the location.
 * @param {number} lon - Longitude of the location.
 * @returns {Promise<Object>} Parsed JSON response containing `current` and `daily` data.
 * @throws {Error} If the HTTP response is not OK.
 */
async function fetchWeather(lat, lon) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('current', 'temperature_2m,windspeed_10m,winddirection_10m,weathercode');
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '3');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

/**
 * Geocodes a city name to coordinates via the Open-Meteo Geocoding API.
 * @param {string} name - City name to search for.
 * @returns {Promise<{lat: number, lon: number, label: string}>} Resolved coordinates and display label.
 * @throws {Error} If the request fails or no results are found.
 */
async function geocodeCity(name) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', name);
  url.searchParams.set('count', '1');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding error ${res.status}`);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`No results for "${name}"`);
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, label: `${r.name}${r.country ? ', ' + r.country : ''}` };
}

/**
 * Wraps the browser Geolocation API in a Promise, resolving to `fallback` on denial or unavailability.
 * Centralises geolocation logic so `requestGeolocation` and `getLocation` share a single implementation
 * and differ only in their fallback value — satisfying the DRY and Open/Closed principles.
 * @param {{lat: number, lon: number, label: string}|null} fallback - Value to resolve with on failure.
 * @returns {Promise<{lat: number, lon: number, label: string}|null>}
 */
function geolocate(fallback) {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(fallback);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location' }),
      ()  => resolve(fallback),
      { timeout: 3000 }
    );
  });
}

/**
 * Requests the user's GPS position with a 3-second timeout.
 * @returns {Promise<{lat: number, lon: number, label: string}|null>}
 *   Resolves with coordinates, or `null` if geolocation is unavailable or denied.
 */
function requestGeolocation() { return geolocate(null); }

/**
 * Requests the user's GPS position with a 3-second timeout,
 * falling back to {@link DEFAULT_LOCATION} if unavailable or denied.
 * @returns {Promise<{lat: number, lon: number, label: string}>}
 */
function getLocation() { return geolocate(DEFAULT_LOCATION); }

// ── Render

/**
 * Transforms the raw daily API data into display-ready day descriptors.
 * Extracted from `render` to satisfy the Single Responsibility Principle —
 * data transformation and DOM mutation are separate concerns.
 * @param {Object} daily - The `daily` field from the Open-Meteo API response.
 * @returns {Array<{label: string, code: number, hi: number, lo: number}>}
 */
function buildForecastDays(daily) {
  return daily.time.map((t, i) => {
    const date = new Date(t + 'T12:00:00');
    const label = i === 0 ? 'Today'
      : i === 1 ? 'Tomorrow'
      : date.toLocaleDateString('en-US', { weekday: 'short' });
    return { label, code: daily.weathercode[i], hi: daily.temperature_2m_max[i], lo: daily.temperature_2m_min[i] };
  });
}

/**
 * Renders the current weather and 3-day forecast into the `#app` element.
 * Receives all data as parameters rather than reading globals, satisfying the
 * Dependency Inversion Principle and making the function independently testable.
 * @param {Object} data - Weather API response with `_locationLabel` attached.
 * @param {boolean} fahrenheit - Whether to display temperatures in °F.
 * @returns {void}
 */
function render(data, fahrenheit) {
  const cur = data.current;
  const w = wmo(cur.weathercode);
  const unit = fahrenheit ? 'F' : 'C';
  const days = buildForecastDays(data.daily);

  document.getElementById('app').innerHTML = `
    <div class="card current">
      <div class="location-row">
        <span class="location" id="loc-label"></span>
        <button class="unit-toggle" onclick="toggleUnit()">${fahrenheit ? '°C' : '°F'}</button>
      </div>
      <div class="weather-main">
        <span class="weather-emoji">${w.emoji}</span>
        <div>
          <div class="temp">${formatTemp(cur.temperature_2m, unit)}</div>
          <div class="description">${w.label}</div>
        </div>
      </div>
      <div class="wind-row">
        💨 ${cur.windspeed_10m} km/h ${windDir(cur.winddirection_10m)}
      </div>
    </div>
    <div class="card">
      <div class="forecast-grid">
        ${days.map(day => `
          <div class="forecast-day">
            <div class="day-name">${day.label}</div>
            <div class="forecast-emoji">${wmo(day.code).emoji}</div>
            <div class="hi-lo">
              <span class="hi">${formatTemp(day.hi, unit)}</span>
              <span class="lo"> / ${formatTemp(day.lo, unit)}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <button class="loc-btn" onclick="showPicker()">📍 Change Location</button>
    <div id="picker"></div>
  `;
  document.getElementById('loc-label').textContent = data._locationLabel;
}

// ── Location picker

/**
 * Injects the location-picker UI (text input + action buttons) into the `#picker` element.
 * Binds Enter key on the input to {@link searchCity}.
 * @returns {void}
 */
function showPicker() {
  const el = document.getElementById('picker');
  if (!el) return;
  el.innerHTML = `
    <div class="loc-picker">
      <input id="loc-input" class="loc-input" type="text" placeholder="City name, e.g. Tokyo" />
      <div class="loc-actions">
        <button class="btn-search" onclick="searchCity()">🔍 Search</button>
        <button class="btn-detect" onclick="autoDetect()">📡 Auto-detect</button>
      </div>
      <div class="loc-err" id="loc-err"></div>
    </div>`;
  const input = document.getElementById('loc-input');
  input.focus();
  input.addEventListener('keydown', e => { if (e.key === 'Enter') searchCity(); });
}

/**
 * Displays an error message inside the location picker's error element.
 * @param {string} msg - Error text to display. Pass an empty string to clear the error.
 * @returns {void}
 */
function setPickerError(msg) {
  const el = document.getElementById('loc-err');
  if (el) el.textContent = msg;
}

/**
 * Enables or disables the picker's search and detect buttons to indicate a loading state.
 * @param {boolean} loading - When true, disables buttons and replaces the search label with '…'.
 * @returns {void}
 */
function setPickerLoading(loading) {
  const s = document.querySelector('.btn-search');
  const d = document.querySelector('.btn-detect');
  if (!s || !d) return;
  s.disabled = loading;
  d.disabled = loading;
  s.textContent = loading ? '…' : '🔍 Search';
}

/**
 * Fetches weather for the given coordinates, stores it in `weatherData`, and re-renders the UI.
 * @param {number} lat - Latitude of the target location.
 * @param {number} lon - Longitude of the target location.
 * @param {string} label - Human-readable location name shown in the UI.
 * @returns {Promise<void>}
 */
async function loadWeatherForLoc(lat, lon, label) {
  const data = await fetchWeather(lat, lon);
  data._locationLabel = label;
  weatherData = data;
  render(weatherData, useF);
}

/**
 * Reads the city name from the picker input, geocodes it, and loads the weather.
 * Shows a validation or API error in the picker on failure.
 * @returns {Promise<void>}
 */
async function searchCity() {
  const input = document.getElementById('loc-input');
  const query = input ? input.value.trim() : '';
  if (!query) { setPickerError('Please enter a city name.'); return; }
  setPickerError('');
  setPickerLoading(true);
  try {
    const loc = await geocodeCity(query);
    await loadWeatherForLoc(loc.lat, loc.lon, loc.label);
  } catch (e) {
    setPickerLoading(false);
    setPickerError(e.message);
  }
}

/**
 * Auto-detects the user's location via {@link getLocation} and loads the weather.
 * Shows a generic error in the picker if detection fails.
 * @returns {Promise<void>}
 */
async function autoDetect() {
  setPickerError('');
  setPickerLoading(true);
  try {
    const loc = await getLocation();
    await loadWeatherForLoc(loc.lat, loc.lon, loc.label);
  } catch (e) {
    setPickerLoading(false);
    setPickerError('Could not detect location.');
  }
}

/**
 * Toggles the temperature unit between Celsius and Fahrenheit and re-renders the UI.
 * @returns {void}
 */
function toggleUnit() {
  useF = !useF;
  render(weatherData, useF);
}

// ── Boot
window.onload = async () => {
  // Start geolocation immediately in the background — don't block the render.
  const geoPromise = requestGeolocation();

  // Fetch and render the default location right away for an instant load.
  try {
    const data = await fetchWeather(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
    data._locationLabel = DEFAULT_LOCATION.label;
    weatherData = data;
    render(weatherData, useF);
  } catch (e) {
    document.getElementById('app').innerHTML =
      `<div class="error">⚠️ Could not load weather.<br><small>${e.message}</small></div>`;
    return;
  }

  // Once geolocation resolves (within 3 s), silently upgrade if the user
  // hasn't already switched to a different location via the picker.
  const geo = await geoPromise;
  if (geo && weatherData._locationLabel === DEFAULT_LOCATION.label) {
    try { await loadWeatherForLoc(geo.lat, geo.lon, geo.label); } catch (_) {}
  }
};
