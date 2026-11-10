import type enGlossary from '../en/glossary';

// Spanish dictionary, glossary area. Typed against `en/glossary.ts`, so a missing
// or extra key fails `tsc --noEmit` in this file. Merged by `./index.ts`.
const glossary: Record<keyof typeof enGlossary, string> = {
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
};

export default glossary;
