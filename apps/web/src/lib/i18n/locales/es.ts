import type { MessageKey } from './en';

// Explicitly typed as `Record<MessageKey, string>` (not inferred) so a missing
// or extra key is a `tsc --noEmit` compile error — this is what enforces
// en/es key parity, not a convention. Spanish copy here is stub/placeholder
// quality; a native-speaker review pass is a follow-up task, not this one.
const es: Record<MessageKey, string> = {
  // nav
  'nav.catalog': 'Catálogo',
  'nav.canonicalSets': 'Colecciones canónicas',
  'nav.publicSets': 'Colecciones públicas',
  'nav.dashboard': 'Panel',
  'nav.collection': 'Colección',
  'nav.logOut': 'Cerrar sesión',
  'nav.logIn': 'Iniciar sesión',

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

  // home
  'home.title': 'Coin Collector Companion',

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

  // collection
  'collection.title': 'Mi colección',
  'collection.errorLoading': 'Algo salió mal al cargar tu colección. Inténtalo de nuevo.',
  'collection.emptyMessage': 'Todavía no tienes ninguna moneda.',

  // catalog
  'catalog.title': 'Catálogo',
  'catalog.addCoinCta': '¿No encuentras esta moneda? Añádela',
  'catalog.errorLoading': 'Algo salió mal al cargar el catálogo. Inténtalo de nuevo.',
  'catalog.emptyMessage': 'No se encontraron monedas.',

  // coin detail
  'coinDetail.errorLoading': 'Algo salió mal al cargar esta moneda. Inténtalo de nuevo.',
  'coinDetail.pendingBadge': 'Revisión pendiente',
  'coinDetail.imageAttributionPrefix': 'Imagen:',
  'coinDetail.unknownSource': 'Fuente desconocida',

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

  // public sets
  'publicSets.title': 'Colecciones públicas',
  'publicSets.errorLoading': 'Algo salió mal al cargar las colecciones públicas. Inténtalo de nuevo.',
  'publicSets.emptyMessage': 'Todavía no hay colecciones públicas.',

  // public set detail
  'publicSetDetail.errorLoading': 'Algo salió mal al cargar esta colección. Inténtalo de nuevo.',
  'publicSetDetail.cloneCta': 'Clonar a mis colecciones',

  // footer
  'footer.attributionPrefix': 'Datos del catálogo obtenidos de',
  'footer.wikipediaLinkText': 'Wikipedia',
  'footer.attributionSuffix': ', utilizados bajo CC BY-SA 4.0.',
};

export default es;
