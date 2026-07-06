/**
 * Servidor web local para scout-tool (sin frameworks, http nativo).
 * Sirve la página de public/ y expone la misma lógica que el CLI como API JSON.
 *
 * Uso: node src/server.js  →  http://localhost:3000
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RUBROS } from './rubros.js';
import { geocodificar, queryByTagsAndCentro } from './overpass.js';
import { parseElements, resumen } from './parser.js';
import { exportCSV } from './exporter.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = 'public';

// Resultados de búsquedas recientes, para poder exportar el CSV
// sin repetir la consulta a Overpass. Clave: id de búsqueda.
const busquedas = new Map();

/**
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {unknown} cuerpo
 */
function json(res, status, cuerpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

/**
 * GET /api/buscar?rubro=...&zona=...&radio=...
 * Corre el pipeline completo y devuelve prospectos + resumen.
 *
 * @param {URLSearchParams} params
 * @param {http.ServerResponse} res
 */
async function handleBuscar(params, res) {
  const rubro = params.get('rubro') ?? '';
  const zona = (params.get('zona') ?? '').trim();
  const radio = Number(params.get('radio') || 2);

  if (!RUBROS[rubro]) {
    return json(res, 400, {
      error: `Rubro no reconocido: ${rubro}`,
      rubros: Object.keys(RUBROS),
    });
  }
  if (!zona) {
    return json(res, 400, { error: 'Falta el parámetro zona' });
  }
  if (!Number.isFinite(radio) || radio <= 0) {
    return json(res, 400, { error: `Radio inválido: ${params.get('radio')}` });
  }

  try {
    const centro = await geocodificar(zona);
    const elements = await queryByTagsAndCentro(RUBROS[rubro], centro, radio);
    const prospects = parseElements(elements);

    const id = crypto.randomUUID();
    busquedas.set(id, { prospects, zona, rubro });

    json(res, 200, { id, centro, resumen: resumen(prospects), prospects });
  } catch (error) {
    const status = error.message.startsWith('Zona no encontrada') ? 404 : 502;
    json(res, status, { error: error.message });
  }
}

/**
 * GET /api/csv?id=...
 * Genera el CSV en output/ (reusa exportCSV) y lo devuelve como descarga.
 *
 * @param {URLSearchParams} params
 * @param {http.ServerResponse} res
 */
async function handleCsv(params, res) {
  const busqueda = busquedas.get(params.get('id') ?? '');
  if (!busqueda) {
    return json(res, 404, { error: 'Búsqueda no encontrada. Volvé a buscar.' });
  }

  const ruta = await exportCSV(busqueda.prospects, busqueda.zona, busqueda.rubro);
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${path.basename(ruta)}"`,
  });
  fs.createReadStream(ruta).pipe(res);
}

/**
 * @param {http.ServerResponse} res
 */
function handleIndex(res) {
  const ruta = path.join(PUBLIC_DIR, 'index.html');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(ruta).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (pathname === '/') return handleIndex(res);
    if (pathname === '/api/rubros') return json(res, 200, Object.keys(RUBROS));
    if (pathname === '/api/buscar') return await handleBuscar(searchParams, res);
    if (pathname === '/api/csv') return await handleCsv(searchParams, res);
    json(res, 404, { error: 'No encontrado' });
  } catch (error) {
    console.error(error);
    json(res, 500, { error: 'Error interno del servidor' });
  }
});

server.listen(PORT, () => {
  console.log(`🌐 scout-tool corriendo en http://localhost:${PORT}`);
});
