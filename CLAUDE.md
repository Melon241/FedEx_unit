# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure
- `mobile/`: React Native (Expo) frontend for the GPS-based navigation.
- `server/`: Node.js/Express backend with PostgreSQL/PostGIS for spatial data management.

## Common Development Tasks

### Setup and Backend
- Backend uses Prisma for database management. Ensure PostgreSQL with PostGIS is running and the `DATABASE_URL` is set in the environment variables before running migrations:
  `cd server && npx prisma migrate dev`

### Frontend
- Frontend relies on Expo. To start the development server:
  `cd mobile && npx expo start`

## Architecture Notes
- The application follows a data-driven navigation architecture. 
- The backend relies on PostgreSQL with the PostGIS extension for handling spatial queries related to geographical areas and individual building locations.
- The frontend tracks the user's location via native GPS and syncs with the server for route updates.
- Navigation logic is handled by the server (or a dedicated routing service) and rendered via `mobile/src/components/MapDisplay.tsx`.
