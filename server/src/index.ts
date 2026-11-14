import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { detectArea, importDataset, deleteMockData, searchDestinations } from './controllers/navigationController';
import { createPin, deletePin, getPin, listPins, updatePin } from './controllers/pinController';
import { asyncHandler } from './utils/asyncHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Navigation APIs
app.post('/api/detect-area', detectArea);
app.get('/api/search', searchDestinations);

// Saved pins (persisted in SQLite via Prisma)
app.get('/api/pins', asyncHandler(listPins));
app.post('/api/pins', asyncHandler(createPin));
app.get('/api/pins/:id', asyncHandler(getPin));
app.put('/api/pins/:id', asyncHandler(updatePin));
app.delete('/api/pins/:id', asyncHandler(deletePin));

// Admin APIs (Dataset Management)
app.post('/api/admin/import', importDataset);
app.delete('/api/admin/data', deleteMockData);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(Number(PORT), '0.0.0.0', () =>
  console.log(`Server running on http://0.0.0.0:${PORT} (Android emulator: http://10.0.2.2:${PORT})`)
);
