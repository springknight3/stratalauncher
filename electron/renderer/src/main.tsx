import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import App from './App';
import './index.css';

// Theme (dark/light class) is applied by the appearance store: OS preference
// first, then the persisted ThemeSettings value via IPC.

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Missing #root element');
}

// StrictMode is intentionally omitted: its dev double-mount replays the
// beUI overlay entrance animations (visible as a doubled open animation).
createRoot(container).render(
  <MemoryRouter>
    <App />
  </MemoryRouter>,
);

// The static index.html boot splash covers the pre-bundle black frame; the
// React StartupOverlay is now mounted and takes over the same screen.
document.getElementById('boot-splash')?.remove();
