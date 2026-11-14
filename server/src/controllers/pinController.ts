import { Request, Response } from 'express';
import { prisma } from '../database/prisma';

const parseCoordinate = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const cleanString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const listPins = async (_req: Request, res: Response) => {
  const pins = await prisma.pin.findMany({ orderBy: { createdAt: 'desc' } });
  res.status(200).json({ pins });
};

export const getPin = async (req: Request, res: Response) => {
  const pin = await prisma.pin.findUnique({ where: { id: req.params.id } });
  if (!pin) {
    return res.status(404).json({ error: 'Pin not found' });
  }
  res.status(200).json({ pin });
};

export const createPin = async (req: Request, res: Response) => {
  const { name, notes, address, latitude, longitude } = req.body;

  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);

  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'latitude and longitude are required' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Coordinates are out of range' });
  }

  const pin = await prisma.pin.create({
    data: {
      name: cleanString(name) ?? 'Untitled pin',
      notes: cleanString(notes),
      address: cleanString(address),
      latitude: lat,
      longitude: lng,
    },
  });

  res.status(201).json({ pin });
};

export const updatePin = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, notes, address, latitude, longitude } = req.body;

  const existing = await prisma.pin.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Pin not found' });
  }

  const data: {
    name?: string;
    notes?: string | null;
    address?: string | null;
    latitude?: number;
    longitude?: number;
  } = {};

  if (name !== undefined) {
    data.name = cleanString(name) ?? existing.name;
  }
  if (notes !== undefined) {
    data.notes = cleanString(notes);
  }
  if (address !== undefined) {
    data.address = cleanString(address);
  }
  if (latitude !== undefined) {
    const lat = parseCoordinate(latitude);
    if (lat == null || lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'Invalid latitude' });
    }
    data.latitude = lat;
  }
  if (longitude !== undefined) {
    const lng = parseCoordinate(longitude);
    if (lng == null || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid longitude' });
    }
    data.longitude = lng;
  }

  const pin = await prisma.pin.update({ where: { id }, data });
  res.status(200).json({ pin });
};

export const deletePin = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.pin.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Pin not found' });
  }

  await prisma.pin.delete({ where: { id } });
  res.status(204).send();
};
