# Fitness Logger 🏋️‍♂️

A lightweight and responsive fitness logging app that tracks my weight and lifting progress, as well as my outdoor activity sessions (surfing, hiking, running, and snorkeling). Built with **React**, a self-hosted **Express + PostgreSQL** backend, and **Tailwind CSS**, it features session history, statistics, and location-based visualization via interactive maps.

## Features

- 🔐 JWT authentication
- 📓 Logs for six different activities: weight tracking, weightlifting, surfing, hiking, running, and snorkeling
- 📍 View outdoor activities on a map with React-Leaflet + OpenStreetMap
- 📈 Analyze activity trends with historical statistics
- ⚡  Fast, mobile-friendly UI with React + Tailwind

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express + Prisma + PostgreSQL (self-hosted)
- **Map**: React-Leaflet + OpenStreetMap
- **Deployment**: Docker (self-hosted, `git push` to deploy)

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/colinrec34/fitness-logger.git
cd fitness-logger
```

### 2. Install npm dependencies
```bash
npm install
```

### 3. Define environment variables (server)
```
DATABASE_URL=postgresql://fitness:password@localhost:5432/fitness
JWT_SECRET=your-secret
JWT_EXPIRES_IN=30d

# Optional: ESF-551 smart-scale webhook (POST /api/esf551)
ESF551_WEBHOOK_TOKEN=shared-secret-for-pico-webhook
ESF551_USER_ID=target-user-id-for-weight-logs
ESF551_WEIGHT_ACTIVITY_ID=weight-activity-id
```

### 4. Start Local Dev Server
```bash
npm run dev
```

## Project Structure
```
src/
├── api/              # API client (supabaseClient.ts: shim over the REST API)
├── components/       # Reusable UI elements
├── lib/              # helpers
├── pages/            # Activity pages (lifting, surf, etc.) and Home/Login pages
├── App.tsx           # App entry point
└── main.tsx          # Vite entry file

pico/
└── esf551/           # MicroPython collector for the Etekcity ESF-551 scale
```

## 🔮 Planned Updates
- Activity editing and deletion
- Profile dashboard for managing activities (including Strava-connected types);
- Generalize activities for easy management and no hardcoded pages

## 📌 Notes
This was designed based on my personal logging ambitions, but can be easily extended to other activities and layouts. Generic templates are included in the pages/activities directory for quick addition of new activities. In the future, these templates will generate all the activities themselves, so no pages are hardcoded with custom ```.tsx``` files.

## 📸 Screenshots

<p align="center">
  <img src="images/home.png" />
  Home Page
</p>
<p align="center">
  <img src="images/outdoor.png" />
  Latest Outdoor Activities
</p>
<p align="center">
  <img src="images/lifting.png" />
  Lifting Activity Page
</p>
<p align="center">
  <img src="images/surfing.png" />
  Surfing Activity Page
</p>
<p align="center">
  <img src="images/running.png" />
  Running Activity Page
</p>
<p align="center">
  <img src="images/hiking.png"  />
  Hiking Activity Page
</p>


## 📄 License
MIT © Colin Recker
