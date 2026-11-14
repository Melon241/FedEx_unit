import { apiFetch, type FetchResult } from './client';

export type Pin = {
  id: string;
  name: string;
  notes: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
};

export type PinInput = {
  name: string;
  notes?: string;
  address?: string;
  latitude: number;
  longitude: number;
};

const PINS_PATH = '/api/pins';

const readJson = async (res: FetchResult) => {
  const data = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((data.error as string) ?? 'Request failed');
  }
  return data;
};

export const listPins = async (): Promise<Pin[]> => {
  const data = await readJson(await apiFetch(PINS_PATH));
  return (data.pins as Pin[]) ?? [];
};

export const createPin = async (input: PinInput): Promise<Pin> => {
  const data = await readJson(
    await apiFetch(PINS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  );
  return data.pin as Pin;
};

export const updatePin = async (id: string, input: Partial<PinInput>): Promise<Pin> => {
  const data = await readJson(
    await apiFetch(`${PINS_PATH}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  );
  return data.pin as Pin;
};

export const deletePin = async (id: string): Promise<void> => {
  const res = await apiFetch(`${PINS_PATH}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    throw new Error((data.error as string) ?? 'Failed to delete pin');
  }
};
