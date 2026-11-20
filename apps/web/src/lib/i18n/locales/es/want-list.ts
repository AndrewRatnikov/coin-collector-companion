import type enWantList from '../en/want-list';

// Spanish dictionary, want-list area: the combined want list across all sets (`/want-list`).
// Typed against `en/want-list.ts`, so a missing or extra key fails `tsc --noEmit`. Merged by `./index.ts`.
const wantList: Record<keyof typeof enWantList, string> = {
  // header
  'wantList.title': 'Lista de faltantes',
  'wantList.subtitle': 'En tus {n} colecciones · {m} faltan · {k} por mejorar',
  'wantList.printButton': 'Imprimir',
  'wantList.downloadCsv': 'Descargar CSV',
  // sections
  'wantList.sectionMissing': 'Faltan',
  'wantList.sectionUpgrade': 'Por mejorar',
  'wantList.upgradeNote': 'Las tienes, pero por debajo del grado mínimo de las colecciones indicadas.',
  'wantList.nothingMissing': 'No falta nada.',
  'wantList.nothingWanted': 'No falta nada en tus colecciones.',
  'wantList.plain': '(sin ceca)',
  'wantList.keyLegend': '★ = fecha clave',
  'wantList.whichSets': '¿Qué colecciones?',
  // loading, error, no sets
  'wantList.loadingLabel': 'Cargando tu lista de faltantes',
  'wantList.errorTitle': 'No pudimos cargar tu lista de faltantes.',
  'wantList.errorBody': 'Revisa tu conexión e inténtalo de nuevo.',
  'wantList.retry': 'Intentar de nuevo',
  'wantList.noSets': 'Aún no tienes colecciones. Crea una para empezar tu lista de faltantes.',
  'wantList.newSetLink': 'Crear una colección',
  // link from a set's missing page
  'wantList.allSetsLink': 'Lista de faltantes de todas tus colecciones',
};

export default wantList;
