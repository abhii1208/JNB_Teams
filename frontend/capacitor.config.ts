import type { CapacitorConfig } from '@capacitor/cli';
import fs from 'fs';
import path from 'path';

const readEnvValue = (key: string) => {
  const directValue = process.env[key];
  if (directValue) return directValue;

  const envFiles = ['.env', '.env.production'];

  for (const fileName of envFiles) {
    const filePath = path.resolve(__dirname, fileName);
    if (!fs.existsSync(filePath)) continue;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    for (const line of fileContent.split(/\r?\n/)) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const separatorIndex = trimmedLine.indexOf('=');
      if (separatorIndex === -1) continue;

      const currentKey = trimmedLine.slice(0, separatorIndex).trim();
      if (currentKey !== key) continue;

      return trimmedLine.slice(separatorIndex + 1).trim();
    }
  }

  return undefined;
};

const appUrl = readEnvValue('CAPACITOR_APP_URL');
const useRemoteAppUrl = readEnvValue('CAPACITOR_USE_REMOTE_URL') === 'true';
const androidServerClientId =
  readEnvValue('CAPACITOR_GOOGLE_ANDROID_SERVER_CLIENT_ID')
  || readEnvValue('REACT_APP_GOOGLE_SERVER_CLIENT_ID');

const config: CapacitorConfig = {
  appId: 'com.jnbteams.app',
  appName: 'JNB Teams',
  webDir: 'build',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    GoogleSignIn: androidServerClientId
      ? {
          AndroidServerClientId: androidServerClientId,
        }
      : {},
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#17364F',
      androidSplashResourceName: 'jnb_splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

if (useRemoteAppUrl && appUrl) {
  config.server = {
    url: appUrl,
    cleartext: false,
    androidScheme: 'https',
    allowNavigation: ['*'],
  };
}

export default config;
