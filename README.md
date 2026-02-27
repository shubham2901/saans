# Saans (Air Quality Monitor)

**Saans** (Hindi for "Breath") is a personalized air quality monitoring application built with **React Native** and **Expo**. It provides real-time AQI data, forecasts, and health-based guidance tailored to specific user profiles.

## 🚀 Key Features
- **Smart AQI Fallback**: Automatically switches between sensor-based data (WAQI) and atmospheric models (Open-Meteo) to ensure readings are never stale.
- **Personalized Health Guidance**: Delivers specific advice for different profiles like runners, children, or asthma patients.
- **Historical Trends**: Visualizes AQI history using interactive charts.
- **Multi-Source Data**: Aggregates data from WAQI, Open-Meteo, and OpenWeatherMap.

---

## 📂 Project Structure

- **`src/components/`**: Reusable UI elements (cards, skeletons, profile chips).
- **`src/services/`**: 
    - `aqiService.ts`: The core engine for fetching and converting AQI data across multiple providers.
    - `storageService.ts`: Manages local persistence for user profiles and onboarding state.
- **`src/hooks/`**: Data-fetching hooks (`useAQI`, `useLocation`) that abstract complex logic from the UI.
- **`src/screens/`**: Main application views (Home, Forecast, Family, Trends).
- **`src/onboarding/`**: Step-by-step setup flow for new users.

---

## 🧠 Core Logic: AQI Reliability
The app implements a robust fetching strategy in `aqiService.ts`:
1.  **WAQI Primary**: Always attempts to get the nearest physical sensor reading.
2.  **Staleness Detection**: If the sensor data is >4 hours old, it marks the data as `isStale`.
3.  **Live Model Fallback**: If WAQI is offline or stale, it fetches current data from the **Open-Meteo atmospheric model** as a reliable baseline.
4.  **Local Context**: Uses `expo-location` to provide hyper-local readings.

---

## 🛠 Setup & Development
1.  **Prerequisites**: Node.js, Expo CLI.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Variables**: Create a `.env` file with:
    ```bash
    EXPO_PUBLIC_WAQI_TOKEN=your_token
    EXPO_PUBLIC_OWM_TOKEN=your_token
    ```
4.  **Run Application**:
    ```bash
    npx expo start
    ```

---

## ⚠️ Notes for Agents/Developers
- **Profile Sensitivity**: Guidance logic in `src/constants/thresholds.ts` is highly dependent on the "active profiles" found in state. 
- **Distance Logic**: The app considers a station "nearby" if it is within 100km. If further, it attempts city-name resolution for better accuracy.
