import React, { useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BarChartIcon from '@mui/icons-material/BarChart';
import BoltIcon from '@mui/icons-material/Bolt';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';
import InsightsIcon from '@mui/icons-material/Insights';
import RepeatIcon from '@mui/icons-material/Repeat';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import ShareIcon from '@mui/icons-material/Share';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

function formatInr(amount) {
  const value = Number(amount) || 0;
  return `INR ${value.toLocaleString('en-IN')}`;
}

function TabPanel({ value, index, children }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 3 }}>{children}</Box>;
}

export default function LandingPage({ onLoginClick, onFreeTrialClick, onPaidPlanCheckout }) {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);

  const [purchaseDialog, setPurchaseDialog] = useState({ open: false, plan: null });
  const [seatCount, setSeatCount] = useState(5);

  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });

  const seatLimits = useMemo(
    () => ({
      pro: { max: 50, priceInr: 250, workspaces: 1 },
      business: { max: 100, priceInr: 300, workspaces: 3 },
    }),
    []
  );

  const features = useMemo(
    () => [
      {
        icon: <TaskAltIcon color="primary" />,
        title: 'Projects & Tasks',
        body: 'Plan work, assign owners, track progress, and keep everything searchable.',
      },
      {
        icon: <CalendarTodayIcon color="primary" />,
        title: 'Multiple Views',
        body: 'Table, list, board, and calendar views for different ways of working.',
      },
      {
        icon: <RepeatIcon color="primary" />,
        title: 'Recurring Automation',
        body: 'Create recurring series with reminders and smart generation options.',
      },
      {
        icon: <VerifiedUserIcon color="primary" />,
        title: 'Approvals',
        body: 'Request, review, and audit approvals with clear activity history.',
      },
      {
        icon: <ShareIcon color="primary" />,
        title: 'Public Sharing',
        body: 'Share expiring links to stakeholders without exposing internal data.',
      },
      {
        icon: <SecurityIcon color="primary" />,
        title: 'Roles & Access',
        body: 'Workspace and project membership with role-based access control.',
      },
    ],
    []
  );

  const openPaidDialog = (plan) => {
    setPurchaseDialog({ open: true, plan });
    setSeatCount(plan === 'business' ? 10 : 5);
  };

  const closePaidDialog = () => setPurchaseDialog({ open: false, plan: null });

  const currentPlan = purchaseDialog.plan;
  const currentLimit = currentPlan ? seatLimits[currentPlan] : null;
  const canContinuePurchase =
    Boolean(currentPlan) && Boolean(currentLimit) && seatCount > 0 && seatCount <= (currentLimit?.max || 0);

  const totalInr = currentLimit ? seatCount * currentLimit.priceInr : 0;

  const sendContactMailto = () => {
    const name = contactForm.name.trim();
    const email = contactForm.email.trim();
    const message = contactForm.message.trim();

    if (!name || !email || !message) {
      enqueueSnackbar('Please fill name, email, and message.', { variant: 'warning' });
      return;
    }

    const subject = encodeURIComponent(`TeamFlow contact request from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}\n`);
    window.location.href = `mailto:support@teamflow.com?subject=${subject}&body=${body}`;
    enqueueSnackbar('Opening your email client...', { variant: 'info' });
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #0f766e 0%, #0ea5e9 100%)',
              }}
            />
            <Typography variant="h6" sx={{ fontWeight: 900, color: 'text.primary' }}>
              TeamFlow
            </Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Button variant="text" onClick={onLoginClick} sx={{ textTransform: 'none' }}>
            Login
          </Button>
          <Button variant="contained" onClick={onFreeTrialClick} sx={{ textTransform: 'none' }}>
            Start Free Trial
          </Button>
        </Toolbar>
      </AppBar>

      {/* Hero */}
      <Box
        sx={{
          background: 'radial-gradient(1200px 600px at 15% 10%, rgba(14,165,233,0.35), transparent 55%), linear-gradient(135deg, #0f766e 0%, #0ea5e9 100%)',
          color: 'white',
          py: { xs: 6, md: 9 },
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.25fr 0.75fr' },
              gap: { xs: 4, md: 5 },
              alignItems: 'center',
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  icon={<AutoAwesomeIcon sx={{ color: 'white' }} />}
                  label="Modern workflow for modern teams"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.14)',
                    color: 'white',
                    '& .MuiChip-icon': { color: 'white' },
                  }}
                />
              </Stack>
              <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                Organize, automate, and deliver work with confidence.
              </Typography>
              <Typography sx={{ maxWidth: 720, opacity: 0.95 }}>
                TeamFlow brings tasks, recurring workflows, approvals, and sharing into one clean workspace.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 0.5 }}>
                <Button
                  size="large"
                  variant="contained"
                  color="secondary"
                  onClick={onFreeTrialClick}
                  sx={{ textTransform: 'none' }}
                >
                  Start Free Trial
                </Button>
                <Button
                  size="large"
                  variant="outlined"
                  onClick={onLoginClick}
                  sx={{
                    textTransform: 'none',
                    borderColor: 'rgba(255,255,255,0.65)',
                    color: 'white',
                    '&:hover': { borderColor: 'rgba(255,255,255,0.9)' },
                  }}
                >
                  Login
                </Button>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ pt: 1 }}>
                {[
                  { icon: <BoltIcon sx={{ color: 'white' }} />, label: 'Fast setup' },
                  { icon: <InsightsIcon sx={{ color: 'white' }} />, label: 'Clear visibility' },
                  { icon: <SupportAgentIcon sx={{ color: 'white' }} />, label: 'Team-ready' },
                ].map((item) => (
                  <Stack key={item.label} direction="row" spacing={1} alignItems="center">
                    {item.icon}
                    <Typography sx={{ opacity: 0.95 }}>{item.label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: 'white',
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <RocketLaunchIcon />
                    <Typography sx={{ fontWeight: 900 }}>Today</Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label="Live"
                    sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }}
                  />
                </Stack>

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />

                {[
                  { title: 'Review approvals', meta: '2 pending', icon: <VerifiedUserIcon /> },
                  { title: 'Client deliverables', meta: '3 tasks due', icon: <TaskAltIcon /> },
                  { title: 'Recurring checklist', meta: 'auto-generated', icon: <RepeatIcon /> },
                ].map((row) => (
                  <Stack key={row.title} direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.14)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {row.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 800 }}>{row.title}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.85 }}>
                        {row.meta}
                      </Typography>
                    </Box>
                  </Stack>
                ))}

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />

                <Stack direction="row" spacing={1} justifyContent="space-between">
                  <Stack spacing={0.25}>
                    <Typography variant="body2" sx={{ opacity: 0.85 }}>
                      Visibility
                    </Typography>
                    <Typography sx={{ fontWeight: 900 }}>Dashboard</Typography>
                  </Stack>
                  <BarChartIcon />
                </Stack>
              </Stack>
            </Paper>
          </Box>
        </Container>
      </Box>

      {/* Tabs */}
      <Container maxWidth="lg" sx={{ mt: -3 }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            border: '1px solid rgba(15,23,42,0.08)',
            bgcolor: 'background.paper',
            overflow: 'hidden',
          }}
        >
          <Tabs value={tab} onChange={(_e, next) => setTab(next)} variant="fullWidth">
            <Tab label="Features" />
            <Tab label="Pricing" />
            <Tab label="Contact" />
          </Tabs>
        </Paper>
      </Container>

      <Container maxWidth="lg" sx={{ py: 5 }}>
        <TabPanel value={tab} index={0}>
          <Stack spacing={2.5}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Features that help teams move faster
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
              Everything you need to manage projects, approvals, and recurring work without adding complexity.
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              {features.map((feature) => (
                <Card key={feature.title} sx={{ height: '100%' }}>
                  <CardContent>
                    <Stack spacing={1.25}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            bgcolor: 'rgba(15,118,110,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {feature.icon}
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>
                          {feature.title}
                        </Typography>
                      </Stack>
                      <Typography color="text.secondary">{feature.body}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: '1px solid rgba(15,23,42,0.08)',
                bgcolor: 'rgba(2,132,199,0.04)',
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 900 }}>Ready to see it in action?</Typography>
                  <Typography color="text.secondary">
                    Create your account and start with a free personal workspace in minutes.
                  </Typography>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <Button variant="contained" onClick={onFreeTrialClick} sx={{ textTransform: 'none' }}>
                    Start Free Trial
                  </Button>
                  <Button variant="outlined" onClick={() => setTab(1)} sx={{ textTransform: 'none' }}>
                    View pricing
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Stack spacing={2.5}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Pricing that scales with your team
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
              Pay per user per month. Pro supports one workspace up to 50 users. Business supports up to three workspaces and 100 users.
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              <Card sx={{ height: '100%', border: '1px solid rgba(15,23,42,0.08)' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      Free
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>
                      {formatInr(0)}
                    </Typography>
                    <Typography color="text.secondary">Personal workspace (1 user, 1 workspace).</Typography>
                    <Divider />
                    <Stack spacing={1}>
                      {['Tasks & projects', 'Recurring series', 'Share links', 'Basic dashboards'].map((item) => (
                        <Stack key={item} direction="row" spacing={1} alignItems="center">
                          <CheckCircleIcon fontSize="small" color="primary" />
                          <Typography>{item}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Button variant="contained" onClick={onFreeTrialClick} sx={{ textTransform: 'none' }}>
                      Start Free Trial
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ height: '100%', border: '2px solid rgba(15,118,110,0.25)' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="h6" sx={{ fontWeight: 900 }}>
                        Pro
                      </Typography>
                      <Chip label="Popular" size="small" color="secondary" />
                    </Stack>
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>
                      {formatInr(250)} <Typography component="span" color="text.secondary">/ user / month</Typography>
                    </Typography>
                    <Typography color="text.secondary">All features, 1 workspace, up to 50 users.</Typography>
                    <Divider />
                    <Stack spacing={1}>
                      {['All features included', '1 workspace', 'Up to 50 users', 'Approvals + analytics'].map((item) => (
                        <Stack key={item} direction="row" spacing={1} alignItems="center">
                          <CheckCircleIcon fontSize="small" color="primary" />
                          <Typography>{item}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Button variant="outlined" onClick={() => openPaidDialog('pro')} sx={{ textTransform: 'none' }}>
                      Try Pro
                    </Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ height: '100%', border: '1px solid rgba(15,23,42,0.08)' }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h6" sx={{ fontWeight: 900 }}>
                      Business
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>
                      {formatInr(300)} <Typography component="span" color="text.secondary">/ user / month</Typography>
                    </Typography>
                    <Typography color="text.secondary">All features, up to 3 workspaces, up to 100 users.</Typography>
                    <Divider />
                    <Stack spacing={1}>
                      {['All features included', 'Up to 3 workspaces', 'Up to 100 users', 'Great for larger teams'].map((item) => (
                        <Stack key={item} direction="row" spacing={1} alignItems="center">
                          <CheckCircleIcon fontSize="small" color="primary" />
                          <Typography>{item}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                    <Button variant="outlined" onClick={() => openPaidDialog('business')} sx={{ textTransform: 'none' }}>
                      Try Business
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: '1px solid rgba(15,23,42,0.08)',
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 900 }}>Need help choosing?</Typography>
                  <Typography color="text.secondary">
                    Start Free, then upgrade to Pro or Business anytime.
                  </Typography>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                  <Button variant="contained" onClick={onFreeTrialClick} sx={{ textTransform: 'none' }}>
                    Start Free Trial
                  </Button>
                  <Button variant="outlined" onClick={() => setTab(2)} sx={{ textTransform: 'none' }}>
                    Contact us
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Stack spacing={2.5}>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>
              Contact
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 860 }}>
              Have questions about onboarding, pricing, or plan limits? Send a message and we will get back to you.
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.2fr 0.8fr' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Card>
                <CardContent>
                  <Stack spacing={1.5}>
                    <TextField
                      label="Name"
                      value={contactForm.name}
                      onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Email"
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Message"
                      value={contactForm.message}
                      onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))}
                      fullWidth
                      multiline
                      minRows={4}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <Button variant="contained" onClick={sendContactMailto} sx={{ textTransform: 'none' }}>
                        Send message
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setContactForm({ name: '', email: '', message: '' });
                          enqueueSnackbar('Cleared.', { variant: 'info' });
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Clear
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography sx={{ fontWeight: 900 }}>Direct</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <EmailIcon color="primary" />
                      <Typography sx={{ fontWeight: 700 }}>support@teamflow.com</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      This build uses your email client (mailto). If you add a backend contact endpoint later, we can wire this form to it.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </TabPanel>
      </Container>

      <Box sx={{ py: 5, borderTop: '1px solid rgba(15,23,42,0.08)' }}>
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            alignItems={{ md: 'center' }}
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary">
              (c) {new Date().getFullYear()} TeamFlow. All rights reserved.
            </Typography>
            <Stack direction="row" spacing={2}>
              <Button size="small" onClick={() => setTab(0)} sx={{ textTransform: 'none' }}>
                Features
              </Button>
              <Button size="small" onClick={() => setTab(1)} sx={{ textTransform: 'none' }}>
                Pricing
              </Button>
              <Button size="small" onClick={() => setTab(2)} sx={{ textTransform: 'none' }}>
                Contact
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Dialog open={purchaseDialog.open} onClose={closePaidDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Select users</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {(currentPlan === 'business' ? 'Business' : 'Pro')} plan (monthly)
          </Typography>
          <TextField
            fullWidth
            type="number"
            label="Number of users"
            value={seatCount}
            onChange={(e) => setSeatCount(Number.parseInt(e.target.value, 10) || 0)}
            inputProps={{ min: 1, max: currentLimit?.max || 100 }}
            helperText={currentLimit ? `Max ${currentLimit.max} users` : ''}
          />
          {currentLimit && canContinuePurchase && (
            <Stack spacing={0.25} sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 900 }}>Total per month: {formatInr(totalInr)}</Typography>
              <Typography variant="body2" color="text.secondary">
                Includes all features. Workspace limit: {currentLimit.workspaces}.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePaidDialog} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!canContinuePurchase) return;
              closePaidDialog();
              onPaidPlanCheckout?.(currentPlan, seatCount);
            }}
            sx={{ textTransform: 'none' }}
            disabled={!canContinuePurchase}
          >
            Continue to payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
