import { Request, Response } from 'express';

export const updateLocation = (req: Request, res: Response) => {
  const { userId, latitude, longitude } = req.body;

  // Logic to process location and update database/navigation engine
  console.log(`Updating location for ${userId}: ${latitude}, ${longitude}`);

  res.status(200).json({ status: 'success' });
};
