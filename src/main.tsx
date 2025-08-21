import { StrictMode, Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import ReactDOM from 'react-dom/client';
import './injected/virtualizer';

import Layout from '@/layout';
import './main.scss';

import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import ChatLayout from '@/layout';

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <ChatLayout />
  </HashRouter>
);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Suspense fallback={null}>
      <BrowserRouter>
        <Layout/>
      </BrowserRouter>
    </Suspense>
  </StrictMode>
);
