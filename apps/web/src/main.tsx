import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import { initI18n } from './i18n';
import { appTheme, themeColor, themeTitle } from './lib/theme';
import './styles/global.css';
import './styles/themes/aurora.css';
import './styles/themes/graphite.css';

initI18n();

document.documentElement.dataset.theme = appTheme;
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor[appTheme]);
document.title = themeTitle[appTheme];

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
