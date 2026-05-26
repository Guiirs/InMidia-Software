// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './foundation/index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
const { default: App } = await import('./App.jsx');
const { BrowserRouter } = await import('react-router-dom');
const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
const { ReactQueryDevtools } = await import('@tanstack/react-query-devtools');
const { ThemeProvider } = await import('@mui/material/styles');
const { default: CssBaseline } = await import('@mui/material/CssBaseline');
const { AuthProvider } = await import('./context/AuthContext');
const { SyncCoreProvider } = await import('./core/sync-core/SyncCoreProvider.jsx');
const { ConfirmationProvider } = await import('./context/ConfirmationContext');
const { lightTheme } = await import('./design/index.js');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: true,
    },
  },
});

root.render(
  <React.StrictMode>
    <ThemeProvider theme={lightTheme}>
      <CssBaseline enableColorScheme />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <SyncCoreProvider>
              <ConfirmationProvider>
                <App />
              </ConfirmationProvider>
            </SyncCoreProvider>
          </AuthProvider>
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
