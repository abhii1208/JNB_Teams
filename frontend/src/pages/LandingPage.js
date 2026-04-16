import React, { useEffect, useState } from 'react';
import { Box, Button, Container, Paper, Stack, Toolbar, Typography } from '@mui/material';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { JnbBrandLockup } from '../components/Brand/JnbBrand';

const slides = [
  {
    eyebrow: 'Overview',
    title: 'A clean start, every time.',
    body: 'The app opens with your brand and quickly settles into the workspace.',
    accent: 'rgba(255,255,255,0.14)',
  },
  {
    eyebrow: 'Access',
    title: 'Login without extra noise.',
    body: 'Sign in, continue with Google, and get back to work on one screen.',
    accent: 'rgba(15,118,110,0.18)',
  },
  {
    eyebrow: 'Flow',
    title: 'Move through the app smoothly.',
    body: 'Short panels rotate in sequence so the page stays compact on mobile.',
    accent: 'rgba(245,158,11,0.16)',
  },
];

export default function LandingPage({ onLoginClick, onFreeTrialClick }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((value) => (value + 1) % slides.length);
    }, 4200);

    return () => window.clearInterval(timer);
  }, []);

  const current = slides[activeSlide];

  const goToSlide = (index) => {
    setActiveSlide((index + slides.length) % slides.length);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
  };

  const handleTouchEnd = (event) => {
    const touch = event.changedTouches?.[0];
    if (touchStartX == null || touchStartY == null || !touch) return;

    const deltaX = touch.clientX - touchStartX;
    const deltaY = Math.abs(touch.clientY - touchStartY);
    setTouchStartX(null);
    setTouchStartY(null);

    if (deltaY > 60 || Math.abs(deltaX) < 60) return;
    goToSlide(deltaX < 0 ? activeSlide + 1 : activeSlide - 1);
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        height: '100dvh',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 20% 0%, rgba(14,165,233,0.18), transparent 30%), linear-gradient(180deg, #f7fbfd 0%, #eaf2f7 100%)',
      }}
    >
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          pt: 'var(--safe-area-top, 0px)',
          bgcolor: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar sx={{ minHeight: { xs: 68, sm: 72 }, px: { xs: 0, sm: 0 } }}>
            <Box sx={{ flex: 1, minWidth: 0, maxWidth: { xs: 180, sm: 250 } }}>
              <JnbBrandLockup compact dark />
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="text" onClick={onLoginClick} sx={{ textTransform: 'none', px: { xs: 1, sm: 2 } }}>
                Login
              </Button>
              <Button
                variant="contained"
                onClick={onFreeTrialClick}
                sx={{ textTransform: 'none', whiteSpace: 'nowrap', px: { xs: 1.5, sm: 2.5 } }}
              >
                Start Free Trial
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 1.75, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 5,
            overflow: 'hidden',
            border: '1px solid rgba(15,23,42,0.08)',
            boxShadow: '0 24px 70px rgba(15,23,42,0.08)',
            background:
              'linear-gradient(135deg, #0f7f8f 0%, #138fa5 38%, #16a0bb 100%)',
            color: 'white',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            touchAction: 'pan-y',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Box sx={{ px: { xs: 2.2, sm: 3.5 }, py: { xs: 2.2, sm: 2.6 }, flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>
            <Stack spacing={2.1} sx={{ width: '100%', maxWidth: 780 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.9,
                  width: 'fit-content',
                  borderRadius: 999,
                  bgcolor: current.accent,
                  color: '#fff',
                  fontWeight: 800,
                }}
              >
                <BoltRoundedIcon fontSize="small" />
                <Typography sx={{ fontWeight: 800, fontSize: { xs: 13, sm: 15 } }}>{current.eyebrow}</Typography>
              </Box>

              <Box sx={{ width: { xs: '100%', sm: '84%' } }}>
                <JnbBrandLockup animated />
              </Box>

              <Typography
                sx={{
                  fontSize: { xs: '2.2rem', sm: '3rem' },
                  fontWeight: 900,
                  lineHeight: 0.98,
                  letterSpacing: '-0.05em',
                  maxWidth: 760,
                }}
              >
                {current.title}
              </Typography>

              <Typography sx={{ maxWidth: 720, opacity: 0.94, fontSize: { xs: 15, sm: 17 }, lineHeight: 1.7 }}>
                {current.body}
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ pt: 0.4 }}>
                <Button
                  size="large"
                  variant="contained"
                  color="secondary"
                  onClick={onFreeTrialClick}
                  endIcon={<ArrowOutwardIcon />}
                  sx={{ textTransform: 'none', fontWeight: 800 }}
                >
                  Start Free Trial
                </Button>
                <Button
                  size="large"
                  variant="outlined"
                  onClick={onLoginClick}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderColor: 'rgba(255,255,255,0.72)',
                    color: '#fff',
                    '&:hover': { borderColor: '#fff' },
                  }}
                >
                  Login
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 1 }}>
                {slides.map((slide, index) => (
                  <Box
                    key={slide.title}
                    onClick={() => goToSlide(index)}
                    sx={{
                      width: index === activeSlide ? 28 : 8,
                      height: 8,
                      borderRadius: 999,
                      bgcolor: index === activeSlide ? '#fff' : 'rgba(255,255,255,0.42)',
                      cursor: 'pointer',
                      transition: 'all 220ms ease',
                    }}
                  />
                ))}
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
