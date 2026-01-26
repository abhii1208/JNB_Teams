import React, { useEffect, useMemo, useState } from 'react';
import { CssBaseline, GlobalStyles, ThemeProvider, createTheme } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import Auth from './Auth';
import Landing from './Landing';
import LandingPage from './pages/LandingPage';
import PublicSharePage from './components/ShareLinks/PublicSharePage';
import BillingCheckout from './components/Billing/BillingCheckout';

function App() {
  const [userId, setUserId] = useState(null);
  const [unauthScreen, setUnauthScreen] = useState('welcome'); // welcome | auth
  const [authInitialStep, setAuthInitialStep] = useState('password-login');
  const [pendingPurchase, setPendingPurchase] = useState(null); // { planSlug, seats }
  const shareSlug = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const match = window.location.pathname.match(/^\/share\/([^/]+)/);
    return match ? match[1] : null;
  }, []);

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
    setUnauthScreen('welcome');
  };

  const showLogin = () => {
    setAuthInitialStep('password-login');
    setUnauthScreen('auth');
  };

  const showFreeTrial = () => {
    setAuthInitialStep('signup');
    setUnauthScreen('auth');
  };

  const startPaidCheckout = (planSlug, seats) => {
    setPendingPurchase({ planSlug, seats });
    setAuthInitialStep('password-login');
    setUnauthScreen('auth');
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
        {shareSlug ? (
          <PublicSharePage slug={shareSlug} />
        ) : (
          userId ? (
            <>
            <Landing userId={userId} onLogout={handleLogout} />
              {pendingPurchase && (
                <BillingCheckout
                  planSlug={pendingPurchase.planSlug}
                  seats={pendingPurchase.seats}
                  onDone={() => setPendingPurchase(null)}
                />
              )}
            </>
          ) : (
            unauthScreen === 'welcome' ? (
              <LandingPage
                onLoginClick={showLogin}
                onFreeTrialClick={showFreeTrial}
                onPaidPlanCheckout={startPaidCheckout}
              />
            ) : (
              <Auth key={authInitialStep} onLogin={handleLogin} initialStep={authInitialStep} />
            )
          )
        )}
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
