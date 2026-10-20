"use strict";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

const BOCA_RATON = {
  name: "Boca Raton",
  region: "Florida, United States",
  latitude: 26.3683,
  longitude: -80.1289,
};

// WMO weather interpretation codes -> [description, day icon, night icon]
const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "🌙"],
  1: ["Mainly clear", "🌤️", "🌙"],
  2: ["Partly cloudy", "⛅", "☁️"],
  3: ["Overcast", "☁️", "☁️"],
  45: ["Fog", "🌫️", "🌫️"],
  48: ["Depositing rime fog", "🌫️", "🌫️"],
  51: ["Light drizzle", "🌦️", "🌧️"],
  53: ["Drizzle", "🌦️", "🌧️"],
  55: ["Dense drizzle", "🌧️", "🌧️"],
  56: ["Light freezing drizzle", "🌧️", "🌧️"],
  57: ["Freezing drizzle", "🌧️", "🌧️"],
  61: ["Light rain", "🌦️", "🌧️"],
  63: ["Rain", "🌧️", "🌧️"],
  65: ["Heavy rain", "🌧️", "🌧️"],
  66: ["Light freezing rain", "🌧️", "🌧️"],
  67: ["Freezing rain", "🌧️", "🌧️"],
  71: ["Light snow", "🌨️", "🌨️"],
  73: ["Snow", "🌨️", "🌨️"],
  75: ["Heavy snow", "❄️", "❄️"],
  77: ["Snow grains", "🌨️", "🌨️"],
  80: ["Light showers", "🌦️", "🌧️"],
  81: ["Showers", "🌧️", "🌧️"],
  82: ["Violent showers", "⛈️", "⛈️"],
  85: ["Light snow showers", "🌨️", "🌨️"],
  86: ["Snow showers", "❄️", "❄️"],
  95: ["Thunderstorm", "⛈️", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️", "⛈️"],
  99: ["Severe thunderstorm with hail", "⛈️", "⛈️"],
};

const UNITS = {
  imperial: { temp: "fahrenheit", wind: "mph", precip: "inch", tempLabel: "°F", windLabel: "mph", precipLabel: "in" },
  metric: { temp: "celsius", wind: "kmh", precip: "mm", tempLabel: "°C", windLabel: "km/h", precipLabel: "mm" },
};

const USER_NAME = "Johanna";

const $ = (id) => document.getElementById(id);

const state = {
  place: loadJSON("owlweather.place") || BOCA_RATON,
  units: localGet("owlweather.units") === "metric" ? "metric" : "imperial",
  requestId: 0,
};

/* ---------- storage helpers (storage can be unavailable in private modes) ---------- */

function localGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function localSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function loadJSON(key) {
  try {
    const value = JSON.parse(localGet(key));
    return value && typeof value.latitude === "number" ? value : null;
  } catch {
    return null;
  }
}

/* ---------- formatting ---------- */

function describe(code, isDay = 1) {
  const entry = WEATHER_CODES[code] || ["Unknown", "🌡️", "🌡️"];
  return { text: entry[0], icon: isDay ? entry[1] : entry[2] };
}

function compass(deg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Open-Meteo returns local times without an offset (e.g. "2026-10-20T14:00") when
// timezone=auto, so parse them as wall-clock values rather than as the browser's time.
function parseLocal(iso) {
  const [date, time = "00:00"] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm));
}
const fmtHour = new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "UTC" });
const fmtTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const fmtDay = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

const round = (n) => Math.round(n);

/* ---------- API ---------- */

async function fetchForecast(place, units) {
  const u = UNITS[units];
  const params = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: [
      "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day",
      "precipitation", "weather_code", "pressure_msl", "wind_speed_10m",
      "wind_direction_10m", "wind_gusts_10m",
    ].join(","),
    hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
    daily: [
      "weather_code", "temperature_2m_max", "temperature_2m_min",
      "precipitation_probability_max", "sunrise", "sunset", "uv_index_max",
    ].join(","),
    temperature_unit: u.temp,
    wind_speed_unit: u.wind,
    precipitation_unit: u.precip,
    timezone: "auto",
    forecast_days: "7",
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
  return res.json();
}

async function searchPlaces(query) {
  const params = new URLSearchParams({ name: query, count: "6", language: "en", format: "json" });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/* ---------- rendering ---------- */

function setStatus(message, isError = false) {
  const el = $("status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function render(data) {
  const u = UNITS[state.units];
  const c = data.current;
  const now = describe(c.weather_code, c.is_day);

  $("place-name").textContent = state.place.region
    ? `${state.place.name}, ${state.place.region.split(",")[0]}`
    : state.place.name;
  $("updated").textContent = `Updated ${fmtDay.format(parseLocal(c.time))}, ${fmtTime.format(parseLocal(c.time))} local time`;
  $("current-icon").textContent = now.icon;
  $("current-temp").textContent = `${round(c.temperature_2m)}${u.tempLabel}`;
  $("current-desc").textContent = now.text;
  $("current-feels").textContent =
    `Feels like ${round(c.apparent_temperature)}${u.tempLabel} · ` +
    `H ${round(data.daily.temperature_2m_max[0])}° / L ${round(data.daily.temperature_2m_min[0])}°`;

  $("stat-humidity").textContent = `${c.relative_humidity_2m}%`;
  $("stat-wind").textContent =
    `${round(c.wind_speed_10m)} ${u.windLabel} ${compass(c.wind_direction_10m)}` +
    (c.wind_gusts_10m != null ? ` (gusts ${round(c.wind_gusts_10m)})` : "");
  $("stat-precip").textContent = `${c.precipitation} ${u.precipLabel}`;
  $("stat-pressure").textContent = `${round(c.pressure_msl)} hPa`;
  const uv = data.daily.uv_index_max[0];
  $("stat-uv").textContent = uv == null ? "—" : `${uv.toFixed(1)} (${uvLabel(uv)})`;
  $("stat-sun").textContent =
    `${fmtTime.format(parseLocal(data.daily.sunrise[0]))} / ${fmtTime.format(parseLocal(data.daily.sunset[0]))}`;

  renderWelcome(data, u, now);
  renderHourly(data, u);
  renderDaily(data);

  for (const id of ["current", "hourly-card", "daily-card"]) $(id).hidden = false;
  setStatus("");
  document.title = `${round(c.temperature_2m)}${u.tempLabel} ${state.place.name} | Owl Weather`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return ["Up late", "🌙"];
  if (hour < 12) return ["Good morning", "☀️"];
  if (hour < 17) return ["Good afternoon", "🌤️"];
  if (hour < 21) return ["Good evening", "🌆"];
  return ["Good night", "🌙"];
}

function weatherTip(data) {
  const c = data.current;
  const pop = data.daily.precipitation_probability_max[0] || 0;
  const uv = data.daily.uv_index_max[0] || 0;
  const hotF = state.units === "imperial" ? 90 : 32;
  const coldF = state.units === "imperial" ? 55 : 13;
  if (c.weather_code >= 95) return "Thunderstorms around. Stay safe getting to class! ⛈️";
  if (pop >= 50) return `${pop}% chance of rain today. Grab an umbrella! ☔`;
  if (c.apparent_temperature >= hotF) return "It's a hot one. Stay hydrated! 💧";
  if (c.apparent_temperature <= coldF) return "Chilly out there. Bring a jacket! 🧥";
  if (uv >= 8) return "UV is very high today. Don't forget sunscreen! 🧴";
  return "Have a great day, Owl! 🦉";
}

function renderWelcome(data, u, now) {
  const [hello, emoji] = greeting();
  $("welcome-title").textContent = `${hello}, ${USER_NAME}! ${emoji}`;
  $("welcome-text").textContent =
    `It's ${round(data.current.temperature_2m)}${u.tempLabel} and ${now.text.toLowerCase()} in ${state.place.name}. ` +
    weatherTip(data);
}

function uvLabel(uv) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

function renderHourly(data, u) {
  const h = data.hourly;
  const currentHour = data.current.time.slice(0, 13); // "YYYY-MM-DDTHH"
  let start = h.time.findIndex((t) => t.slice(0, 13) >= currentHour);
  if (start < 0) start = 0;

  const container = $("hourly");
  container.replaceChildren();
  for (let i = start; i < Math.min(start + 24, h.time.length); i++) {
    const w = describe(h.weather_code[i], h.is_day[i]);
    const pop = h.precipitation_probability[i];
    const el = document.createElement("div");
    el.className = "hour";
    el.title = w.text;
    el.innerHTML = `
      <div class="h-time"></div>
      <div class="h-icon" aria-hidden="true"></div>
      <div class="h-temp"></div>
      <div class="h-pop"></div>`;
    el.querySelector(".h-time").textContent = i === start ? "Now" : fmtHour.format(parseLocal(h.time[i]));
    el.querySelector(".h-icon").textContent = w.icon;
    el.querySelector(".h-temp").textContent = `${round(h.temperature_2m[i])}${u.tempLabel.charAt(0)}`;
    el.querySelector(".h-pop").textContent = pop ? `💧${pop}%` : "";
    container.append(el);
  }
}

function renderDaily(data) {
  const d = data.daily;
  const list = $("daily");
  list.replaceChildren();
  d.time.forEach((day, i) => {
    const w = describe(d.weather_code[i], 1);
    const li = document.createElement("li");
    li.className = "day";
    li.innerHTML = `
      <span class="d-name"></span>
      <span class="d-icon" aria-hidden="true"></span>
      <span class="d-desc"></span>
      <span class="d-pop"></span>
      <span class="d-temps"><span class="d-hi"></span><span class="d-lo"></span></span>`;
    li.querySelector(".d-name").textContent = i === 0 ? "Today" : fmtDay.format(parseLocal(day)).split(",")[0];
    li.querySelector(".d-icon").textContent = w.icon;
    li.querySelector(".d-desc").textContent = w.text;
    const pop = d.precipitation_probability_max[i];
    li.querySelector(".d-pop").textContent = pop ? `💧${pop}%` : "";
    li.querySelector(".d-hi").textContent = `${round(d.temperature_2m_max[i])}°`;
    li.querySelector(".d-lo").textContent = `${round(d.temperature_2m_min[i])}°`;
    list.append(li);
  });
}

/* ---------- actions ---------- */

async function load() {
  const id = ++state.requestId;
  setStatus(`Loading forecast for ${state.place.name}…`);
  try {
    const data = await fetchForecast(state.place, state.units);
    if (id !== state.requestId) return; // a newer request superseded this one
    render(data);
  } catch (err) {
    if (id !== state.requestId) return;
    console.error(err);
    setStatus("Couldn't load the forecast. Check your connection and try again.", true);
  }
}

function setPlace(place) {
  state.place = place;
  localSet("owlweather.place", JSON.stringify(place));
  load();
}

function updateUnitButton() {
  const btn = $("unit-btn");
  btn.textContent = UNITS[state.units].tempLabel;
  btn.setAttribute("aria-pressed", String(state.units === "metric"));
  btn.title = state.units === "imperial" ? "Switch to Celsius" : "Switch to Fahrenheit";
}

/* ---------- search box ---------- */

function setupSearch() {
  const form = $("search-form");
  const input = $("search-input");
  const list = $("search-results");
  let results = [];
  let active = -1;
  let timer;
  let searchId = 0;

  const close = () => { list.hidden = true; active = -1; };

  const choose = (place) => {
    input.value = "";
    close();
    input.blur();
    setPlace(place);
  };

  const highlight = () => {
    [...list.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
  };

  const show = (items) => {
    results = items;
    active = -1;
    list.replaceChildren();
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "No matching places";
      li.className = "sub";
      list.append(li);
    }
    items.forEach((place) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      const name = document.createElement("div");
      name.textContent = place.name;
      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = place.region;
      li.append(name, sub);
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(place); });
      list.append(li);
    });
    list.hidden = false;
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { close(); return; }
    timer = setTimeout(async () => {
      const id = ++searchId;
      try {
        const items = await searchPlaces(q);
        if (id === searchId && input.value.trim() === q) show(items);
      } catch (err) {
        console.error(err);
      }
    }, 300);
  });

  input.addEventListener("keydown", (e) => {
    if (list.hidden || !results.length) return;
    if (e.key === "ArrowDown") { active = (active + 1) % results.length; highlight(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = (active - 1 + results.length) % results.length; highlight(); e.preventDefault(); }
    else if (e.key === "Escape") close();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!list.hidden && results.length) { choose(results[Math.max(active, 0)]); return; }
    const q = input.value.trim();
    if (q.length < 2) return;
    try {
      const items = await searchPlaces(q);
      if (items.length) choose(items[0]); else show(items);
    } catch (err) {
      console.error(err);
      setStatus("Search failed. Please try again.", true);
    }
  });

  input.addEventListener("blur", close);
}

/* ---------- theme ---------- */

function setupTheme() {
  const buttons = document.querySelectorAll("[data-theme-option]");
  const apply = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    buttons.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.themeOption === theme)));
  };
  apply(document.documentElement.getAttribute("data-theme") || "system");
  buttons.forEach((b) => b.addEventListener("click", () => {
    apply(b.dataset.themeOption);
    localSet("owlweather.theme", b.dataset.themeOption);
  }));
}

/* ---------- init ---------- */

function init() {
  const [hello, emoji] = greeting();
  $("welcome-title").textContent = `${hello}, ${USER_NAME}! ${emoji}`;
  setupTheme();
  updateUnitButton();
  setupSearch();

  $("unit-btn").addEventListener("click", () => {
    state.units = state.units === "imperial" ? "metric" : "imperial";
    localSet("owlweather.units", state.units);
    updateUnitButton();
    load();
  });

  $("boca-btn").addEventListener("click", () => setPlace(BOCA_RATON));

  $("locate-btn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("Your browser doesn't support location.", true);
      return;
    }
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => setPlace({
        name: "My location",
        region: "",
        latitude: Number(pos.coords.latitude.toFixed(4)),
        longitude: Number(pos.coords.longitude.toFixed(4)),
      }),
      () => setStatus("Couldn't get your location. Showing the last selected place.", true),
      { timeout: 10000, maximumAge: 600000 },
    );
  });

  load();
}

init();
