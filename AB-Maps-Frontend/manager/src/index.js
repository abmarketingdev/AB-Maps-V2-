import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './style.css';
import './App.css';
import 'leaflet/dist/leaflet.css';
// Imported LAST on purpose: mobile.css only contains max-width overrides and
// must come after leaflet.css + style.css to win ties. Delete this line to
// revert the entire mobile pass.
import './mobile.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);