import React from 'react';
import MainLayout from './components/Layout/MainLayout';

function Landing({ userId, onLogout, themePreference, onThemePreferenceChange }) {
  return (
    <MainLayout
      userId={userId}
      onLogout={onLogout}
      themePreference={themePreference}
      onThemePreferenceChange={onThemePreferenceChange}
    />
  );
}

export default Landing;
