import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { getPrimaryMobileNav } from './mobileNavConfig';

export const MOBILE_BOTTOM_NAV_HEIGHT = 84;

function MobileBottomNav({ currentPage, onNavigate, canViewChat }) {
  const items = getPrimaryMobileNav({ canViewChat });
  const value = items.some((item) => item.id === currentPage) ? currentPage : 'more';

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
        zIndex: 1201,
        borderRadius: 5,
        overflow: 'hidden',
        bgcolor: alpha('#ffffff', 0.94),
        backdropFilter: 'blur(18px)',
        border: `1px solid ${alpha('#0f172a', 0.08)}`,
        boxShadow: `0 20px 48px ${alpha('#0f172a', 0.14)}`,
      }}
    >
      <BottomNavigation
        showLabels
        value={value}
        onChange={(_event, nextValue) => onNavigate(nextValue)}
        sx={{
          height: MOBILE_BOTTOM_NAV_HEIGHT,
          bgcolor: 'transparent',
          '& .MuiBottomNavigationAction-root': {
            minWidth: 64,
            color: alpha('#0f172a', 0.54),
            '&.Mui-selected': {
              color: '#0f766e',
            },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.72rem',
            fontWeight: 700,
            mt: 0.25,
            '&.Mui-selected': {
              fontSize: '0.72rem',
            },
          },
        }}
      >
        {items.map((item) => (
          <BottomNavigationAction key={item.id} value={item.id} label={item.label} icon={item.icon} />
        ))}
      </BottomNavigation>
    </Paper>
  );
}

export default MobileBottomNav;
