/**
 * Server-side terrain generation handler.
 * Called via POST /api/generate-terrain with { lat, lng, size }.
 * Runs the terrain generator script with the new bounding box.
 */

import { execSync } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';

export function handleGenerateTerrain(req: IncomingMessage, res: ServerResponse): void {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      const { lat, lng, size } = JSON.parse(body);
      if (!lat || !lng) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'lat and lng required' }));
        return;
      }

      const halfSize = (size || 500) / 2;
      // Approximate degrees for the given meter size
      const latDeg = halfSize / 111320;
      const lngDeg = halfSize / (111320 * Math.cos(lat * Math.PI / 180));

      const north = (lat + latDeg).toFixed(6);
      const south = (lat - latDeg).toFixed(6);
      const east = (lng + lngDeg).toFixed(6);
      const west = (lng - lngDeg).toFixed(6);

      console.log(`Generating terrain for ${south},${west} to ${north},${east}...`);

      // Run the terrain generator with env vars for the bounding box
      execSync(
        `npx tsx scripts/generate-terrain.ts`,
        {
          env: {
            ...process.env,
            TERRAIN_NORTH: north,
            TERRAIN_SOUTH: south,
            TERRAIN_EAST: east,
            TERRAIN_WEST: west,
          },
          stdio: 'inherit',
          timeout: 120000,
        }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err: any) {
      console.error('Terrain generation failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}
