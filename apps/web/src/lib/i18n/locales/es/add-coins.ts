import type enAddCoins from '../en/add-coins';

// Spanish dictionary, add-coins area. Typed against `en/add-coins.ts`, so a missing
// or extra key fails `tsc --noEmit` in this file. Merged by `./index.ts`.
const addCoins: Record<keyof typeof enAddCoins, string> = {
  // Add coins sheet (/sets/[id], Phase 5 redesign)
  'addCoins.title': 'Añadir monedas',
  'addCoins.toSet': 'a {name}',
  'addCoins.done': 'Listo',
  'addCoins.searchLabel': 'Buscar en el catálogo',
  'addCoins.searchPlaceholder': 'Buscar por nombre',
  'addCoins.anyCountry': 'Cualquier país',
  'addCoins.anyDenomination': 'Cualquier valor',
  'addCoins.anyYear': 'Cualquier año',
  'addCoins.hideInSet': 'Ocultar las de esta colección',
  'addCoins.resultsOne': '1 resultado',
  'addCoins.results': '{n} resultados',
  'addCoins.add': 'Añadir',
  'addCoins.addLabel': 'Añadir {title} ({sub}) a esta colección',
  'addCoins.addLabelNoSub': 'Añadir {title} a esta colección',
  'addCoins.adding': 'Añadiendo…',
  'addCoins.added': '✓ Añadida',
  'addCoins.undo': 'Deshacer',
  'addCoins.undoLabel': 'Deshacer añadir {title}',
  'addCoins.already': 'Ya añadida',
  'addCoins.addFailed': 'No se pudo añadir esta moneda. Inténtalo de nuevo.',
  'addCoins.undoFailed': 'No se pudo deshacer. Inténtalo de nuevo.',
  'addCoins.footerOne': '1 moneda añadida',
  'addCoins.footer': '{n} monedas añadidas',
  'addCoins.footerHint': 'Las monedas añadidas aparecen en la colección al instante.',
  'addCoins.liveAdded': 'Se añadió {title} a esta colección.',
  'addCoins.liveRemoved': 'Se quitó {title} de esta colección.',
  'addCoins.liveAddFailed': 'No se pudo añadir {title}.',
  'addCoins.liveUndoFailed': 'No se pudo deshacer añadir {title}.',
  'addCoins.empty': 'Ninguna moneda coincide con estos filtros.',
  'addCoins.loadError': 'No pudimos cargar el catálogo.',
  'addCoins.retry': 'Reintentar',
  'addCoins.showMore': 'Mostrar más',
  'addCoins.loading': 'Cargando monedas',
};

export default addCoins;
