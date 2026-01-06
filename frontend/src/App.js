import React, { useEffect, useMemo, useState } from 'react';
import { CssBaseline, GlobalStyles, ThemeProvider, createTheme } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import Auth from './Auth';
import Landing from './Landing';

function App() {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const id = params.get('id');

    if (token && id) {
      localStorage.setItem('authToken', token);
      localStorage.setItem('rememberedUserId', id);
      setUserId(Number(id));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const storedUserId = localStorage.getItem('rememberedUserId');
    if (storedUserId) {
      setUserId(Number(storedUserId));
    }
  }, []);

  const handleLogin = (id) => {
    setUserId(id);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('rememberedUserId');
    setUserId(null);
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'light',
          primary: { main: '#0f766e' },
          secondary: { main: '#f59e0b' },
          background: { default: '#f8fafc', paper: '#ffffff' },
          text: { primary: '#0f172a', secondary: '#475569' },
        },
        shape: { borderRadius: 16 },
        typography: {
          fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
          h3: { fontWeight: 700 },
          h4: { fontWeight: 700 },
          h6: { fontWeight: 600 },
        },
      }),
    []
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          '.MuiPaper-root': {
            borderRadius: 16,
          },
        }}
      />
      <SnackbarProvider
        maxSnack={3}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {userId ? (
          <Landing userId={userId} onLogout={handleLogout} />
        ) : (
          <Auth onLogin={handleLogin} />
        )}
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
