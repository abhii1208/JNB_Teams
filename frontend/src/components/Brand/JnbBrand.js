import React from 'react';
import { Box } from '@mui/material';

const BRAND_LOGO_SRC = '/new_logo.png?v=20260413b';

function BrandImage({ compact = false, animated = false, sx = {} }) {
  return (
    <Box
      component="img"
      src={BRAND_LOGO_SRC}
      alt="JNB Your CFO Partner"
      loading="eager"
      sx={{
        display: 'block',
        width: '100%',
        height: 'auto',
        objectFit: 'contain',
        objectPosition: 'center center',
        marginLeft: 'auto',
        marginRight: 'auto',
        ...(compact
          ? { maxWidth: 188 }
          : { maxWidth: 420 }),
        ...(animated
          ? {
              opacity: 0,
              transform: 'translateY(10px) scale(0.98)',
              animation: 'jnbLogoReveal 820ms ease forwards',
              '@keyframes jnbLogoReveal': {
                to: { opacity: 1, transform: 'translateY(0) scale(1)' },
              },
            }
          : undefined),
        ...sx,
      }}
    />
  );
}

function JnbLogo({ compact = false, animated = false }) {
  return <BrandImage compact={compact} animated={animated} />;
}

export function JnbIconMark({ size = 88, animated = false }) {
  return <BrandImage compact animated={animated} sx={{ width: size, maxWidth: size }} />;
}

export function JnbBrandLockup({ animated = false, compact = false }) {
  return <JnbLogo compact={compact} animated={animated} />;
}
