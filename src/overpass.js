/**
 * Cliente HTTP para la API pública de Overpass (OpenStreetMap).
 * Geocodifica la zona con Nominatim y luego consulta Overpass por tags.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Nominatim y Overpass piden identificar la aplicación en el User-Agent.
const USER_AGENT = 'scout-tool/0.1 (prospecting CLI; contact: mateonarducci@gmail.com)';

/**
 * @typedef {Object} OverpassElement
 * @property {'node'|'way'|'relation'} type
 * @property {number} id
 * @property {number} [lat] - Presente en nodes.
 * @property {number} [lon] - Presente en nodes.
 * @property {{lat: number, lon: number}} [center] - Presente en ways (por `out center`).
 * @property {Record<string, string>} [tags]
 */

/**
 * Espera la cantidad de milisegundos indicada.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resuelve un nombre de zona a coordenadas usando Nominatim.
 *
 * @param {string} zona - Nombre de ciudad o barrio, ej: "Caballito, Buenos Aires".
 * @returns {Promise<{lat: number, lon: number}>}
 * @throws {Error} Si Nominatim no encuentra la zona o el request falla.
 */
export async function geocodificar(zona) {
  // countrycodes=ar y bounded=1 evitan que barrios argentinos se
  // resuelvan como lugares homónimos de otros países (ej: Liniers, Francia).
  const params = new URLSearchParams({
    q: zona,
    format: 'json',
    limit: '1',
    countrycodes: 'ar',
    bounded: '1',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
  });

  if (!res.ok) {
    throw new Error(`Nominatim respondió ${res.status} al geocodificar "${zona}"`);
  }

  /** @type {Array<{lat: string, lon: string}>} */
  const resultados = await res.json();
  if (resultados.length === 0) {
    throw new Error(`Zona no encontrada: ${zona}`);
  }

  return { lat: Number(resultados[0].lat), lon: Number(resultados[0].lon) };
}

/**
 * Construye la query Overpass QL: busca nodes y ways con cualquiera
 * de los tags dados dentro de un radio alrededor de un punto.
 *
 * @param {import('./rubros.js').EntradaRubro[]} tags - Tags OSM tipo
 *   ["shop=beauty"] o { tag, nombre } para filtrar además por nombre.
 * @param {{lat: number, lon: number}} centro
 * @param {number} radioMetros
 * @returns {string} Query Overpass QL.
 */
function construirQuery(tags, centro, radioMetros) {
  const clausulas = tags
    .flatMap((entrada) => {
      const { tag, nombre } = typeof entrada === 'string' ? { tag: entrada } : entrada;
      const [clave, valor] = tag.split('=');
      const filtroNombre = nombre ? `["name"~"${nombre}",i]` : '';
      const filtro =
        `["${clave}"="${valor}"]${filtroNombre}` +
        `(around:${radioMetros},${centro.lat},${centro.lon})`;
      return [`node${filtro};`, `way${filtro};`];
    })
    .join('\n  ');

  // `out center` hace que los ways traigan un punto central calculado.
  return `[out:json][timeout:180];
(
  ${clausulas}
);
out center;`;
}

/**
 * Busca elementos OSM que tengan cualquiera de los tags dados,
 * dentro de un radio alrededor de la zona indicada.
 *
 * @param {string[]} tags - Tags OSM tipo ["shop=beauty", "shop=beauty_salon"].
 * @param {string} zona - Nombre de ciudad o barrio, ej: "Caballito, Buenos Aires".
 * @param {number} [radioKm=2] - Radio de búsqueda en kilómetros.
 * @returns {Promise<OverpassElement[]>} Array crudo de `elements` de la respuesta.
 * @throws {Error} Si la zona no se encuentra o Overpass falla.
 */
export async function queryByTagsAndZone(tags, zona, radioKm = 2) {
  const centro = await geocodificar(zona);
  return queryByTagsAndCentro(tags, centro, radioKm);
}

/**
 * Igual que queryByTagsAndZone pero con coordenadas ya resueltas.
 * Útil cuando el llamador geocodificó por su cuenta (ej: para mostrar progreso).
 *
 * @param {string[]} tags - Tags OSM tipo ["shop=beauty", "shop=beauty_salon"].
 * @param {{lat: number, lon: number}} centro
 * @param {number} [radioKm=2] - Radio de búsqueda en kilómetros.
 * @returns {Promise<OverpassElement[]>} Array crudo de `elements` de la respuesta.
 * @throws {Error} Si Overpass falla.
 */
export async function queryByTagsAndCentro(tags, centro, radioKm = 2) {
  // Rate limit: 1 segundo entre el request a Nominatim y el de Overpass.
  await sleep(1000);

  const query = construirQuery(tags, centro, radioKm * 1000);
  const intentosMax = 3;

  for (let intento = 1; intento <= intentosMax; intento++) {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ data: query }),
    });

    if (res.ok) {
      const data = await res.json();

      // Bajo carga, Overpass puede responder 200 con un "remark" de
      // timeout/memoria y elements vacío o incompleto. Tratarlo como
      // transitorio y reintentar, en vez de devolver 0 resultados falsos.
      const remark = data.remark ?? '';
      if (/timed out|out of memory|error/i.test(remark)) {
        if (intento < intentosMax) {
          const esperaSeg = intento * 10;
          console.error(
            `Overpass devolvió un error interno ("${remark.slice(0, 120)}"), ` +
              `reintentando en ${esperaSeg}s (intento ${intento}/${intentosMax})...`
          );
          await sleep(esperaSeg * 1000);
          continue;
        }
        throw new Error(`Overpass no pudo completar la consulta: ${remark.slice(0, 200)}`);
      }

      return data.elements ?? [];
    }

    // 429 (rate limit) y 504 (servidor saturado) son transitorios en la
    // API pública: reintentar con espera creciente antes de rendirse.
    const transitorio = res.status === 429 || res.status === 504;
    if (transitorio && intento < intentosMax) {
      const esperaSeg = intento * 10;
      console.error(
        `Overpass respondió ${res.status}, reintentando en ${esperaSeg}s (intento ${intento}/${intentosMax})...`
      );
      await sleep(esperaSeg * 1000);
      continue;
    }

    console.error(`Overpass falló con status ${res.status} ${res.statusText}`);
    const cuerpo = await res.text().catch(() => '');
    if (cuerpo) console.error(cuerpo.slice(0, 500));
    throw new Error(`Overpass respondió ${res.status} (${res.statusText})`);
  }
}
