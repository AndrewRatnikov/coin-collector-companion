import type { MessageKey } from './en';

// `esShape` is explicitly typed as `Record<MessageKey, string>` (not inferred)
// so a missing or extra key is a `tsc --noEmit` compile error — this is what
// enforces en/es key parity, not a convention. Spanish copy here is
// stub/placeholder quality; a native-speaker review pass is a follow-up task,
// not this one. The default export is then widened to `Record<string, string>`
// for the same reason as `en.ts` — see that file's comment.
const esShape: Record<MessageKey, string> = {
  // nav
  'nav.catalog': 'Catálogo',
  'nav.canonicalSets': 'Colecciones canónicas',
  'nav.publicSets': 'Colecciones públicas',
  'nav.dashboard': 'Panel',
  'nav.collection': 'Colección',
  'nav.mySubmissions': 'Mis envíos',
  'nav.logOut': 'Cerrar sesión',
  'nav.logIn': 'Iniciar sesión',
  'nav.brand': 'Coin Collector Companion',
  'nav.signUp': 'Registrarse',

  // language switcher
  'languageSwitcher.english': 'English',
  'languageSwitcher.spanish': 'Español',

  // shared across multiple pages/forms
  'common.somethingWentWrong': 'Algo salió mal. Inténtalo de nuevo.',
  'common.email': 'Correo electrónico',
  'common.password': 'Contraseña',
  'common.country': 'País',
  'common.denomination': 'Denominación',
  'common.name': 'Nombre',
  'common.yearMin': 'Año mínimo',
  'common.yearMax': 'Año máximo',
  'common.year': 'Año',
  'common.mintMark': 'Marca de ceca',
  'common.variety': 'Variedad',
  'common.search': 'Buscar',
  'common.prev': 'Anterior',
  'common.next': 'Siguiente',
  'common.pagePrefix': 'Página',
  'common.ofSeparator': 'de',
  'common.owned': 'en posesión',
  'common.missing': 'faltante',
  'common.clear': 'Borrar',
  'common.close': 'Cerrar',

  // home
  'home.title': 'Coin Collector Companion',
  'home.eyebrow': 'Catálogo y registro personal',
  'home.headline': 'Un lugar tranquilo para registrar lo que tienes, y lo que aún buscas.',
  'home.paragraph':
    'Define una colección a tu manera, marca las monedas que posees y ve los huecos que quedan. Explorar no requiere cuenta.',
  'home.browseCatalogue': 'Explorar el catálogo',
  'home.browseCanonical': 'Explorar colecciones canónicas',
  'home.browsePublic': 'Explorar colecciones de coleccionistas',
  'home.coinsUnit': 'monedas',
  'home.setsUnit': 'colecciones',

  // login
  'login.title': 'Iniciar sesión',
  'login.submit': 'Iniciar sesión',

  // signup
  'signup.title': 'Registrarse',
  'signup.confirmPasswordLabel': 'Confirmar contraseña',
  'signup.passwordsDoNotMatch': 'Las contraseñas no coinciden',
  'signup.submit': 'Registrarse',

  // dashboard
  'dashboard.title': 'Panel',
  'dashboard.errorLoadingSets': 'Algo salió mal al cargar tus colecciones. Inténtalo de nuevo.',
  'dashboard.emptyMessage': 'Todavía no tienes ninguna colección.',
  'dashboard.startFirstSetCta': 'Comienza tu primera colección',
  'dashboard.statSets': 'Colecciones',
  'dashboard.statCoinsOwned': 'Monedas en posesión',
  'dashboard.statAverageCompletion': 'Finalización promedio',

  // collection
  'collection.title': 'Mi colección',
  'collection.errorLoading': 'Algo salió mal al cargar tu colección. Inténtalo de nuevo.',
  'collection.emptyMessage': 'Todavía no tienes ninguna moneda.',

  // catalog
  'catalog.title': 'Catálogo',
  'catalog.addCoinCta': '¿No encuentras esta moneda? Añádela',
  'catalog.addCoinSheetTitle': 'Añadir una moneda',
  'catalog.errorLoading': 'Algo salió mal al cargar el catálogo. Inténtalo de nuevo.',
  'catalog.emptyMessage': 'No se encontraron monedas.',

  // coin detail
  'coinDetail.errorLoading': 'Algo salió mal al cargar esta moneda. Inténtalo de nuevo.',
  'coinDetail.pendingBadge': 'Revisión pendiente',
  'coinDetail.imageAttributionPrefix': 'Imagen:',
  'coinDetail.unknownSource': 'Fuente desconocida',
  'coinDetail.markOwned': 'Marcar como poseída',
  'coinDetail.removeOwned': 'Quitar de la colección',
  'coinDetail.inCollection': 'En tu colección',
  'coinDetail.loginPrompt': 'Inicia sesión para registrar esta moneda en tu colección.',
  'coinDetail.appearsInSets': 'Aparece en tus colecciones',

  // submit coin form
  'submitCoinForm.submit': 'Enviar moneda',

  // submission confirmation
  'submissionConfirmation.addToSetButton': 'Añadir a esta colección',
  'submissionConfirmation.createSetSubmit': 'Crear colección y añadir moneda',
  'submissionConfirmation.viewSetLink': 'Ver colección',

  // set editor
  'setEditor.renameSubmit': 'Renombrar',
  'setEditor.deleteButton': 'Eliminar colección',
  'setEditor.markNotOwned': 'Marcar como no poseída',
  'setEditor.markOwned': 'Marcar como poseída',
  'setEditor.removeButton': 'Quitar',
  'setEditor.addCoinsHeading': 'Añadir monedas',
  'setEditor.addButton': 'Añadir',
  'setEditor.errorLoading': 'Algo salió mal al cargar esta colección. Inténtalo de nuevo.',
  'setEditor.allCoins': 'Todas las monedas',
  'setEditor.missing': 'faltantes',
  'setEditor.addCoins': 'Añadir monedas',
  'setEditor.closePicker': 'Cerrar selector',
  'setEditor.undo': 'Deshacer',
  'setEditor.noCoinsYet': 'Todavía no hay monedas — añade algunas abajo.',

  // canonical sets
  'canonicalSets.title': 'Colecciones canónicas',
  'canonicalSets.errorLoading': 'Algo salió mal al cargar las colecciones canónicas. Inténtalo de nuevo.',
  'canonicalSets.emptyMessage': 'Todavía no hay colecciones canónicas.',

  // canonical set detail
  'canonicalSetDetail.errorLoading': 'Algo salió mal al cargar esta colección canónica. Inténtalo de nuevo.',
  'canonicalSetDetail.cloneCta': 'Clonar a mis colecciones',

  // new set
  'setNew.title': 'Comenzar una nueva colección',
  'setNew.startFromLegend': 'Comenzar desde',
  'setNew.modeBlank': 'Colección en blanco',
  'setNew.modeCanonical': 'Clonar una colección canónica',
  'setNew.modePublic': 'Clonar una colección pública',
  'setNew.selectCanonicalPlaceholder': 'Selecciona una colección canónica…',
  'setNew.selectPublicPlaceholder': 'Selecciona una colección pública…',
  'setNew.defaultError': 'Algo salió mal al crear la colección.',
  'setNew.submit': 'Crear colección',
  'setNew.chooseCanonical': 'Elige una colección canónica',
  'setNew.choosePublic': 'Elige una colección de un coleccionista',
  'setNew.inThisSet': 'En esta colección',
  'setNew.nothingAdded': 'Todavía no se ha añadido nada.',
  'setNew.add': 'Añadir',
  'setNew.remove': 'Quitar',
  'setNew.createSet': 'Crear Colección',
  'setNew.addFromCatalogue': 'Añadir desde el catálogo',

  // public sets
  'publicSets.title': 'Colecciones públicas',
  'publicSets.errorLoading': 'Algo salió mal al cargar las colecciones públicas. Inténtalo de nuevo.',
  'publicSets.emptyMessage': 'Todavía no hay colecciones públicas.',

  // public set detail
  'publicSetDetail.errorLoading': 'Algo salió mal al cargar esta colección. Inténtalo de nuevo.',
  'publicSetDetail.cloneCta': 'Clonar a mis colecciones',
  'publicSetDetail.overlap': 'Ya posees',

  // my submissions
  'mySubmissions.title': 'Mis envíos',
  'mySubmissions.errorLoading': 'Algo salió mal al cargar tus envíos. Inténtalo de nuevo.',
  'mySubmissions.emptyMessage': 'Aún no has enviado ninguna moneda.',
  'mySubmissions.statusPending': 'Pendiente de revisión',
  'mySubmissions.statusApproved': 'Aprobada',
  'mySubmissions.statusRejected': 'No aprobada',

  // footer
  'footer.attributionPrefix': 'Datos del catálogo obtenidos de',
  'footer.wikipediaLinkText': 'Wikipedia',
  'footer.attributionSuffix': ', utilizados bajo CC BY-SA 4.0.',
};

const es: Record<string, string> = esShape;
export default es;
