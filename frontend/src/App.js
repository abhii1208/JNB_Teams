import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CssBaseline, GlobalStyles, ThemeProvider, createTheme } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import Auth from './Auth';
import Landing from './Landing';
import LandingPage from './pages/LandingPage';
import PublicSharePage from './components/ShareLinks/PublicSharePage';
import BillingCheckout from './components/Billing/BillingCheckout';
import AppLaunchScreen from './components/Brand/AppLaunchScreen';
import { clearStoredAuth } from './apiClient';

const THEME_PREFERENCE_KEY = 'jnb_theme_preference';
const readInitialThemePreference = () => {
  try {
    const saved = localStorage.getItem(THEME_PREFERENCE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
  } catch (_err) {
    // Ignore localStorage issues and fall back.
  }
  return 'light';
};

function App() {
  const [userId, setUserId] = useState(null);
  const [unauthScreen, setUnauthScreen] = useState('auth'); // welcome | auth
  const [authInitialStep, setAuthInitialStep] = useState('password-login');
  const [pendingPurchase, setPendingPurchase] = useState(null); // { planSlug, seats }
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const [themePreference, setThemePreference] = useState(readInitialThemePreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const shareSlug = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const match = window.location.pathname.match(/^\/share\/([^/]+)/);
    return match ? match[1] : null;
  }, []);
  const themeMode = themePreference === 'auto'
    ? (systemPrefersDark ? 'dark' : 'light')
    : themePreference;

  useEffect(() => {
    try {
      localStorage.setItem(THEME_PREFERENCE_KEY, themePreference);
    } catch (_err) {
      // Ignore persistence failures.
    }
  }, [themePreference]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemPrefersDark(event.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const applyAuthUrl = (urlString) => {
    const parsedUrl = new URL(urlString, window.location.origin);
    const params = parsedUrl.searchParams;
    const token = params.get('token');
    const id = params.get('id');
    const googleSignup = params.get('google_signup');

    if (token && id) {
      localStorage.setItem('authToken', token);
      localStorage.setItem('rememberedUserId', id);
      setUserId(Number(id));
      setUnauthScreen('auth');
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }

    if (googleSignup === '1') {
      setAuthInitialStep('google-username');
      setUnauthScreen('auth');
      window.history.replaceState({}, document.title, `/?${params.toString()}`);
      return true;
    }

    if (params.get('error') === 'google') {
      setAuthInitialStep('password-login');
      setUnauthScreen('auth');
      setAuthErrorMessage('Google sign-in could not be completed. Please choose the correct account and try again.');
      window.history.replaceState({}, document.title, '/');
      return true;
    }

    return false;
  };

  const buildRootHistoryState = useCallback((overrides = {}) => ({
    appRoot: true,
    userId,
    unauthScreen,
    authInitialStep,
    pendingPurchase,
    ...overrides,
  }), [userId, unauthScreen, authInitialStep, pendingPurchase]);

  const getPersistedUserId = useCallback(() => {
    const storedUserId = localStorage.getItem('rememberedUserId');
    const parsedUserId = storedUserId ? Number(storedUserId) : null;
    return Number.isFinite(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;
  }, []);

  useEffect(() => {
    applyAuthUrl(window.location.href);
  }, [buildRootHistoryState]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowLaunchScreen(false), 2200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const handleIncomingUrl = async ({ url }) => {
      if (!url) return;

      const wasHandled = applyAuthUrl(url);
      if (wasHandled) {
        try {
          await Browser.close();
        } catch (_err) {
          // Browser may already be closed depending on platform timing.
        }
      }
    };

    const setup = async () => {
      const launchUrl = await CapacitorApp.getLaunchUrl();
      if (launchUrl?.url) {
        await handleIncomingUrl({ url: launchUrl.url });
      }
    };

    const listenerPromise = CapacitorApp.addListener('appUrlOpen', handleIncomingUrl);
    setup();

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);

  useEffect(() => {
    const storedUserId = localStorage.getItem('rememberedUserId');
    if (storedUserId) {
      setUserId(Number(storedUserId));
    }
  }, []);

  useEffect(() => {
    const currentState = window.history.state;
    if (currentState?.appRoot) return;

    window.history.replaceState(
      buildRootHistoryState(),
      document.title
    );
  }, [buildRootHistoryState]);

  useEffect(() => {
    const handleAuthExpired = (event) => {
      clearStoredAuth();
      setUserId(null);
      setUnauthScreen('auth');
      setPendingPurchase(null);
      setAuthInitialStep('password-login');
      setAuthErrorMessage(event?.detail?.message || 'Your session expired. Please sign in again.');
      window.history.replaceState(
        buildRootHistoryState({
          userId: null,
          unauthScreen: 'auth',
          authInitialStep: 'password-login',
          pendingPurchase: null,
        }),
        document.title
      );
    };

    window.addEventListener('app-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('app-auth-expired', handleAuthExpired);
  }, [buildRootHistoryState]);

  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state;
      const persistedUserId = getPersistedUserId();
      const activeUserId = userId || persistedUserId;

      if (!state) {
      if (activeUserId) {
        window.history.replaceState(
          buildRootHistoryState({
            userId: activeUserId,
            unauthScreen: 'auth',
            authInitialStep: 'password-login',
            pendingPurchase,
          }),
          document.title
          );
          if (!userId) setUserId(activeUserId);
          return;
        }

        if (!userId) {
          setUnauthScreen('auth');
          setAuthInitialStep('password-login');
          setPendingPurchase(null);
        }
        return;
      }

      if (state.appView === 'main-layout') {
        if (state.userId || activeUserId) {
          setUserId(state.userId || activeUserId);
        }
        return;
      }

      if (!state.appRoot) return;

        if (activeUserId && !state.userId) {
        window.history.replaceState(
          buildRootHistoryState({
            userId: activeUserId,
            unauthScreen: 'auth',
            authInitialStep: 'password-login',
            pendingPurchase,
          }),
          document.title
        );
        if (!userId) setUserId(activeUserId);
        return;
      }

      setUserId(state.userId || null);
      setUnauthScreen(state.unauthScreen || 'welcome');
      setAuthInitialStep(state.authInitialStep || 'password-login');
      setPendingPurchase(state.pendingPurchase || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [userId, pendingPurchase, buildRootHistoryState, getPersistedUserId]);

  useEffect(() => {
    if (userId) {
      window.history.replaceState(
        buildRootHistoryState({ userId, unauthScreen: 'auth', pendingPurchase }),
        document.title
      );
      return;
    }

    const currentState = window.history.state;
    if (!currentState?.appRoot) return;

    window.history.replaceState(
      buildRootHistoryState(),
      document.title
    );
  }, [userId, unauthScreen, authInitialStep, pendingPurchase, buildRootHistoryState]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let backButtonHandle;
    let touchStartX = 0;
    let touchStartY = 0;
    let trackingEdgeSwipe = false;

    const handleTouchStart = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      trackingEdgeSwipe = touchStartX <= 28;
    };

    const handleTouchEnd = (event) => {
      if (!trackingEdgeSwipe) return;

      const touch = event.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartX;
      const deltaY = Math.abs(touch.clientY - touchStartY);
      trackingEdgeSwipe = false;

      if (deltaX < 90 || deltaY > 60) return;
      if (window.history.length <= 1) return;

      window.history.back();
    };

    const setup = async () => {
      backButtonHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        const path = window.location.pathname;
        const isRootScreen = path === '/' || path.startsWith('/share/');

        if (canGoBack) {
          window.history.back();
          return;
        }

        if (!isRootScreen && window.history.length > 1) {
          window.history.back();
          return;
        }

        CapacitorApp.exitApp();
      });
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    setup();

    return () => {
      backButtonHandle?.remove();
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const handleLogin = (id) => {
    setUserId(id);
    setPendingPurchase(null);
    setUnauthScreen('auth');
    setAuthInitialStep('password-login');
    window.history.replaceState(
      buildRootHistoryState({
        userId: id,
        unauthScreen: 'auth',
        authInitialStep: 'password-login',
        pendingPurchase: null,
      }),
      document.title
    );
  };

  const handleLogout = () => {
    clearStoredAuth();
    setUserId(null);
    setUnauthScreen('auth');
    setAuthErrorMessage('');
    setPendingPurchase(null);
    window.history.replaceState(
      buildRootHistoryState({
        userId: null,
        unauthScreen: 'auth',
        authInitialStep: 'password-login',
        pendingPurchase: null,
      }),
      document.title
    );
  };

  const showLogin = () => {
    setAuthInitialStep('password-login');
    setUnauthScreen('auth');
    window.history.pushState(
      buildRootHistoryState({
        userId: null,
        unauthScreen: 'auth',
        authInitialStep: 'password-login',
      }),
      document.title
    );
  };

  const showFreeTrial = () => {
    setAuthInitialStep('signup');
    setUnauthScreen('auth');
    window.history.pushState(
      buildRootHistoryState({
        userId: null,
        unauthScreen: 'auth',
        authInitialStep: 'signup',
      }),
      document.title
    );
  };

  const startPaidCheckout = (planSlug, seats) => {
    const nextPurchase = { planSlug, seats };
    setPendingPurchase(nextPurchase);
    setAuthInitialStep('password-login');
    setUnauthScreen('auth');
    window.history.pushState(
      buildRootHistoryState({
        userId: null,
        unauthScreen: 'auth',
        authInitialStep: 'password-login',
        pendingPurchase: nextPurchase,
      }),
      document.title
    );
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: { main: '#0f766e' },
          secondary: { main: '#f59e0b' },
          background:
            themeMode === 'dark'
              ? { default: '#0f172a', paper: '#111b2d' }
              : { default: '#f8fafc', paper: '#ffffff' },
          text:
            themeMode === 'dark'
              ? { primary: '#e2e8f0', secondary: '#94a3b8' }
              : { primary: '#0f172a', secondary: '#475569' },
        },
        shape: { borderRadius: 16 },
        typography: {
          fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
          h3: { fontWeight: 700 },
          h4: { fontWeight: 700 },
          h6: { fontWeight: 600 },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 14,
                textTransform: 'none',
                fontWeight: 700,
                minHeight: 44,
                boxShadow: 'none',
              },
              contained: {
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.10)',
              },
            },
          },
          MuiTextField: {
            defaultProps: {
              variant: 'outlined',
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                backgroundColor: themeMode === 'dark' ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.92)',
              },
              input: {
                paddingTop: 14,
                paddingBottom: 14,
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 20,
                boxShadow: themeMode === 'dark' ? '0 12px 30px rgba(2,6,23,0.38)' : '0 14px 38px rgba(15, 23, 42, 0.08)',
                border: themeMode === 'dark' ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid rgba(148, 163, 184, 0.14)',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              rounded: {
                borderRadius: 18,
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 999,
                fontWeight: 700,
              },
            },
          },
        },
      }),
    [themeMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          ':root': {
            '--safe-area-top': 'env(safe-area-inset-top, 0px)',
            '--safe-area-bottom': 'env(safe-area-inset-bottom, 0px)',
            colorScheme: themeMode,
          },
          'html, body, #root': {
            minHeight: '100%',
            background:
              themeMode === 'dark'
                ? 'linear-gradient(180deg, #0b1220 0%, #111827 100%)'
                : 'linear-gradient(180deg, #f8fbfd 0%, #edf4f8 100%)',
          },
          body: {
            overscrollBehaviorY: 'none',
          },
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
        <AppLaunchScreen visible={showLaunchScreen} />
        {shareSlug ? (
          <PublicSharePage slug={shareSlug} />
        ) : (
          userId ? (
            <>
            <Landing
              userId={userId}
              onLogout={handleLogout}
              themePreference={themePreference}
              onThemePreferenceChange={setThemePreference}
            />
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
              <Auth
                key={`${authInitialStep}:${authErrorMessage}`}
                onLogin={handleLogin}
                initialStep={authInitialStep}
                authErrorMessage={authErrorMessage}
                onAuthErrorShown={() => setAuthErrorMessage('')}
              />
            )
          )
        )}
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;
