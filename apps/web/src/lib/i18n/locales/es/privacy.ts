import type enPrivacy from '../en/privacy';

// Spanish dictionary, privacy area: the `/privacy` page (what the app stores, Sentry, PostHog).
// Typed against `en/privacy.ts`, so a missing or extra key fails `tsc --noEmit`. Merged by `./index.ts`.
const privacy: Record<keyof typeof enPrivacy, string> = {
  'privacy.title': 'Privacidad',
  'privacy.intro': 'Qué guarda Coin Collector Companion sobre ti y qué envía a otros servicios.',
  'privacy.storedHeading': 'Qué guarda la app',
  'privacy.storedBody':
    'El email de tu cuenta y un hash de tu contraseña, las colecciones que creas y las monedas que marcas como tuyas con su grado. Nada más.',
  'privacy.errorsHeading': 'Informes de errores',
  'privacy.errorsBody':
    'Cuando algo falla, se envía un informe de error a Sentry. No incluye tu email, tu dirección IP, cookies, el contenido de formularios ni la parte de consulta de las direcciones. Algunas visitas también envían una grabación del diseño de la página con todo el texto, los campos y las imágenes ocultos.',
  'privacy.analyticsHeading': 'Recuento de visitas',
  'privacy.analyticsBody':
    'PostHog cuenta visitas y algunas acciones (registrarse, crear o copiar una colección, marcar monedas como tuyas, imprimir o descargar una lista de búsqueda, y búsquedas en el catálogo sin resultados). De una búsqueda en el catálogo sin resultados solo recibe los filtros y el texto buscado, recortado a 40 caracteres. No usa cookies, no guarda nada en tu navegador y nunca recibe tu email, el id de tu cuenta ni los nombres de tus colecciones.',
};

export default privacy;
