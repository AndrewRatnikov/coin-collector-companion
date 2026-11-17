import type enBrowseSets from '../en/browse-sets';

// Spanish dictionary, browse-sets area. Typed against `en/browse-sets.ts`, so a missing
// or extra key fails `tsc --noEmit` in this file. Merged by `./index.ts`.
const browseSets: Record<keyof typeof enBrowseSets, string> = {
  // dashboard
  'dashboard.title': 'Mis colecciones',
  'dashboard.setCountOne': '1 colección',
  'dashboard.setCountMany': '{n} colecciones',
  'dashboard.browseLink': 'Explorar listas y colecciones de otros coleccionistas',
  'dashboard.browseLinkShort': 'Explorar listas',
  'dashboard.newSet': 'Nueva colección',
  'dashboard.summaryLabel': 'Resumen',
  'dashboard.tileMissingLabel': 'monedas que aún faltan en tus colecciones',
  'dashboard.tileMissingLink': 'Ver qué buscar',
  'dashboard.tileClosestLabel': 'Más cerca de completarse',
  'dashboard.tileClosestToGoOne': 'Falta 1 moneda',
  'dashboard.tileClosestToGoMany': 'Faltan {n} monedas',
  'dashboard.tileClosestComplete': 'Todas las colecciones están completas',
  'dashboard.tileClosestNoCoins': 'Añade monedas a una colección para ver el progreso',
  'dashboard.tileCollectionLabel': 'monedas en tu colección',
  'dashboard.tileCollectionLink': 'Abrir colección',
  'dashboard.yourSets': 'Tus colecciones',
  'dashboard.sortLabel': 'Ordenar',
  'dashboard.sortClosest': 'Más cerca de completarse',
  'dashboard.sortRecent': 'Actualizadas recientemente',
  'dashboard.sortName': 'Nombre A–Z',
  'dashboard.sortMostMissing': 'Más monedas faltantes',
  'dashboard.sourceCurated': 'De una lista curada',
  'dashboard.sourceCollector': 'De la colección de otro coleccionista',
  'dashboard.suggestionEyebrow': 'Una buena próxima colección',
  'dashboard.suggestionBody':
    '{total} monedas. Ya tienes {owned} de ellas, porque la posesión se comparte entre colecciones.',
  'dashboard.suggestionCta': 'Empezar esta colección',
  'dashboard.emptyTitle': 'Comienza tu primera colección',
  'dashboard.emptyBody':
    'Una colección es una lista de monedas. Marca las que tienes y te mostraremos exactamente lo que falta. La forma más rápida de empezar es una lista curada.',
  'dashboard.emptyCuratedCta': 'Elegir una lista curada',
  'dashboard.popularChecklists': 'Listas populares',
  'dashboard.popularCoinCount': '{n} monedas',
  'dashboard.emptyPickYourself': '¿Prefieres elegir cada moneda tú mismo?',
  'dashboard.emptyStartBlank': 'Empezar una colección vacía',
  'dashboard.loadingLabel': 'Cargando tus colecciones',
  'dashboard.errorTitle': 'No pudimos cargar tus colecciones.',
  'dashboard.errorBody':
    'Tus colecciones están a salvo. Revisa tu conexión e inténtalo de nuevo. Si el servidor estaba inactivo, puede tardar hasta un minuto en activarse.',
  'dashboard.retry': 'Intentar de nuevo',

  // canonical sets
  'canonicalSets.title': 'Colecciones canónicas',
  'canonicalSets.errorLoading': 'Algo salió mal al cargar las colecciones canónicas. Inténtalo de nuevo.',
  'canonicalSets.emptyMessage': 'Todavía no hay colecciones canónicas.',

  // canonical set detail
  'canonicalSetDetail.errorLoading': 'Algo salió mal al cargar esta colección canónica. Inténtalo de nuevo.',
  'canonicalSetDetail.cloneCta': 'Clonar a mis colecciones',

  // public sets
  'publicSets.title': 'Colecciones públicas',
  'publicSets.errorLoading': 'Algo salió mal al cargar las colecciones públicas. Inténtalo de nuevo.',
  'publicSets.emptyMessage': 'Todavía no hay colecciones públicas.',

  // public set detail
  'publicSetDetail.errorLoading': 'Algo salió mal al cargar esta colección. Inténtalo de nuevo.',
  'publicSetDetail.cloneCta': 'Clonar a mis colecciones',
};

export default browseSets;
