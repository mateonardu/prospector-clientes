#!/usr/bin/env node
/**
 * scout-tool: CLI para generar listas de prospectos comerciales
 * desde OpenStreetMap (Overpass API).
 *
 * Uso: node src/index.js --rubro estetica --zona "Caballito" [--radio 2]
 */

import { program } from 'commander';
import { RUBROS } from './rubros.js';
import { geocodificar, queryByTagsAndCentro } from './overpass.js';
import { parseElements, resumen } from './parser.js';
import { exportCSV } from './exporter.js';

program
  .name('scout')
  .description('Genera listas de prospectos comerciales desde OpenStreetMap')
  .requiredOption('--rubro <rubro>', 'rubro a buscar (ej: estetica, barberia, nails)')
  .requiredOption('--zona <zona>', 'ciudad o barrio (ej: "Caballito", "Ramos Mejía")')
  .option('--radio <km>', 'radio de búsqueda en kilómetros', '2')
  .parse();

const opciones = program.opts();
const rubro = opciones.rubro;
const zona = opciones.zona;
const radio = Number(opciones.radio);

async function main() {
  if (!RUBROS[rubro]) {
    console.error(`Rubro no reconocido: ${rubro}`);
    console.error(`Rubros disponibles: ${Object.keys(RUBROS).join(', ')}`);
    process.exit(1);
  }

  if (!Number.isFinite(radio) || radio <= 0) {
    console.error(`Radio inválido: ${opciones.radio}. Debe ser un número mayor a 0.`);
    process.exit(1);
  }

  console.log(`🔍 Buscando ${rubro} en ${zona} (radio: ${radio}km)...`);

  const centro = await geocodificar(zona);
  console.log(`📍 Zona encontrada: ${centro.lat}, ${centro.lon}`);

  console.log('⬇️  Consultando Overpass API...');
  const elements = await queryByTagsAndCentro(RUBROS[rubro], centro, radio);
  console.log(`✅ ${elements.length} resultados obtenidos`);

  console.log('🔄 Procesando...');
  const prospects = parseElements(elements);

  if (prospects.length === 0) {
    console.log(
      `⚠️  No se encontraron negocios para ${rubro} en ${zona}. ` +
        'Probá con un radio mayor o revisá el nombre de la zona.'
    );
    return;
  }

  const stats = resumen(prospects);
  console.log('📊 Resumen:');
  console.log(`   Total: ${stats.total}`);
  console.log(`   Sin web: ${stats.sin_web}  ← tus mejores prospectos`);
  console.log(`   Con web: ${stats.con_web}`);
  console.log(`   Con teléfono: ${stats.con_telefono}`);
  console.log(`   Con Instagram: ${stats.con_instagram}`);

  console.log('💾 Exportando CSV...');
  const ruta = await exportCSV(prospects, zona, rubro);
  console.log(`✅ Listo: ${ruta}`);
}

main().catch((error) => {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
});
