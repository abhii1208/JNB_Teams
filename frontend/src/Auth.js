import React, { useEffect, useState } from 'react';
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
  TextField,
  Typography,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from 'notistack';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Auth({ onLogin }) {
  const { enqueueSnackbar } = useSnackbar();

  const [step, setStep] = useState('password-login');
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
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleSignup = params.get('google_signup');

    if (googleSignup === '1') {
      const emailParam = params.get('email') || '';
      const firstParam = params.get('first_name') || '';
      const lastParam = params.get('last_name') || '';

      setEmail(decodeURIComponent(emailParam));
      setFirstName(decodeURIComponent(firstParam));
      setLastName(decodeURIComponent(lastParam));
      setStep('google-username');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  useEffect(() => {
    if (step !== 'set-credentials' && step !== 'google-username') return;

    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameError('');
      setUsernameChecking(false);
      return;
    }

    if (!USERNAME_REGEX.test(trimmed)) {
      setUsernameError('Use 3+ chars: letters, numbers, underscore.');
      setUsernameChecking(false);
      return;
    }

    let cancelled = false;
    setUsernameChecking(true);

    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/check-username', {
          params: { username: trimmed },
        });

        if (cancelled) return;

        if (res.data && typeof res.data.exists !== 'undefined') {
          setUsernameError(res.data.exists ? 'This username is already taken' : '');
        } else {
          setUsernameError('');
        }
      } catch (err) {
        if (!cancelled) setUsernameError('');
      } finally {
        if (!cancelled) setUsernameChecking(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, step]);

  const handleGoogleLogin = () => {
    window.location.href = `${api.defaults.baseURL}/auth/google`;
  };

  const handleCheckEmail = async () => {
    const trimmed = email.trim();

    if (!trimmed) {
      setEmailError('');
      return;
    }

    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError('Enter a valid email address');
      return;
    }

    setEmailChecking(true);
    try {
      const res = await api.get('/api/check-email', { params: { email: trimmed } });
      if (res.data && typeof res.data.exists !== 'undefined') {
        setEmailError(res.data.exists ? 'An account with this email already exists.' : '');
      } else {
        setEmailError('');
      }
    } catch (err) {
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
        const checkRes = await api.get('/api/check-email', { params: { email: trimmed } });
        if (checkRes.data?.exists) {
          setEmailError('An account with this email already exists.');
          enqueueSnackbar('This email is already registered', { variant: 'error' });
          return;
        }
      }

      if (nextStep === 'forgot-otp' && !isResend) {
        const checkRes = await api.get('/api/check-email', { params: { email: trimmed } });
        if (!checkRes.data?.exists) {
          enqueueSnackbar('No account found for this email', { variant: 'error' });
          return;
        }
      }

      await api.post('/api/send-otp', { email: trimmed });
      enqueueSnackbar(isResend ? 'OTP resent' : 'OTP sent', { variant: 'success' });
      setStep(nextStep);
      setResendTimer(60);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.error || 'Failed to send OTP', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignupOtp = async () => {
    if (!otp.trim()) {
      enqueueSnackbar('Enter the OTP', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/verify-otp', { email: email.trim(), otp: otp.trim() });
      setOtp('');
      setStep('set-credentials');
    } catch (err) {
      enqueueSnackbar(err.response?.data?.error || 'Invalid OTP', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyForgotOtp = async () => {
    if (!otp.trim()) {
      enqueueSnackbar('Enter the OTP', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/verify-otp', { email: email.trim(), otp: otp.trim() });
      setOtp('');
      setStep('reset-password');
    } catch (err) {
      enqueueSnackbar(err.response?.data?.error || 'Invalid OTP', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 8) {
      enqueueSnackbar('Password must be at least 8 characters', { variant: 'warning' });
      return;
    }

    if (password !== confirmPassword) {
      enqueueSnackbar('Passwords do not match', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/reset-password', { email: email.trim(), password });
      enqueueSnackbar('Password updated. Please log in.', { variant: 'success' });
      setPassword('');
      setConfirmPassword('');
      setStep('password-login');
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
      const res = await api.post('/api/login', { username: identifier, password });
      const { id, token } = res.data;
      localStorage.setItem('rememberedUserId', String(id));
      localStorage.setItem('authToken', token);
      enqueueSnackbar('Logged in successfully', { variant: 'success' });
      onLogin(id);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.error || 'Invalid credentials', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignup = async () => {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      enqueueSnackbar('Enter a valid email address', { variant: 'warning' });
      return;
    }

    if (!USERNAME_REGEX.test(trimmedUsername)) {
      enqueueSnackbar('Username must be 3+ chars and use letters, numbers, underscores', { variant: 'warning' });
      return;
    }

    if (usernameError) {
      enqueueSnackbar(usernameError, { variant: 'warning' });
      return;
    }

    if (step === 'set-credentials') {
      if (password.length < 8) {
        enqueueSnackbar('Password must be at least 8 characters', { variant: 'warning' });
        return;
      }

      if (password !== confirmPassword) {
        enqueueSnackbar('Passwords do not match', { variant: 'warning' });
        return;
      }

      if (!agreeTerms) {
        enqueueSnackbar('Please agree to the terms', { variant: 'warning' });
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        email: trimmedEmail,
        username: trimmedUsername,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      };

      if (step === 'set-credentials') {
        payload.password = password;
      }

      const res = await api.post('/api/complete-signup', payload);
      const { id, token } = res.data;
      localStorage.setItem('rememberedUserId', String(id));
      localStorage.setItem('authToken', token);
      enqueueSnackbar('Welcome!', { variant: 'success' });
      onLogin(id);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.error || 'Signup failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setStep('password-login');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 15% 20%, rgba(13, 148, 136, 0.16), transparent 55%), radial-gradient(circle at 85% 10%, rgba(14, 116, 144, 0.12), transparent 45%), linear-gradient(135deg, #f8fafc, #eef2f7)',
        padding: { xs: 2, md: 4 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 460,
          padding: { xs: 3.5, md: 4.5 },
          borderRadius: 4,
          border: '1px solid rgba(148, 163, 184, 0.25)',
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 28px 70px rgba(15, 23, 42, 0.14)',
          backdropFilter: 'blur(10px)',
          animation: 'fadeUp 0.6s ease',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 54,
              height: 54,
              borderRadius: 2.5,
              mx: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
              color: '#fff',
              fontWeight: 700,
              letterSpacing: '0.04em',
              mb: 1.5,
            }}
          >
            TP
          </Box>
          <Typography variant="h4">Team Portal</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Secure access to the next release
          </Typography>
        </Box>

        {step === 'password-login' && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Log in
            </Typography>
            <TextField
              label="Username or email"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              fullWidth
              margin="normal"
              autoFocus
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handlePasswordLogin}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={22} /> : 'Log in'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<GoogleIcon />}
              onClick={handleGoogleLogin}
              disabled={loading}
              sx={{ mt: 1.5 }}
            >
              Continue with Google
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={() => setStep('forgot-password')}
              sx={{ mt: 1.5 }}
            >
              Forgot password?
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={() => setStep('signup')}
            >
              Create an account
            </Button>
          </>
        )}

        {step === 'signup' && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Create your account
            </Typography>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<GoogleIcon />}
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? <CircularProgress size={22} /> : 'Sign up with Google'}
            </Button>
            <Divider sx={{ my: 2.5 }}>or</Divider>
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              onBlur={handleCheckEmail}
              error={Boolean(emailError)}
              helperText={
                emailChecking
                  ? 'Checking availability...'
                  : emailError || 'We will send a verification code to this email'
              }
              fullWidth
              margin="normal"
              disabled={loading}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => handleSendOtp('otp', false)}
              disabled={loading || Boolean(emailError)}
              sx={{ mt: 1 }}
            >
              Send verification code
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={goToLogin}
              sx={{ mt: 1.5 }}
            >
              Already have an account? Log in
            </Button>
          </>
        )}

        {step === 'otp' && (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Verify your email
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the code sent to {email}
            </Typography>
            <TextField
              label="OTP code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              fullWidth
              margin="normal"
              autoFocus
              inputProps={{ inputMode: 'numeric' }}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleVerifySignupOtp}
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={22} /> : 'Verify code'}
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={() => handleSendOtp('otp', true)}
              disabled={loading || resendTimer > 0}
              sx={{ mt: 1 }}
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={() => setStep('signup')}
              sx={{ mt: 0.5 }}
            >
              Back
            </Button>
          </>
        )}

        {step === 'set-credentials' && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Set your username
            </Typography>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={Boolean(usernameError)}
              helperText={
                usernameChecking
                  ? 'Checking availability...'
                  : usernameError || 'Use letters, numbers, underscore (3+ chars)'
              }
              fullWidth
              margin="normal"
            />
            <TextField
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
              }
              label="I agree to the terms and privacy policy"
              sx={{ mt: 1 }}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleCompleteSignup}
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={22} /> : 'Create account'}
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={goToLogin}
              sx={{ mt: 1 }}
            >
              Back to login
            </Button>
          </>
        )}

        {step === 'forgot-password' && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Reset your password
            </Typography>
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              margin="normal"
              autoFocus
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => handleSendOtp('forgot-otp', false)}
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={22} /> : 'Send reset code'}
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={goToLogin}
              sx={{ mt: 1.5 }}
            >
              Back to login
            </Button>
          </>
        )}

        {step === 'forgot-otp' && (
          <>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Verify reset code
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter the code sent to {email}
            </Typography>
            <TextField
              label="OTP code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              fullWidth
              margin="normal"
              autoFocus
              inputProps={{ inputMode: 'numeric' }}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleVerifyForgotOtp}
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={22} /> : 'Verify code'}
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={() => handleSendOtp('forgot-otp', true)}
              disabled={loading || resendTimer > 0}
              sx={{ mt: 1 }}
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={goToLogin}
              sx={{ mt: 0.5 }}
            >
              Back to login
            </Button>
          </>
        )}

        {step === 'reset-password' && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Set a new password
            </Typography>
            <TextField
              label="New password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm new password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      edge="end"
                      size="small"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleResetPassword}
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={22} /> : 'Update password'}
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={goToLogin}
              sx={{ mt: 1 }}
            >
              Back to login
            </Button>
          </>
        )}

        {step === 'google-username' && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Finish setup
            </Typography>
            <TextField
              label="Email"
              value={email}
              fullWidth
              margin="normal"
              disabled
            />
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={Boolean(usernameError)}
              helperText={
                usernameChecking
                  ? 'Checking availability...'
                  : usernameError || 'Use letters, numbers, underscore (3+ chars)'
              }
              fullWidth
              margin="normal"
              autoFocus
            />
            <TextField
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              margin="normal"
            />
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleCompleteSignup}
              disabled={loading}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={22} /> : 'Complete signup'}
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default Auth;
