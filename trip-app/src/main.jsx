import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Follow the phone's light/dark setting.
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', mq.matches);
applyTheme();
mq.addEventListener('change', applyTheme);

// Makes the app installable ("加到主屏幕") and an Android share target.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
