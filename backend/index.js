require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('./db');

// Import routes
const workspacesRouter = require('./routes/workspaces');
const projectsRouter = require('./routes/projects');
const tasksRouter = require('./routes/tasks');
const approvalsRouter = require('./routes/approvals');
const activityRouter = require('./routes/activity');
const notificationsRouter = require('./routes/notifications');
const userRouter = require('./routes/user');
const recurringRouter = require('./routes/recurringV2');
const savedViewsRouter = require('./routes/savedViews');
const projectColumnsRouter = require('./routes/projectColumns');
const userPreferencesRouter = require('./routes/userPreferences');
const adminRouter = require('./routes/admin');
const clientsRouter = require('./routes/clients');
const shareLinksRouter = require('./routes/shareLinks');
const publicShareRouter = require('./routes/publicShare');
const billingRouter = require('./routes/billing');
const chatRouter = require('./routes/chat');
const attachmentsRouter = require('./routes/attachments');
const checklistRouter = require('./routes/checklist');
const searchRouter = require('./routes/search');
const servicesRouter = require('./routes/services');
const enterpriseRouter = require('./routes/enterprise');
const taskBulkUploadRouter = require('./routes/taskBulkUpload');

// Import WebSocket
const { initializeChatWebSocket, chatBroadcast } = require('./chatWebSocket');

// Import notification service for WebSocket integration
const { setWebSocketBroadcast } = require('./services/notificationService');

// Import background jobs
const { initializeJobs, startJobs, stopJobs } = require('./jobs');

const app = express();
const PORT = process.env.PORT || 5000;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FRONTEND_URL_LOCAL = process.env.FRONTEND_URL_LOCAL || 'http://localhost:3000';
const MOBILE_APP_URL = process.env.MOBILE_APP_URL || 'com.jnbteams.app://auth/callback';
const REDIRECT_URL = process.env.NODE_ENV === 'production' ? FRONTEND_URL : FRONTEND_URL_LOCAL;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const googleIdentityAudiences = Array.from(new Set([
  process.env.GOOGLE_SERVER_CLIENT_ID,
  process.env.GOOGLE_ANDROID_SERVER_CLIENT_ID,
  process.env.GOOGLE_CLIENT_ID,
].filter(Boolean)));
const googleTokenClient = new OAuth2Client();
const ALLOWED_ORIGINS = Array.from(new Set([
  FRONTEND_URL,
  FRONTEND_URL_LOCAL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'null',
].filter(Boolean)));

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function sanitizeRedirectUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return null;

  if (value.startsWith('com.jnbteams.app://')) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch (_err) {
    return null;
  }

  return null;
}

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

async function ensureUserHasWorkspace(userId) {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    const memberCheck = await client.query(
      'SELECT 1 FROM workspace_members WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (memberCheck.rows.length > 0) {
      return;
    }

    await client.query('BEGIN');
    transactionStarted = true;
    const wsRes = await client.query(
      'INSERT INTO workspaces (name, created_by) VALUES ($1, $2) RETURNING id',
      ['Personal', userId]
    );
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [wsRes.rows[0].id, userId, 'Owner']
    );
    await client.query('COMMIT');
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function verifyGoogleIdentityToken(identityToken) {
  if (!googleIdentityAudiences.length) {
    const error = new Error('Google identity audiences are not configured');
    error.code = 'GOOGLE_NOT_CONFIGURED';
    throw error;
  }

  const ticket = await googleTokenClient.verifyIdToken({
    idToken: identityToken,
    audience: googleIdentityAudiences,
  });
  const payload = ticket.getPayload();

  if (!payload?.email || payload.email_verified === false) {
    const error = new Error('Google account did not return a verified email');
    error.code = 'GOOGLE_EMAIL_NOT_VERIFIED';
    throw error;
  }

  return {
    email: payload.email,
    first_name: payload.given_name || '',
    last_name: payload.family_name || '',
  };
}

function authenticateToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const otpStore = new Map();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim();
}

if (googleEnabled) {
  app.use(passport.initialize());

    passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/auth/google/callback`,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;
      if (!email) return done(new Error('Google account did not return an email'));

      const displayName = profile.displayName || '';
      const nameParts = displayName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const existingRes = await pool.query(
        'SELECT id, email, username, first_name, last_name FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
      );

      if (existingRes.rows.length > 0) {
        return done(null, existingRes.rows[0]);
      }

      return done(null, {
        email,
        first_name: firstName,
        last_name: lastName,
        isNew: true,
      });
    } catch (err) {
      return done(err);
    }
  }));

  app.get('/auth/google', (req, res, next) => {
    const redirectTarget =
      sanitizeRedirectUrl(req.query.redirect_uri)
      || (req.query.mobile === '1' ? MOBILE_APP_URL : null)
      || REDIRECT_URL;

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: redirectTarget,
    })(req, res, next);
  });

    app.get('/auth/google/callback',
    (req, res, next) => {
      const redirectTarget = sanitizeRedirectUrl(req.query.state) || REDIRECT_URL;
      passport.authenticate('google', {
        session: false,
        failureRedirect: `${redirectTarget}?error=google`,
      })(req, res, next);
    },
    async (req, res) => {
      const redirectTarget = sanitizeRedirectUrl(req.query.state) || REDIRECT_URL;
      if (!req.user) {
        return res.redirect(`${redirectTarget}?error=google`);
      }

      if (req.user.id) {
        await ensureUserHasWorkspace(req.user.id);
        const token = signToken(req.user.id);
        return res.redirect(`${redirectTarget}?token=${token}&id=${req.user.id}`);
      }

      const email = encodeURIComponent(req.user.email || '');
      const firstName = encodeURIComponent(req.user.first_name || '');
      const lastName = encodeURIComponent(req.user.last_name || '');

      return res.redirect(
        `${redirectTarget}?google_signup=1&email=${email}&first_name=${firstName}&last_name=${lastName}`
      );
    }
  );
} else {
  app.get('/auth/google', (_req, res) => {
    res.status(503).send('Google auth not configured');
  });

  app.get('/auth/google/callback', (_req, res) => {
    res.status(503).send('Google auth not configured');
  });
}

app.post('/auth/google/native', authLimiter, async (req, res) => {
  const identityToken = String(req.body.identityToken || '').trim();
  if (!identityToken) {
    return res.status(400).json({ error: 'Google identity token is required' });
  }

  try {
    const googleProfile = await verifyGoogleIdentityToken(identityToken);
    const existingRes = await pool.query(
      'SELECT id, email, username, first_name, last_name FROM users WHERE LOWER(email) = LOWER($1)',
      [googleProfile.email]
    );

    if (existingRes.rows.length > 0) {
      const user = existingRes.rows[0];
      await ensureUserHasWorkspace(user.id);
      const token = signToken(user.id);
      return res.json({ id: user.id, token, username: user.username });
    }

    return res.json({
      requiresProfileCompletion: true,
      email: googleProfile.email,
      first_name: googleProfile.first_name,
      last_name: googleProfile.last_name,
    });
  } catch (err) {
    console.error('Native Google auth error:', err);
    if (err.code === 'GOOGLE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Google sign-in is not configured on the server' });
    }
    if (err.code === 'GOOGLE_EMAIL_NOT_VERIFIED') {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }
    return res.status(401).json({ error: 'Google sign-in failed. Please try again with a valid Google account.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/check-username', async (req, res) => {
  const username = normalizeUsername(req.query.username);
  if (!username) return res.json({ exists: false, error: 'Username required' });

  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    return res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    console.error('Check username error:', err);
    return res.status(500).json({ error: 'Check failed' });
  }
});

app.get('/api/check-email', async (req, res) => {
  const email = normalizeEmail(req.query.email);
  if (!email) return res.json({ exists: false, error: 'Email required' });

  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    console.error('Check email error:', err);
    return res.status(500).json({ error: 'Check failed' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  const identifierRaw = String(req.body.username || req.body.email || '').trim();
  const password = String(req.body.password || '');

  if (!identifierRaw || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  const identifier = identifierRaw.toLowerCase();

  try {
    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({
        error: 'This account uses Google sign-in. Please use "Login with Google".',
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Ensure the user has at least one workspace (create personal if missing)
    await ensureUserHasWorkspace(user.id);

    const token = signToken(user.id);
    return res.json({ id: user.id, token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/complete-signup', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const username = normalizeUsername(req.body.username);
  const password = String(req.body.password || '');
  const firstName = String(req.body.first_name || '').trim();
  const lastName = String(req.body.last_name || '').trim();

  if (!email || !username) {
    return res.status(400).json({ error: 'Email and username are required' });
  }

  if (password && password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await pool.connect();
  try {
    const existingRes = await client.query(
      'SELECT id, email, username FROM users WHERE LOWER(email) = $1 OR LOWER(username) = LOWER($2)',
      [email, username]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (existing.email && existing.email.toLowerCase() === email) {
        client.release();
        return res.status(400).json({ error: 'This email is already registered.' });
      }
      if (existing.username && existing.username.toLowerCase() === username.toLowerCase()) {
        client.release();
        return res.status(400).json({ error: 'This username is already taken.' });
      }
      client.release();
      return res.status(400).json({ error: 'Email or username already in use' });
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;

    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO users (email, username, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, username',
      [email, username, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    // create personal workspace for new user
    const wsRes = await client.query(
      'INSERT INTO workspaces (name, created_by) VALUES ($1, $2) RETURNING id, name, created_at, updated_at',
      ['Personal', user.id]
    );
    const workspace = wsRes.rows[0];
    await client.query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
      [workspace.id, user.id, 'Owner']
    );

    await client.query('COMMIT');

    const token = signToken(user.id);
    client.release();
    return res.status(201).json({ id: user.id, token, username: user.username });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Complete signup error:', err);
    return res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/send-otp', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return res.status(400).json({ error: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + 10 * 60 * 1000;
  otpStore.set(email, { otp, expires });

  console.log(`OTP for ${email}: ${otp}`);
  return res.json({ message: 'OTP sent' });
});

app.post('/api/verify-otp', authLimiter, (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();

  const entry = otpStore.get(email);
  if (!entry) return res.status(400).json({ error: 'No OTP found' });

  if (Date.now() > entry.expires) {
    otpStore.delete(email);
    return res.status(400).json({ error: 'OTP expired' });
  }

  if (entry.otp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  otpStore.delete(email);
  return res.json({ message: 'OTP verified' });
});

app.post('/api/reset-password', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!email || password.length < 8) {
    return res.status(400).json({ error: 'Email and valid password (min 8 chars) required' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2) RETURNING id',
      [hash, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, first_name, last_name, license_type FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

// Mount API routes
app.use('/api/workspaces', authenticateToken, workspacesRouter.router);
app.use('/api/projects', authenticateToken, projectsRouter);
app.use('/api/tasks', authenticateToken, tasksRouter);
app.use('/api/approvals', authenticateToken, approvalsRouter);
app.use('/api/activity', authenticateToken, activityRouter);
app.use('/api/notifications', authenticateToken, notificationsRouter);
app.use('/api/user', authenticateToken, userRouter);
app.use('/api/recurring', authenticateToken, recurringRouter);
app.use('/api/views', authenticateToken, savedViewsRouter);
app.use('/api/project-columns', authenticateToken, projectColumnsRouter);
app.use('/api/user-preferences', authenticateToken, userPreferencesRouter);
app.use('/api/admin', authenticateToken, adminRouter);
app.use('/api/clients', authenticateToken, clientsRouter);
app.use('/api/share-links', authenticateToken, shareLinksRouter);
app.use('/api/billing', authenticateToken, billingRouter);
app.use('/api/chat', authenticateToken, chatRouter);
app.use('/api/attachments', authenticateToken, attachmentsRouter);
app.use('/api/checklist', authenticateToken, checklistRouter);
app.use('/api/search', authenticateToken, searchRouter);
app.use('/api/services', authenticateToken, servicesRouter);
app.use('/api/enterprise', authenticateToken, enterpriseRouter);
app.use('/api/task-bulk', authenticateToken, taskBulkUploadRouter);
app.use('/public/share', publicShareRouter);

// Serve test page
const path = require('path');
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'test_api.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize WebSocket server for chat
  try {
    initializeChatWebSocket(server);
    
    // Connect notification service to WebSocket for real-time notifications
    setWebSocketBroadcast(chatBroadcast.notificationToUser);
    console.log('✅ Notification WebSocket broadcast connected');
  } catch (err) {
    console.error('Failed to initialize chat WebSocket:', err);
  }
  
  // Initialize and start background jobs
  try {
    initializeJobs();
    if (process.env.ENABLE_BACKGROUND_JOBS !== 'false') {
      startJobs();
      console.log('✅ Background jobs started');
    } else {
      console.log('⏸️ Background jobs disabled via ENABLE_BACKGROUND_JOBS=false');
    }
  } catch (err) {
    console.error('Failed to initialize background jobs:', err);
  }
});

// Global error handlers - prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit - log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue
});

// Graceful shutdown handlers - only exit when explicitly terminated
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  stopJobs();
  server.close(() => {
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  stopJobs();
  server.close(() => {
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});
