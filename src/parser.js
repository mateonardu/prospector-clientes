/**
 * Transforma la respuesta cruda de Overpass al modelo común de prospecto.
 */

/**
 * @typedef {import('./overpass.js').OverpassElement} OverpassElement
 */

/**
 * @typedef {Object} Prospect
 * @property {string} nombre
 * @property {string} direccion
 * @property {string} barrio
 * @property {string} telefono
 * @property {boolean} tiene_web
 * @property {string} url_web
 * @property {string} instagram
 * @property {number|''} lat
 * @property {number|''} lng
 * @property {string} google_maps_url
 * @property {string} osm_url
 * @property {string} query_busqueda
 * @property {string} osm_id
 * @property {string} osm_type
 */

/**
 * Convierte elements crudos de Overpass en prospectos con el modelo común.
 * Descarta elements sin nombre (no sirven para prospectar) y deduplica por osm_id.
 *
 * @param {OverpassElement[]} elements
 * @returns {Prospect[]}
 */
export function parseElements(elements) {
  const vistos = new Set();
  const prospects = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    if (!tags.name) continue;

    // Nodes y ways tienen espacios de ids separados: la clave de
    // deduplicación combina tipo + id para no pisar ids coincidentes.
    const clave = `${element.type}/${element.id}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    const calle = tags['addr:street'];
    const altura = tags['addr:housenumber'];
    const direccion = calle ? [calle, altura].filter(Boolean).join(' ') : 'Sin dirección';

    const web = tags.website || tags['contact:website'] || '';
    const punto = element.type === 'node' ? element : element.center;
    const barrio = tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:city'] || '';

    // Con coordenadas el link a Maps es exacto; sin ellas se cae a una
    // búsqueda por texto (omitiendo los placeholders "Sin dirección"/barrio vacío).
    const tieneCoords = punto?.lat != null && punto?.lon != null;
    const google_maps_url = tieneCoords
      ? `https://www.google.com/maps?q=${punto.lat},${punto.lon}`
      : 'https://www.google.com/maps/search/' +
        encodeURIComponent(
          [tags.name, direccion !== 'Sin dirección' ? direccion : '', barrio]
            .filter(Boolean)
            .join(' ')
        );

    prospects.push({
      nombre: tags.name || 'Sin nombre',
      direccion,
      barrio,
      telefono: tags.phone || tags['contact:phone'] || '',
      tiene_web: web !== '',
      url_web: web,
      instagram: tags['contact:instagram'] || '',
      lat: punto?.lat ?? '',
      lng: punto?.lon ?? '',
      google_maps_url,
      osm_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      query_busqueda: [tags.name, barrio, 'Buenos Aires'].filter(Boolean).join(', '),
      osm_id: String(element.id),
      osm_type: element.type,
    });
  }

  return prospects;
}

/**
 * Estadísticas de una lista de prospectos, para mostrar al final del CLI.
 *
 * @param {Prospect[]} prospects
 * @returns {{total: number, con_web: number, sin_web: number, con_telefono: number, con_instagram: number}}
 */
export function resumen(prospects) {
  const con_web = prospects.filter((p) => p.tiene_web).length;
  return {
    total: prospects.length,
    con_web,
    sin_web: prospects.length - con_web,
    con_telefono: prospects.filter((p) => p.telefono !== '').length,
    con_instagram: prospects.filter((p) => p.instagram !== '').length,
  };
}
