# Owl Weather 🦉

A weather app with Florida Atlantic University branding. It gets its data from the free [Open-Meteo](https://open-meteo.com/) API, which needs no API key or account, and it opens on **Boca Raton, FL** by default.

## Features
- Current conditions: temperature, feels-like, humidity, wind and gusts, precipitation, pressure, UV index, sunrise and sunset
- Hourly forecast for the next 24 hours, with chance of rain
- 7-day forecast
- City search using the Open-Meteo Geocoding API
- "My location" button that uses browser geolocation, and a "Boca" button to return to campus
- °F / °C toggle
- Remembers your last city and units
- Responsive layout with dark mode

## Project structure
```
public/            # the deployed site (static, no build step)
  index.html
  styles.css
  app.js
  assets/fau-logo.svg
netlify.toml       # Netlify config: publish dir + security headers
```

## Run locally
Use any static file server, for example:
```bash
npx serve public
# or
python3 -m http.server --directory public 8080
```

## Deploy to Netlify
**Option A: Git (recommended)**
1. Push this repo to GitHub.
2. In Netlify, go to **Add new site → Import an existing project** and pick this repo.
3. Netlify reads `netlify.toml` automatically: no build command, publish directory `public`. Click **Deploy**.

**Option B: Drag and drop**
Drag the `public/` folder onto <https://app.netlify.com/drop>.

**Option C: CLI**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=public
```

## Logo
`public/assets/fau-logo.svg` is a placeholder owl mark in FAU colors (FAU Blue `#003366`, FAU Red `#CC0000`). To use the official FAU logo, replace that file and keep the same filename. Official FAU marks are trademarks of the university, so follow FAU's brand guidelines when you use them.

Weather data © Open-Meteo.com, licensed CC BY 4.0.
