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

// ── Helpers 
function wmo(code) {
  return WMO[code] ?? { label: 'Unknown', emoji: '🌡️' };
}

function windDir(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function toF(c) { return (c * 9 / 5 + 32).toFixed(1); }
function fmt(c, fahrenheit) { return fahrenheit ? `${toF(c)}°F` : `${c}°C`; }

// ── State 
let weatherData = null;
let useF = false;

// ── API 

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

// Returns the user's GPS position, or null if unavailable/denied within 3 s.
function requestGeolocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location' }),
      ()  => resolve(null),
      { timeout: 3000 }
    );
  });
}

// Same as requestGeolocation but falls back to New York instead of null.
function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ lat: 40.71, lon: -74.01, label: 'New York (default)' });
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Your location' }),
      ()  => resolve({ lat: 40.71, lon: -74.01, label: 'New York (default)' }),
      { timeout: 3000 }
    );
  });
}

// ── Render 

function render() {
  const d = weatherData;
  const cur = d.current;
  const daily = d.daily;
  const w = wmo(cur.weathercode);

  const days = daily.time.map((t, i) => {
    const date = new Date(t + 'T12:00:00');
    const label = i === 0 ? 'Today'
      : i === 1 ? 'Tomorrow'
      : date.toLocaleDateString('en-US', { weekday: 'short' });
    return { label, code: daily.weathercode[i], hi: daily.temperature_2m_max[i], lo: daily.temperature_2m_min[i] };
  });

  document.getElementById('app').innerHTML = `
    <div class="card current">
      <div class="location-row">
        <span class="location" id="loc-label"></span>
        <button class="unit-toggle" onclick="toggleUnit()">${useF ? '°C' : '°F'}</button>
      </div>
      <div class="weather-main">
        <span class="weather-emoji">${w.emoji}</span>
        <div>
          <div class="temp">${fmt(cur.temperature_2m, useF)}</div>
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
              <span class="hi">${fmt(day.hi, useF)}</span>
              <span class="lo"> / ${fmt(day.lo, useF)}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>
    <button class="loc-btn" onclick="showPicker()">📍 Change Location</button>
    <div id="picker"></div>
  `;
  document.getElementById('loc-label').textContent = d._locationLabel;
}

// ── Location picker 

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

function setPickerError(msg) {
  const el = document.getElementById('loc-err');
  if (el) el.textContent = msg;
}

function setPickerLoading(loading) {
  const s = document.querySelector('.btn-search');
  const d = document.querySelector('.btn-detect');
  if (!s || !d) return;
  s.disabled = loading;
  d.disabled = loading;
  s.textContent = loading ? '…' : '🔍 Search';
}

async function loadWeatherForLoc(lat, lon, label) {
  const data = await fetchWeather(lat, lon);
  data._locationLabel = label;
  weatherData = data;
  render();
}

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

function toggleUnit() {
  useF = !useF;
  render();
}

// ── Boot 
window.onload = async () => {
  const DEFAULT = { lat: 40.71, lon: -74.01, label: 'New York (default)' };

  // Start geolocation immediately in the background — don't block the render.
  const geoPromise = requestGeolocation();

  // Fetch and render the default location right away for an instant load.
  try {
    const data = await fetchWeather(DEFAULT.lat, DEFAULT.lon);
    data._locationLabel = DEFAULT.label;
    weatherData = data;
    render();
  } catch (e) {
    document.getElementById('app').innerHTML =
      `<div class="error">⚠️ Could not load weather.<br><small>${e.message}</small></div>`;
    return;
  }

  // Once geolocation resolves (within 3 s), silently upgrade if the user
  // hasn't already switched to a different location via the picker.
  const geo = await geoPromise;
  if (geo && weatherData._locationLabel === DEFAULT.label) {
    try { await loadWeatherForLoc(geo.lat, geo.lon, geo.label); } catch (_) {}
  }
};
