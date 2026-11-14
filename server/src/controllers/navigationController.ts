import { Request, Response } from 'express';

// Simulated database import / persistence layer (Mock Data)
let mockAreas = [
  {
    id: 'area-1',
    name: 'Tech Campus Area A',
    buildings: [
      { id: 'bldg-1', name: 'Building A', entranceLat: 37.774900, entranceLng: -122.419400 },
      { id: 'bldg-2', name: 'Building B', entranceLat: 37.775050, entranceLng: -122.418050 },
    ]
  }
];

export const importDataset = (req: Request, res: Response) => {
    const { areaData } = req.body;
    mockAreas.push(areaData);
    res.status(201).json({ message: 'Dataset imported successfully' });
};

export const deleteMockData = (req: Request, res: Response) => {
    mockAreas = [];
    res.status(200).json({ message: 'All mock data cleared' });
};

export const detectArea = (req: Request, res: Response) => {
  const { lat, lng } = req.body;
  // Mock area detection logic
  const matchedArea = mockAreas.find(area => lat > 37 && lng < -120);
  res.status(200).json({ area: matchedArea || { id: 'default', name: 'General Zone' } });
};

export const searchDestinations = (req: Request, res: Response) => {
  const query = String(req.query.query ?? '').toLowerCase().trim();
  const areaId = req.query.areaId ? String(req.query.areaId) : undefined;

  const areas = areaId ? mockAreas.filter(area => area.id === areaId) : mockAreas;

  const results = areas
    .flatMap(area => area.buildings)
    .filter(
      building =>
        !query ||
        building.name.toLowerCase().includes(query) ||
        building.id.toLowerCase().includes(query)
    );

  res.status(200).json({ results });
};
