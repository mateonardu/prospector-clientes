/**
 * Mapeo de rubro legible (español) → tags OSM que identifican esa categoría.
 * Para agregar un rubro nuevo, agregá una línea: clave legible → array de tags "key=value".
 *
 * @type {Record<string, string[]>}
 */
export const RUBROS = {
  estetica: ['shop=beauty', 'shop=beauty_salon', 'amenity=beauty_salon'],
  barberia: ['shop=barber', 'shop=barbershop'],
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
