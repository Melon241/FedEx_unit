import { API_CANDIDATES } from '../config';

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type FetchResult = { ok: boolean; json: () => Promise<unknown> };

const PROBE_TIMEOUT_MS = 2500;
const REQUEST_TIMEOUT_MS = 8000;

let resolvedBaseUrl: string | null = null;
let resolving: Promise<string> | null = null;

const fetchWithTimeout = async (
  baseUrl: string,
  path: string,
  timeoutMs: number,
  options?: RequestOptions
): Promise<FetchResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const probe = async (baseUrl: string): Promise<boolean> => {
  try {
    const res = await fetchWithTimeout(baseUrl, '/api/pins', PROBE_TIMEOUT_MS);
    return res.ok;
  } catch {
    return false;
  }
};

const resolveBaseUrl = async (): Promise<string> => {
  if (resolvedBaseUrl) return resolvedBaseUrl;
  if (resolving) return resolving;

  resolving = (async () => {
    for (const candidate of API_CANDIDATES) {
      if (await probe(candidate)) {
        resolvedBaseUrl = candidate;
        return candidate;
      }
    }
    resolvedBaseUrl = API_CANDIDATES[0];
    return resolvedBaseUrl;
  })();

  return resolving;
};

export const getApiBaseUrl = () => resolveBaseUrl();

export const apiFetch = async (path: string, options?: RequestOptions): Promise<FetchResult> => {
  const baseUrl = await resolveBaseUrl();
  try {
    return await fetchWithTimeout(baseUrl, path, REQUEST_TIMEOUT_MS, options);
  } catch {
    throw new Error(`Cannot reach the server at ${baseUrl}. Is it running and reachable?`);
  }
};
