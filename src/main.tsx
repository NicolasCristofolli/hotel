// Must run first: takes invite tokens out of the URL hash before the router reads it.
import './lib/authLinks';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installDesktopHorizontalScroll } from './lib/desktopScroll';
import './styles.css';
import './admin/admin.css';

installDesktopHorizontalScroll();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
