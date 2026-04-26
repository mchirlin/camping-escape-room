/**
 * Simple marker REST API for the Vite dev server.
 * Stores markers in a local JSON file — no external services needed.
 * This mocks the ESP32 API that will run on the crafting table.
 *
 * Endpoints:
 *   GET  /api/markers         → list all markers
 *   POST /api/markers         → add a marker (body: { position, tag, count?, label? })
 *   PUT  /api/markers/:id     → update a marker (body: partial marker fields)
 *   DELETE /api/markers/:id   → remove a marker
 *   POST /api/markers/:id/collect → mark as collected
 */

import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

interface StoredMarker {
  id: string;
  position: { latitude: number; longitude: number };
  tag: string;
  count: number;
  label?: string;
  collected: boolean;
  createdAt: number;
}

const DATA_FILE = path.resolve('server/markers.json');

function loadMarkers(): StoredMarker[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

function saveMarkers(markers: StoredMarker[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(markers, null, 2));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

function json(res: ServerResponse, data: any, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

export function handleMarkerApi(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? '';
  const method = req.method ?? 'GET';

  // CORS preflight
  if (method === 'OPTIONS' && url.startsWith('/api/markers')) {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }

  // GET /api/markers
  if (method === 'GET' && url === '/api/markers') {
    const markers = loadMarkers().filter((m) => !m.collected);
    json(res, markers);
    return true;
  }

  // POST /api/markers
  if (method === 'POST' && url === '/api/markers') {
    readBody(req).then((body) => {
      const data = JSON.parse(body);
      const markers = loadMarkers();

      const marker: StoredMarker = {
        id: data.id || crypto.randomUUID(),
        position: data.position,
        tag: data.tag,
        count: data.count || 1,
        label: data.label,
        collected: false,
        createdAt: Date.now(),
      };

      markers.push(marker);
      saveMarkers(markers);
      json(res, marker, 201);
    });
    return true;
  }

  // PUT /api/markers/:id
  const putMatch = url.match(/^\/api\/markers\/([^/]+)$/);
  if (method === 'PUT' && putMatch) {
    const id = putMatch[1];
    readBody(req).then((body) => {
      const updates = JSON.parse(body);
      const markers = loadMarkers();
      const marker = markers.find((m) => m.id === id);
      if (!marker) {
        json(res, { error: 'not found' }, 404);
        return;
      }
      Object.assign(marker, updates);
      saveMarkers(markers);
      json(res, marker);
    });
    return true;
  }

  // DELETE /api/markers/:id
  const delMatch = url.match(/^\/api\/markers\/([^/]+)$/);
  if (method === 'DELETE' && delMatch) {
    const id = delMatch[1];
    let markers = loadMarkers();
    markers = markers.filter((m) => m.id !== id);
    saveMarkers(markers);
    json(res, { ok: true });
    return true;
  }

  // POST or GET /api/markers/:id/collect
  const collectMatch = url.match(/^\/api\/markers\/([^/]+)\/collect$/);
  if (collectMatch && (method === 'POST' || method === 'GET')) {
    const id = collectMatch[1];
    const markers = loadMarkers();
    const marker = markers.find((m) => m.id === id);
    if (!marker) {
      json(res, { error: 'not found' }, 404);
      return true;
    }
    marker.collected = true;
    saveMarkers(markers);

    if (method === 'GET') {
      // Show a brief collected confirmation, try to close tab
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html><body style="background:#1a1a1a;color:#55FF55;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;font-size:24px;">✅ Collected!<script>setTimeout(()=>window.close(),500)</script></body></html>`);
    } else {
      json(res, marker);
    }
    return true;
  }

  return false; // not handled
}
