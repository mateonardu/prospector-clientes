/**
 * Mapeo de rubro legible (español) → tags OSM que identifican esa categoría.
 * Para agregar un rubro nuevo, agregá una línea: clave legible → array de entradas.
 * Cada entrada es un tag "key=value", o un objeto { tag, nombre } donde
 * `nombre` es un regex (case-insensitive) que debe matchear el nombre del
 * negocio — útil cuando OSM no tiene un tag específico para el rubro.
 *
 * @typedef {string | { tag: string, nombre: string }} EntradaRubro
 * @type {Record<string, EntradaRubro[]>}
 */
export const RUBROS = {
  estetica: ['shop=beauty', 'shop=beauty_salon', 'amenity=beauty_salon'],
  // Las barberías casi nunca tienen tag propio en OSM: están cargadas
  // como shop=hairdresser con "barber/barbería" en el nombre.
  barberia: ['shop=barber', { tag: 'shop=hairdresser', nombre: 'barber' }],
  nails: ['shop=nail_salon'],
  peluqueria: ['shop=hairdresser'],
  spa: ['leisure=spa', 'shop=massage'],
  salud: ['amenity=dentist', 'amenity=doctors', 'amenity=physiotherapist'],
  veterinaria: ['amenity=veterinary'],
};

/**
 * Devuelve los tags OSM de un rubro, o lanza un error con los rubros disponibles.
 *
 * @param {string} rubro - Nombre del rubro (clave de RUBROS).
 * @returns {string[]} Tags OSM asociados al rubro.
 */
export function tagsDeRubro(rubro) {
  const tags = RUBROS[rubro];
  if (!tags) {
    const disponibles = Object.keys(RUBROS).join(', ');
    throw new Error(`Rubro desconocido: "${rubro}". Disponibles: ${disponibles}`);
  }
  return tags;
}
