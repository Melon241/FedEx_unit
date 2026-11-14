import Constants from 'expo-constants';
import { Platform } from 'react-native';

// The Expo dev server advertises the host the device used to load the bundle
// (e.g. "192.168.1.153:8081"). Reusing that host keeps the API reachable on
// both emulators and physical devices.
const extractHost = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const withoutScheme = value.replace(/^[a-z]+:\/\//i, '');
  const host = withoutScheme.split('/')[0].split(':')[0];
  return host || undefined;
};

const constants = Constants as unknown as {
  expoConfig?: { hostUri?: string } | null;
  expoGoConfig?: { debuggerHost?: string } | null;
};

const devHost =
  extractHost(constants.expoConfig?.hostUri) ??
  extractHost(constants.expoGoConfig?.debuggerHost);

const API_PORT = 3000;

// Ordered list of hosts to try. The first one that answers a health check is
// used for every request.
const buildCandidates = (): string[] => {
  const candidates: string[] = [];
  const add = (url?: string) => {
    if (!url) return;
    const normalized = url.replace(/\/+$/, '');
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };

  add(process.env.EXPO_PUBLIC_API_URL);
  if (devHost) add(`http://${devHost}:${API_PORT}`);
  if (Platform.OS === 'android') add(`http://10.0.2.2:${API_PORT}`);
  add(`http://localhost:${API_PORT}`);
  add(`http://127.0.0.1:${API_PORT}`);

  return candidates;
};

export const API_CANDIDATES = buildCandidates();
export const API_BASE_URL = API_CANDIDATES[0] ?? `http://localhost:${API_PORT}`;
