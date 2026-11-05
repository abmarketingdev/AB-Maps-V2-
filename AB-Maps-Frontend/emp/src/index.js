import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import CourseGate from './components/CourseGate';
import { getAccessToken } from './utils/tokenSync';
import './style.css';
import 'leaflet/dist/leaflet.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <CourseGate getToken={getAccessToken} baseUrl={process.env.REACT_APP_BACKEND_URL}>
      <App />
    </CourseGate>
  </React.StrictMode>
);