import React from 'react';
import { Box, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { JnbBrandLockup } from './JnbBrand';

function AppLaunchScreen({ visible }) {
  return (
    <Box
      aria-hidden={!visible}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'grid',
        placeItems: 'center',
        px: 3,
        color: '#1f2937',
        background: '#f3f4f6',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 320ms ease',
      }}
    >
      <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
        <Box
          sx={{
            width: { xs: 240, sm: 320 },
            animation: 'jnbLaunchRise 620ms ease forwards',
            '@keyframes jnbLaunchRise': {
              '0%': { opacity: 0, transform: 'translateY(8px)' },
              '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
            },
          }}
        >
          <JnbBrandLockup animated />
        </Box>

        <Box
          sx={{
            width: 150,
            height: 4,
            borderRadius: 999,
            overflow: 'hidden',
            bgcolor: alpha('#0f766e', 0.15),
          }}
        >
          <Box
            sx={{
              width: '34%',
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #0F766E 0%, #0891b2 100%)',
              animation: 'jnbLaunchProgress 1s ease-in-out infinite',
              '@keyframes jnbLaunchProgress': {
                '0%': { transform: 'translateX(-110%)' },
                '100%': { transform: 'translateX(330%)' },
              },
            }}
          />
        </Box>
      </Stack>
    </Box>
  );
}

export default AppLaunchScreen;
