import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import { initI18n } from './i18n';
import { appTheme } from './lib/theme';
import './styles/global.css';
import './styles/themes/aurora.css';

initI18n();

document.documentElement.dataset.theme = appTheme === 'aurora' ? 'aurora' : 'classic';
if (appTheme === 'aurora') {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#080910');
  document.title = 'TetherChat Aurora (макет)';
}

const container = document.getElementById('root');
if (!container) throw new Error('Root container is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
