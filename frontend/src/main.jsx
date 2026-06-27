// src/main.jsx
import React    from 'react';
import ReactDOM from 'react-dom/client';
import App      from './App.jsx';

// Global reset
const globalStyle = document.createElement('style');
globalStyle.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f17; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #0f0f17; }
  ::-webkit-scrollbar-thumb { background: #2d2d3d; border-radius: 3px; }
`;
document.head.appendChild(globalStyle);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
