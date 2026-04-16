import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from './apiClient';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useSnackbar } from 'notistack';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { GoogleSignIn } from 'capacitor-google-sign-in';
import { JnbBrandLockup } from './components/Brand/JnbBrand';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildError = (status, data, fallback = 'Request failed') => ({
  response: { status, data: data || { error: fallback } },
  message: fallback,
});

const getGoogleAuthErrorMessage = (error) => {
  const rawMessage = String(error?.response?.data?.error || error?.message || '').toLowerCase();

  if (rawMessage.includes('cancel')) {
    return 'Google sign-in was cancelled before completion.';
  }
  if (rawMessage.includes('network')) {
    return 'Google sign-in failed because of a network issue. Please try again.';
  }
  if (rawMessage.includes('verified email')) {
    return 'That Google account does not have a verified email address.';
  }
  if (rawMessage.includes('identity audiences are not configured')) {
    return 'Google sign-in is not configured correctly yet. Please contact support.';
  }
  if (rawMessage.includes('google sign-in failed')) {
    return 'Google sign-in failed. Please use the right Google account and try again.';
  }

  return 'Google sign-in could not be completed. Please try again.';
};

function Auth({ onLogin, initialStep = 'password-login', authErrorMessage = '', onAuthErrorShown }) {
  const { enqueueSnackbar } = useSnackbar();
  const isNative = Capacitor.isNativePlatform();

  const [step, setStep] = useState(initialStep);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailChecking, setEmailChecking] = useState(false);
  const [otp, setOtp] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const request = useCallback(async (method, path, { data, params } = {}) => {
    if (!isNative) {
      return api.request({ method, url: path, data, params });
    }

    try {
      const response = await CapacitorHttp.request({
        method: method.toUpperCase(),
        url: `${api.defaults.baseURL}${path}`,
        headers: { 'Content-Type': 'application/json' },
        data,
        params,
        connectTimeout: 30000,
        readTimeout: 30000,
      });

      if (response.status >= 400) throw buildError(response.status, response.data);
      return { data: response.data, status: response.status, headers: response.headers };
    } catch (error) {
      if (error?.response) throw error;
      if (typeof error?.status === 'number') throw buildError(error.status, error.data);
      throw error;
    }
  }, [isNative]);

  const warmBackend = useCallback(async () => {
    try {
      await request('get', '/api/health');
      setBackendReady(true);
      return true;
    } catch (_err) {
      setBackendReady(false);
      return false;
    }
  }, [request]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_signup') === '1') {
      setEmail(decodeURIComponent(params.get('email') || ''));
      setFirstName(decodeURIComponent(params.get('first_name') || ''));
      setLastName(decodeURIComponent(params.get('last_name') || ''));
      setStep('google-username');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!authErrorMessage) return;
    enqueueSnackbar(authErrorMessage, { variant: 'error' });
    onAuthErrorShown?.();
  }, [authErrorMessage, enqueueSnackbar, onAuthErrorShown]);

  useEffect(() => {
    let cancelled = false;
    warmBackend().then((ok) => {
      if (!cancelled) setBackendReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [warmBackend]);

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const timer = setTimeout(() => setResendTimer((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  useEffect(() => {
    if (step !== 'set-credentials' && step !== 'google-username') return undefined;
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameError('');
      setUsernameChecking(false);
      return undefined;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameError('Use 3+ chars: letters, numbers, underscore.');
      setUsernameChecking(false);
      return undefined;
    }
    let cancelled = false;
    setUsernameChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await request('get', '/api/check-username', { params: { username: trimmed } });
        if (!cancelled) setUsernameError(res.data?.exists ? 'This username is already taken' : '');
      } catch (_err) {
        if (!cancelled) setUsernameError('');
      } finally {
        if (!cancelled) setUsernameChecking(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [request, step, username]);

  const stepMeta = useMemo(() => {
    switch (step) {
      case 'signup':
        return ['Create your account', 'Start with email or continue with Google.'];
      case 'otp':
        return ['Enter verification code', `We sent a code to ${email || 'your email'}.`];
      case 'set-credentials':
        return ['Set up your profile', 'Choose a username and secure password.'];
      case 'forgot-password':
        return ['Reset your password', 'Enter your email and we will send a code.'];
      case 'forgot-otp':
        return ['Enter reset code', `Use the code sent to ${email || 'your email'}.`];
      case 'reset-password':
        return ['Choose a new password', 'Set a fresh password for your account.'];
      case 'google-username':
        return ['Finish setup', 'Pick a username so we can create your workspace.'];
      default:
        return ['Log in to JNB Teams', 'Use your username or email to get back to work.'];
    }
  }, [email, step]);
  const goToLogin = () => {
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setStep('password-login');
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      if (isNative) {
        const nativeSignIn = await GoogleSignIn.handleSignInButton();
        const identityToken = nativeSignIn?.response?.identityToken;
        if (!identityToken) {
          throw new Error('Google sign-in did not return an identity token.');
        }

        const nativeAuth = await request('post', '/auth/google/native', {
          data: { identityToken },
        });

        if (nativeAuth.data?.token && nativeAuth.data?.id) {
          localStorage.setItem('rememberedUserId', String(nativeAuth.data.id));
          localStorage.setItem('authToken', nativeAuth.data.token);
          enqueueSnackbar('Logged in with Google', { variant: 'success' });
          onLogin(nativeAuth.data.id);
          return;
        }

        if (nativeAuth.data?.requiresProfileCompletion) {
          setEmail(nativeAuth.data.email || nativeSignIn?.response?.email || '');
          setFirstName(nativeAuth.data.first_name || nativeSignIn?.response?.givenName || '');
          setLastName(nativeAuth.data.last_name || nativeSignIn?.response?.familyName || '');
          setUsername('');
          setStep('google-username');
          enqueueSnackbar('Finish your profile to complete signup', { variant: 'info' });
          return;
        }

        throw new Error('Unexpected Google auth response from server.');
      }

      const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
      window.location.assign(`${api.defaults.baseURL}/auth/google?redirect_uri=${redirectUri}`);
    } catch (err) {
      enqueueSnackbar(getGoogleAuthErrorMessage(err), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) return setEmailError('');
    if (!EMAIL_REGEX.test(trimmed)) return setEmailError('Enter a valid email address');
    setEmailChecking(true);
    try {
      const res = await request('get', '/api/check-email', { params: { email: trimmed } });
      setEmailError(res.data?.exists ? 'An account with this email already exists.' : '');
    } catch (_err) {
      setEmailError('');
    } finally {
      setEmailChecking(false);
    }
  };

  const handleSendOtp = async (nextStep, isResend = false) => {
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      enqueueSnackbar('Enter a valid email address', { variant: 'warning' });
      return;
    }
    setLoading(true);
    try {
      if (nextStep === 'otp' && !isResend) {
        const checkRes = await request('get', '/api/check-email', { params: { email: trimmed } });
        if (checkRes.data?.exists) {
          setEmailError('An account with this email already exists.');
          enqueueSnackbar('This email is already registered', { variant: 'error' });
          return;
        }
      }
      if (nextStep === 'forgot-otp' && !isResend) {
        const checkRes = await request('get', '/api/check-email', { params: { email: trimmed } });
        if (!checkRes.data?.exists) {
          enqueueSnackbar('No account found for this email', { variant: 'error' });
          return;
        }
      }
      await request('post', '/api/send-otp', { data: { email: trimmed } });
      enqueueSnackbar(isResend ? 'OTP resent' : 'OTP sent', { variant: 'success' });
      setStep(nextStep);
      setResendTimer(60);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.error || 'Failed to send OTP', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (nextStep) => {
    if (!otp.trim()) {
      enqueueSnackbar('Enter the OTP', { variant: 'warning' });
      return;
    }
    setLoading(true);
    try {
      await request('post', '/api/verify-otp', { data: { email: email.trim(), otp: otp.trim() } });
      setOtp('');
      setStep(nextStep);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.error || 'Invalid OTP', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 8) return enqueueSnackbar('Password must be at least 8 characters', { variant: 'warning' });
    if (password !== confirmPassword) return enqueueSnackbar('Passwords do not match', { variant: 'warning' });
    setLoading(true);
    try {
      await request('post', '/api/reset-password', { data: { email: email.trim(), password } });
      enqueueSnackbar('Password updated. Please log in.', { variant: 'success' });
      goToLogin();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.error || 'Failed to reset password', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    const identifier = loginIdentifier.trim();
    if (!identifier || !password) {
      enqueueSnackbar('Enter username/email and password', { variant: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const res = await request('post', '/api/login', {
        data: { username: identifier, email: identifier, password },
      });
      localStorage.setItem('rememberedUserId', String(res.data.id));
      localStorage.setItem('authToken', res.data.token);
      enqueueSnackbar('Logged in successfully', { variant: 'success' });
      onLogin(res.data.id);
    } catch (err) {
      const message = err.response?.data?.error;
      if (!message) {
        setBackendReady(false);
      }
      if (message?.includes('Google sign-in')) {
        enqueueSnackbar(
          'This account was created with Google sign-in. Use Google sign-in or reset the password first if you want to log in with a password.',
          { variant: 'warning' }
        );
      } else {
        enqueueSnackbar(
          message || 'Unable to reach the server right now. Please wait a moment and try again.',
          { variant: 'error' }
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async () => {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) return enqueueSnackbar('Enter a valid email address', { variant: 'warning' });
    if (!USERNAME_REGEX.test(trimmedUsername)) {
      return enqueueSnackbar('Username must be 3+ chars and use letters, numbers, underscores', { variant: 'warning' });
    }
    if (usernameError) return enqueueSnackbar(usernameError, { variant: 'warning' });
    if (step === 'set-credentials') {
      if (password.length < 8) return enqueueSnackbar('Password must be at least 8 characters', { variant: 'warning' });
      if (password !== confirmPassword) return enqueueSnackbar('Passwords do not match', { variant: 'warning' });
      if (!agreeTerms) return enqueueSnackbar('Please agree to the terms', { variant: 'warning' });
    }
    setLoading(true);
    try {
      const payload = {
        email: trimmedEmail,
        username: trimmedUsername,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(step === 'set-credentials' ? { password } : {}),
      };
      const res = await request('post', '/api/complete-signup', { data: payload });
      localStorage.setItem('rememberedUserId', String(res.data.id));
      localStorage.setItem('authToken', res.data.token);
      enqueueSnackbar('Welcome!', { variant: 'success' });
      onLogin(res.data.id);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.error || 'Signup failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const passwordField = (value, setValue, label, visible, setVisible) => (
    <TextField
      label={label}
      variant="filled"
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      fullWidth
      InputLabelProps={{ shrink: true }}
      InputProps={{
        disableUnderline: true,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton onClick={() => setVisible((prev) => !prev)} edge="end" size="small">
              {visible ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiFilledInput-root': {
          borderRadius: 2.5,
          bgcolor: '#f7fafc',
          border: '1px solid rgba(148,163,184,0.28)',
        },
      }}
    />
  );

  const filledFieldSx = {
    '& .MuiFilledInput-root': {
      borderRadius: 2.5,
      bgcolor: '#f8fafc',
      border: '1px solid rgba(148,163,184,0.24)',
      transition: 'border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
      '&:hover': {
        bgcolor: '#f7fafc',
        borderColor: 'rgba(100,116,139,0.35)',
      },
      '&.Mui-focused': {
        bgcolor: '#ffffff',
        borderColor: 'rgba(15,118,110,0.72)',
        boxShadow: '0 0 0 3px rgba(15,118,110,0.12)',
      },
      '&.Mui-error': {
        borderColor: 'rgba(220,38,38,0.5)',
        boxShadow: '0 0 0 3px rgba(220,38,38,0.09)',
      },
      '&.Mui-disabled': {
        bgcolor: '#f1f5f9',
      },
    },
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, sm: 3 },
        py: { xs: 'calc(env(safe-area-inset-top, 0px) + 20px)', sm: 4 },
        background:
          'radial-gradient(circle at top left, rgba(14,165,233,0.15), transparent 28%), radial-gradient(circle at bottom right, rgba(15,118,110,0.12), transparent 24%), linear-gradient(180deg, #f7fafd 0%, #eaf1f6 100%)',
        overflowY: 'auto',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 520,
          borderRadius: { xs: 4, sm: 5 },
          overflow: 'hidden',
          border: '1px solid rgba(148,163,184,0.22)',
          boxShadow: '0 28px 56px rgba(15,23,42,0.12)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, #ffffff 100%)',
        }}
      >
        <Box
          sx={{
            px: { xs: 2.2, sm: 3 },
            pt: { xs: 'calc(env(safe-area-inset-top, 0px) + 18px)', sm: 2.8 },
            pb: 2.2,
            color: '#0f172a',
            background: 'linear-gradient(180deg, #f8fcfe 0%, #eef5f9 100%)',
            borderBottom: '1px solid rgba(148,163,184,0.16)',
          }}
        >
          <Stack
            direction="column"
            justifyContent="center"
            alignItems="center"
            spacing={1}
            sx={{ width: '100%' }}
          >
            <Box sx={{ minWidth: 0, width: '100%' }}>
              <Box
                sx={{
                  lineHeight: 0,
                  mb: 0.9,
                  width: { xs: 220, sm: 260 },
                  mx: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <JnbBrandLockup />
              </Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 800,
                  mt: 0.2,
                  lineHeight: 1.08,
                  fontSize: { xs: 26, sm: 29 },
                  textAlign: 'center',
                  letterSpacing: '-0.02em',
                }}
              >
                {step === 'password-login' ? 'Welcome back' : stepMeta[0]}
              </Typography>
              <Typography sx={{ mt: 0.5, color: '#475569', fontSize: 14.5, textAlign: 'center' }}>
                {step === 'password-login' ? 'Sign in to continue securely.' : stepMeta[1]}
              </Typography>
            </Box>
            {step !== 'password-login' && step !== 'signup' ? (
              <IconButton
                onClick={goToLogin}
                sx={{ color: '#0f766e', border: '1px solid rgba(15,118,110,0.22)', bgcolor: '#fff', mt: 0.2 }}
              >
                <ArrowBackRoundedIcon />
              </IconButton>
            ) : null}
          </Stack>
        </Box>

        <Box sx={{ px: { xs: 2.1, sm: 3.2 }, py: { xs: 2.1, sm: 2.8 } }}>
          <Stack
            direction="column"
            spacing={1.6}
            sx={{ minHeight: 0 }}
          >

                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', p: 0, mx: 'auto', maxWidth: '100%' }}>
              <Stack spacing={1.4}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.35, py: 1, borderRadius: 2.4, bgcolor: backendReady ? 'rgba(15,118,110,0.08)' : 'rgba(245,158,11,0.12)', color: backendReady ? '#0f766e' : '#92400e' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: backendReady ? '#14b8a6' : '#f59e0b' }} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{backendReady ? 'Secure connection active' : 'Connecting to secure server'}</Typography>
                </Stack>

                <Typography sx={{ color: '#0f766e', fontSize: 13, fontWeight: 700, px: 0.2, mt: 0.2 }}>
                  Fast login, persistent session, and in-app Google auth.
                </Typography>

                {step === 'password-login' && (
                  <>
                    <TextField label="Username or email" variant="filled" value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value)} fullWidth autoFocus InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    {passwordField(password, setPassword, 'Password', showPassword, setShowPassword)}
                    <Button variant="contained" fullWidth size="large" onClick={handlePasswordLogin} disabled={loading} sx={{ textTransform: 'none', borderRadius: 2.8, py: 1.28, fontWeight: 800, fontSize: 19, background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)', boxShadow: '0 16px 30px rgba(15,118,110,0.24)', '&:hover': { background: 'linear-gradient(135deg, #0c6a63 0%, #0284c7 100%)' }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.84)', background: 'linear-gradient(135deg, rgba(15,118,110,0.68), rgba(8,145,178,0.65))' } }}>{loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Log in'}</Button>
                    <Button variant="contained" fullWidth size="large" startIcon={<GoogleIcon />} onClick={handleGoogleLogin} disabled={loading} sx={{ textTransform: 'none', borderRadius: 2.8, py: 1.1, fontWeight: 700, bgcolor: '#ffffff', color: '#0f766e', border: '1px solid rgba(15,118,110,0.28)', boxShadow: 'none', '&:hover': { bgcolor: '#f8fafc', boxShadow: 'none' } }}>Continue with Google</Button>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0.25, flexWrap: 'wrap', rowGap: 0.5, pt: 0.1 }}>
                      <Button variant="text" onClick={() => setStep('signup')} sx={{ textTransform: 'none', minWidth: 0, px: 0.5, color: '#0f766e', fontWeight: 700 }}>Create account</Button>
                      <Button variant="text" onClick={() => setStep('forgot-password')} sx={{ textTransform: 'none', minWidth: 0, px: 0.5, color: '#0f766e', fontWeight: 700 }}>Forgot password?</Button>
                    </Stack>
                  </>
                )}

                {step === 'signup' && (
                  <>
                    <Button variant="contained" fullWidth size="large" startIcon={<GoogleIcon />} onClick={handleGoogleLogin} disabled={loading} sx={{ textTransform: 'none', borderRadius: 3, py: 1.25, fontWeight: 700, bgcolor: '#ffffff', color: '#0f766e', border: '1px solid rgba(15,118,110,0.28)', boxShadow: 'none', '&:hover': { bgcolor: '#f8fafc', boxShadow: 'none' } }}>Sign up with Google</Button>
                    <Divider>or</Divider>
                    <TextField label="Email address" variant="filled" type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }} onBlur={handleCheckEmail} error={Boolean(emailError)} helperText={emailChecking ? 'Checking availability...' : emailError || 'We will send a verification code to this email'} fullWidth disabled={loading} InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    <Button variant="contained" fullWidth size="large" onClick={() => handleSendOtp('otp', false)} disabled={loading || Boolean(emailError)} sx={{ textTransform: 'none', borderRadius: 3, py: 1.35, fontWeight: 700, background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)' }}>Send verification code</Button>
                  </>
                )}

                {step === 'otp' && (
                  <>
                    <TextField label="OTP code" variant="filled" value={otp} onChange={(e) => setOtp(e.target.value)} fullWidth autoFocus inputProps={{ inputMode: 'numeric' }} InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    <Button variant="contained" fullWidth size="large" onClick={() => verifyOtp('set-credentials')} disabled={loading} sx={{ textTransform: 'none', borderRadius: 3, py: 1.35, fontWeight: 700 }}>{loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Verify code'}</Button>
                    <Button variant="text" fullWidth onClick={() => handleSendOtp('otp', true)} disabled={loading || resendTimer > 0} sx={{ textTransform: 'none' }}>{resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}</Button>
                  </>
                )}

                {step === 'set-credentials' && (
                  <>
                    <TextField label="Username" variant="filled" value={username} onChange={(e) => setUsername(e.target.value)} error={Boolean(usernameError)} helperText={usernameChecking ? 'Checking availability...' : usernameError || 'Use letters, numbers, underscore (3+ chars)'} fullWidth InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <TextField label="First name" variant="filled" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                      <TextField label="Last name" variant="filled" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    </Stack>
                    {passwordField(password, setPassword, 'Password', showPassword, setShowPassword)}
                    {passwordField(confirmPassword, setConfirmPassword, 'Confirm password', showConfirmPassword, setShowConfirmPassword)}
                    <FormControlLabel control={<Checkbox checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />} label="I agree to the terms and privacy policy" />
                    <Button variant="contained" fullWidth size="large" onClick={handleCompleteSignup} disabled={loading} sx={{ textTransform: 'none', borderRadius: 3, py: 1.35, fontWeight: 700 }}>{loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Create account'}</Button>
                  </>
                )}

                {step === 'forgot-password' && (
                  <>
                    <TextField label="Email address" variant="filled" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth autoFocus InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    <Button variant="contained" fullWidth size="large" onClick={() => handleSendOtp('forgot-otp', false)} disabled={loading} sx={{ textTransform: 'none', borderRadius: 3, py: 1.35, fontWeight: 700 }}>{loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Send reset code'}</Button>
                  </>
                )}

                {step === 'forgot-otp' && (
                  <>
                    <TextField label="OTP code" variant="filled" value={otp} onChange={(e) => setOtp(e.target.value)} fullWidth autoFocus inputProps={{ inputMode: 'numeric' }} InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    <Button variant="contained" fullWidth size="large" onClick={() => verifyOtp('reset-password')} disabled={loading} sx={{ textTransform: 'none', borderRadius: 3, py: 1.35, fontWeight: 700 }}>{loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Verify code'}</Button>
                    <Button variant="text" fullWidth onClick={() => handleSendOtp('forgot-otp', true)} disabled={loading || resendTimer > 0} sx={{ textTransform: 'none' }}>{resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}</Button>
                  </>
                )}

                {step === 'reset-password' && (
                  <>
                    {passwordField(password, setPassword, 'New password', showPassword, setShowPassword)}
                    {passwordField(confirmPassword, setConfirmPassword, 'Confirm new password', showConfirmPassword, setShowConfirmPassword)}
                    <Button variant="contained" fullWidth size="large" onClick={handleResetPassword} disabled={loading} sx={{ textTransform: 'none', borderRadius: 3, py: 1.35, fontWeight: 700 }}>{loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Update password'}</Button>
                  </>
                )}

                {step === 'google-username' && (
                  <>
                    <TextField label="Email" variant="filled" value={email} fullWidth disabled InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    <TextField label="Username" variant="filled" value={username} onChange={(e) => setUsername(e.target.value)} error={Boolean(usernameError)} helperText={usernameChecking ? 'Checking availability...' : usernameError || 'Use letters, numbers, underscore (3+ chars)'} fullWidth autoFocus InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <TextField label="First name" variant="filled" value={firstName} onChange={(e) => setFirstName(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                      <TextField label="Last name" variant="filled" value={lastName} onChange={(e) => setLastName(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} InputProps={{ disableUnderline: true }} sx={filledFieldSx} />
                    </Stack>
                    <Button variant="contained" fullWidth size="large" onClick={handleCompleteSignup} disabled={loading} sx={{ textTransform: 'none', borderRadius: 3, py: 1.35, fontWeight: 700 }}>{loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Complete signup'}</Button>
                  </>
                )}

                {step !== 'password-login' && (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                    Secure access for workspaces, approvals, and recurring workflows.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}

export default Auth;
