# scout-tool

CLI que genera listas de prospectos comerciales (CSV) buscando negocios por rubro y zona en OpenStreetMap, vía la API pública de Overpass.

## Instalación

```bash
npm install
```

Requiere Node.js 18 o superior (usa `fetch` nativo).

## Uso

```bash
npm run scout -- --rubro [rubro] --zona "[zona]" --radio [km]
```

- `--rubro` (requerido): categoría de negocio a buscar (ver lista abajo)
- `--zona` (requerido): ciudad o barrio, entre comillas si tiene espacios
- `--radio` (opcional): radio de búsqueda en kilómetros, default `2`

Ejemplos:

```bash
npm run scout -- --rubro estetica --zona "Caballito"
npm run scout -- --rubro barberia --zona "Ramos Mejía" --radio 3
npm run scout -- --rubro veterinaria --zona "Morón, Buenos Aires" --radio 5
```

El CSV se genera en `output/`, con nombre `prospects_{zona}_{rubro}_{fecha}.csv`.

## Rubros disponibles

| Rubro | Busca en OSM |
|---|---|
| `estetica` | centros de estética y belleza |
| `barberia` | barberías |
| `nails` | salones de uñas |
| `peluqueria` | peluquerías |
| `spa` | spas y masajes |
| `salud` | dentistas, médicos, fisioterapeutas |
| `veterinaria` | veterinarias |

Para agregar un rubro nuevo, sumá una línea al objeto `RUBROS` en `src/rubros.js`.

## Nota sobre timeouts de Overpass

La API pública de Overpass (`overpass-api.de`) se satura seguido y puede responder `504 Gateway Timeout` o `429 Too Many Requests`. Es normal: la herramienta reintenta automáticamente hasta 3 veces con espera creciente antes de fallar. Si igual falla, esperá unos minutos y volvé a correr el comando.
