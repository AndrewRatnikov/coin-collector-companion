import type enLanding from '../en/landing';

// Spanish dictionary, landing area. Drop into apps/web/src/lib/i18n/locales/es/landing.ts.
// Typed against `en/landing.ts`, so a missing or extra key fails `tsc --noEmit`.
const landing: Record<keyof typeof enLanding, string> = {
  // hero
  'landing.eyebrow': 'Para coleccionistas de monedas',
  'landing.headline': 'Mira lo que aún te falta.',
  'landing.headlineAltRules': 'Tu lista, tus reglas.',
  'landing.headlineAltShow': 'Lleva tu lista de faltantes a la feria.',
  'landing.body':
    'Arma una lista a tu manera, marca las monedas que tienes y los huecos aparecen solos. Gratis, sin servicios de certificación, y para explorar no necesitas cuenta.',
  'landing.bodyShort':
    'Arma una lista a tu manera, marca las monedas que tienes y los huecos aparecen solos. Gratis y sin certificación.',
  'landing.ctaPrimary': 'Crear una cuenta gratis',
  'landing.ctaSecondary': 'Ver listas',
  'landing.honest': 'Gratis. Hecho por un coleccionista, para coleccionistas.',

  // demo
  'landing.sampleBadge': 'Ejemplo',
  'landing.sampleLabel': 'Lista de ejemplo. Tus colecciones se verán así.',
  'landing.sampleLabelShort': 'Tus colecciones se verán así.',
  'landing.demoSubtitle': 'Lista curada · Estados Unidos · 1 centavo · primeras {shown} de {total} monedas',
  'landing.demoSubtitleShort': 'Lista curada · Estados Unidos · {from}–{to}',
  'landing.progressLabel': 'Progreso de la colección de ejemplo',
  'landing.ownedOf': 'de',
  'landing.ownedWord': 'conseguidas',
  'landing.showLabel': 'Mostrar',
  'landing.filterAll': 'Todas',
  'landing.filterMissing': 'Faltantes',
  'landing.statusOwned': 'La tengo',
  'landing.statusMissing': 'Falta',
  'landing.keyDate': 'Fecha clave',
  'landing.groupSummary': '{owned} de {total}',
  'landing.autoNote': 'Solo se muestran los huecos.',
  'landing.tapNote': 'Toca Faltantes para ver solo los huecos.',
  'landing.tryHint': 'Toca una moneda para marcarla como conseguida o faltante.',
  'landing.markOwned': 'Marcar {coin} como conseguida (ejemplo, no se guarda)',
  'landing.markMissing': 'Marcar {coin} como faltante (ejemplo, no se guarda)',
  'landing.saveNote': 'Aquí no se guarda nada. Crea una cuenta para guardar la tuya.',
  'landing.demoFoot': 'Se muestran centavos Lincoln Wheat de {from}–{to}.',
  'landing.seeFull': 'Ver la lista completa',
  'landing.plain': '(sin ceca)',

  // want list
  'landing.wantTitle': 'Lista de faltantes',
  'landing.wantCountOne': '1 moneda',
  'landing.wantCountOther': '{count} monedas',
  'landing.wantEmpty': 'No falta nada. Esta colección está completa.',
  'landing.wantKey': '★ = fecha clave',
  'landing.wantPrint': 'Imprimir',
  'landing.wantCsv': 'Descargar CSV',
  'landing.wantNote': 'La misma lista que imprimen y exportan tus colecciones.',

  // three points
  'landing.pointsHeading': 'Cómo funciona',
  'landing.p1Title': 'Tu lista, tus reglas',
  'landing.p1Body': 'Crea una colección con un filtro del catálogo, elige monedas una a una o parte de una lista curada.',
  'landing.p1ChipFilter': 'Filtro del catálogo',
  'landing.p1ChipHand': 'Elegir a mano',
  'landing.p1ChipCurated': 'Lista curada',
  'landing.p2Title': 'La marcas una vez, cuenta en todas',
  'landing.p2Body': 'Marca una moneda una vez y se actualizan todas las colecciones que la incluyen.',
  'landing.p3Title': 'Lleva tu lista a la feria',
  'landing.p3Body': 'Imprime la lista de faltantes o descárgala en CSV.',

  // ways in
  'landing.waysHeading': 'Empieza a explorar',
  'landing.wayCatalogTitle': 'Explorar el catálogo',
  'landing.wayCatalogBody': 'Todas las monedas, por país, denominación y año.',
  'landing.wayCatalogCount': '{count} monedas',
  'landing.wayChecklistsTitle': 'Listas curadas',
  'landing.wayChecklistsBody': 'Series completas, listas para empezar.',
  'landing.wayChecklistsCountOne': '1 lista',
  'landing.wayChecklistsCountOther': '{count} listas',
  'landing.wayCollectorsTitle': 'Colecciones de otros coleccionistas',
  'landing.wayCollectorsBody': 'Colecciones que otros han compartido.',
  'landing.wayCollectorsCountNone': 'Aún no hay ninguna. La tuya puede ser la primera.',
  'landing.wayCollectorsCountNoneShort': 'Aún ninguna',
  'landing.wayCollectorsCountOne': '1 colección',
  'landing.wayCollectorsCountOther': '{count} colecciones',
  'landing.waking': 'Despertando el servidor. En la primera visita puede tardar hasta un minuto.',
  'landing.countsError': 'No se pudieron cargar los totales.',
  'landing.retry': 'Reintentar',
  'landing.loadingCount': 'Cargando total',

  // coverage
  'landing.coverageHeading': 'Qué incluye',
  'landing.coverageIntro': 'Un catálogo pequeño, revisado a mano. Crece moneda a moneda.',
  'landing.coverageSubmit': '¿Falta una moneda? Envíala.',
  'landing.coverageLincolnTitle': 'Centavos Lincoln Wheat',
  'landing.coverageLincolnBody': 'Cada fecha y ceca, más una lista de fechas clave.',
  'landing.coverageLincolnMeta': '{coins} monedas · {keyDates} fechas clave',
  'landing.coverageUkraineTitle': 'Monedas de Ucrania',
  'landing.coverageUkraineBody':
    'Monedas de circulación y conmemorativas de circulación, incluida «We Are Strong. We Are Together».',
  'landing.coverageUkraineMeta': '{circulation} de circulación · {commemoratives} conmemorativas',

  // metadata
  'landing.metaDescription': 'Listas gratuitas para coleccionistas de monedas. Marca lo que tienes y mira lo que aún te falta.',
  'landing.socialSub': 'Listas gratuitas para coleccionistas de monedas.',
};

export default landing;
