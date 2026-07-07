import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './components/layout/Toast';
import { LevelUpProvider } from './components/shared/LevelUpModal';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <LevelUpProvider>
        <App />
      </LevelUpProvider>
    </ToastProvider>
  </React.StrictMode>
);
