import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { OpenColorPicker } from './components/ColorPicker';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Programmatically open the color picker on app start
try {
  // small timeout to ensure DOM is ready
  setTimeout(() => {
    OpenColorPicker();
  }, 50);
} catch (e) {}
