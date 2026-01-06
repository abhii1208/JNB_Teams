import React from 'react';
import MainLayout from './components/Layout/MainLayout';

function Landing({ userId, onLogout }) {
  return <MainLayout userId={userId} onLogout={onLogout} />;
}

export default Landing;
