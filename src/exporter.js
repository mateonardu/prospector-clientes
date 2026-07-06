/**
 * Genera el CSV de prospectos en la carpeta output/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createObjectCsvWriter } from 'csv-writer';

/**
 * @typedef {import('./parser.js').Prospect} Prospect
 */

const OUTPUT_DIR = 'output';

const COLUMNAS = [
  { id: 'nombre', title: 'nombre' },
  { id: 'direccion', title: 'direccion' },
  { id: 'barrio', title: 'barrio' },
  { id: 'telefono', title: 'telefono' },
  { id: 'tiene_web', title: 'tiene_web' },
  { id: 'url_web', title: 'url_web' },
  { id: 'instagram', title: 'instagram' },
  { id: 'lat', title: 'lat' },
  { id: 'lng', title: 'lng' },
  { id: 'google_maps_url', title: 'google_maps_url' },
  { id: 'osm_url', title: 'osm_url' },
  { id: 'query_busqueda', title: 'query_busqueda' },
  { id: 'osm_id', title: 'osm_id' },
];

/**
 * Normaliza un texto para usarlo en un nombre de archivo:
 * minúsculas, sin tildes, sin espacios ni símbolos.
 * Ej: "Caballito, Buenos Aires" → "caballitobuenosaires"
 *
 * @param {string} texto
 * @returns {string}
 */
function slug(texto) {
  // NFD separa cada letra acentuada en letra base + marca diacrítica
  // (rango U+0300–U+036F), que se descarta por code point.
  const esDiacritico = (ch) => {
    const cp = ch.codePointAt(0);
    return cp >= 0x0300 && cp <= 0x036f;
  };
  return Array.from(texto.normalize('NFD'))
    .filter((ch) => !esDiacritico(ch))
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Fecha local en formato YYYY-MM-DD.
 *
 * @returns {string}
 */
function fechaHoy() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Exporta los prospectos a un CSV en output/ y devuelve la ruta generada.
 *
 * @param {Prospect[]} prospects
 * @param {string} zona - Nombre de la zona buscada (se normaliza para el archivo).
 * @param {string} rubro - Nombre del rubro buscado (se normaliza para el archivo).
 * @returns {Promise<string>} Ruta del archivo generado.
 */
export async function exportCSV(prospects, zona, rubro) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const archivo = path.join(
    OUTPUT_DIR,
    `prospects_${slug(zona)}_${slug(rubro)}_${fechaHoy()}.csv`
  );

  const writer = createObjectCsvWriter({ path: archivo, header: COLUMNAS });

  const filas = prospects.map((p) => ({
    ...p,
    tiene_web: p.tiene_web ? 'SI' : 'NO',
  }));

  await writer.writeRecords(filas);
  return archivo;
}
