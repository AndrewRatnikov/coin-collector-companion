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
  'nav.sets': 'Colecciones',
  'nav.canonicalSets': 'Colecciones canónicas',
  'nav.publicSets': 'Colecciones públicas',
  'nav.dashboard': 'Panel',
  'nav.collection': 'Colección',
  'nav.mySubmissions': 'Mis envíos',
  'nav.logOut': 'Cerrar sesión',
  'nav.logIn': 'Iniciar sesión',
  'nav.brand': 'Coin Collector Companion',
  'nav.signUp': 'Registrarse',
  'nav.glossary': 'Glosario',
  'nav.account': 'Cuenta',
  'nav.settings': 'Configuración',

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
  'common.cancel': 'Cancelar',

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
  'setEditor.deleteConfirmTitle': '¿Eliminar esta colección?',
  'setEditor.deleteConfirmMessage': 'Esta acción no se puede deshacer.',
  'setEditor.markNotOwned': 'Marcar como no poseída',
  'setEditor.markOwned': 'Marcar como poseída',
  'setEditor.removeButton': 'Quitar',
  'setEditor.addCoinsHeading': 'Añadir monedas',
  'setEditor.addButton': 'Añadir',
  'setEditor.errorLoading': 'Algo salió mal al cargar esta colección. Inténtalo de nuevo.',
  'setEditor.allCoins': 'Todas las monedas',
  'setEditor.missing': 'faltantes',
  'setEditor.addCoins': 'Añadir monedas',
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

  // glossary
  'glossary.pageTitle': 'Glosario',
  'glossary.intro':
    'Una referencia rápida al vocabulario del coleccionismo de monedas: primero los términos que usa esta app directamente, luego términos numismáticos generales que puedes encontrar en otros lugares.',
  'glossary.appTermsHeading': 'Términos que usa esta app',
  'glossary.generalTermsHeading': 'Términos generales de numismática',
  'glossary.term.canonicalSet': 'Colección canónica',
  'glossary.definition.canonicalSet':
    'Una colección de monedas curada por un administrador (p. ej., "Lincoln Wheat Cents") que cualquier usuario puede clonar como punto de partida para su propia colección.',
  'glossary.term.cloningASet': 'Clonar una colección',
  'glossary.definition.cloningASet':
    'Copiar la lista de monedas de otra colección a una nueva colección propia, ya sea desde una colección canónica o desde la colección pública de otro usuario. La propiedad no se copia, solo la lista de monedas.',
  'glossary.term.completionPercentage': 'Porcentaje de finalización',
  'glossary.definition.completionPercentage':
    'La proporción de monedas de una colección que actualmente posees, mostrada como un porcentaje redondeado en la vista de vacíos de la colección.',
  'glossary.term.country': 'País',
  'glossary.definition.country':
    'El país emisor de una moneda (p. ej., EE. UU.), uno de los campos usados para identificarla en el catálogo.',
  'glossary.term.denomination': 'Denominación',
  'glossary.definition.denomination': 'El valor nominal de una moneda (p. ej., centavo, níquel, dólar).',
  'glossary.term.gapView': 'Vista de vacíos',
  'glossary.definition.gapView':
    'La lista, para una de tus colecciones, de qué monedas ya posees y cuáles aún faltan.',
  'glossary.term.mintMark': 'Marca de ceca',
  'glossary.definition.mintMark':
    'Una pequeña letra en una moneda que indica qué ceca la produjo (p. ej., "S" para San Francisco, "D" para Denver). Las monedas sin marca de ceca se acuñaron en la ceca principal de Filadelfia.',
  'glossary.term.ownership': 'Propiedad',
  'glossary.definition.ownership':
    'Marcar una moneda del catálogo como una que posees. La propiedad es global a tu cuenta: poseer una moneda una vez cuenta para todas las colecciones en las que aparece, no solo una.',
  'glossary.term.publicSet': 'Colección pública',
  'glossary.definition.publicSet':
    'Toda colección creada en esta app es visible y clonable por otros usuarios de forma predeterminada; todavía no existe la opción de colección privada.',
  'glossary.term.userSet': 'Colección de usuario',
  'glossary.definition.userSet':
    'Una colección que has creado tú mismo, ya sea desde cero, filtrando el catálogo o clonando una colección canónica o pública.',
  'glossary.term.variety': 'Variedad',
  'glossary.definition.variety':
    'Una característica distintiva de una moneda específica más allá del año o la marca de ceca (p. ej., un cambio de diseño o un error de acuñación), cuando el catálogo la registra.',
  'glossary.term.grade': 'Grado',
  'glossary.definition.grade':
    'Una calificación estandarizada del estado físico de una moneda, desde muy desgastada hasta impecable (p. ej., Bueno, Fino, Sin circular).',
  'glossary.term.keyDate': 'Fecha clave',
  'glossary.definition.keyDate':
    'Un año (y a veces marca de ceca) de un tipo de moneda que se acuñó en cantidades inusualmente bajas, lo que la hace más difícil de encontrar y más valiosa que otras de la misma serie.',
  'glossary.term.mintage': 'Acuñación',
  'glossary.definition.mintage':
    'La cantidad total de monedas de un tipo determinado producidas en un año y ceca dados.',
  'glossary.term.numismatics': 'Numismática',
  'glossary.definition.numismatics': 'El estudio o coleccionismo de monedas, fichas y papel moneda.',
  'glossary.term.obverse': 'Anverso',
  'glossary.definition.obverse': 'El lado frontal (o "cara") de una moneda.',
  'glossary.term.patina': 'Pátina',
  'glossary.definition.patina':
    'El color o brillo natural que la superficie de una moneda desarrolla con el tiempo por el uso y la edad.',
  'glossary.term.proof': 'Prueba',
  'glossary.definition.proof':
    'Una moneda acuñada mediante un proceso especial de alta precisión para coleccionistas, con un acabado espejado, en lugar de para circulación general.',
  'glossary.term.reverse': 'Reverso',
  'glossary.definition.reverse': 'El lado posterior (o "cruz") de una moneda.',
  'glossary.term.uncirculated': 'Sin circular',
  'glossary.definition.uncirculated':
    'Una moneda que no muestra desgaste por haber sido usada en transacciones cotidianas.',

  // settings
  'settings.title': 'Configuración',
  'settings.emailLabel': 'Correo electrónico',
  'settings.memberSinceLabel': 'Miembro desde',
  'settings.changePasswordTitle': 'Cambiar contraseña',
  'settings.currentPasswordLabel': 'Contraseña actual',
  'settings.newPasswordLabel': 'Nueva contraseña',
  'settings.confirmNewPasswordLabel': 'Confirmar nueva contraseña',
  'settings.passwordsDoNotMatch': 'Las contraseñas no coinciden',
  'settings.changePasswordSubmit': 'Cambiar contraseña',
  'settings.changePasswordSuccess': 'Contraseña actualizada correctamente.',
  'settings.changePasswordError': 'Ocurrió un error al cambiar tu contraseña. Inténtalo de nuevo.',
};

const es: Record<string, string> = esShape;
export default es;
