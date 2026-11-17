import type enAccount from '../en/account';

// Spanish dictionary, account area. Typed against `en/account.ts`, so a missing
// or extra key fails `tsc --noEmit` in this file. Merged by `./index.ts`.
const account: Record<keyof typeof enAccount, string> = {
  // login
  'login.title': 'Iniciar sesión',
  'login.submit': 'Iniciar sesión',
  'login.forgotPasswordLink': '¿Olvidaste tu contraseña?',
  'login.passwordResetNotice': 'Tu contraseña se restableció. Inicia sesión con tu nueva contraseña.',

  // forgot / reset password
  'forgotPassword.title': 'Restablecer contraseña',
  'forgotPassword.intro': 'Introduce el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.',
  'forgotPassword.submit': 'Enviar enlace',
  'forgotPassword.sent': 'Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer tu contraseña. El enlace caduca en 1 hora.',
  'forgotPassword.tooManyRequests': 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
  'forgotPassword.backToLogin': 'Volver a iniciar sesión',
  'resetPassword.title': 'Elige una nueva contraseña',
  'resetPassword.newPasswordLabel': 'Nueva contraseña',
  'resetPassword.confirmPasswordLabel': 'Confirmar nueva contraseña',
  'resetPassword.passwordsDoNotMatch': 'Las contraseñas no coinciden',
  'resetPassword.submit': 'Guardar nueva contraseña',
  'resetPassword.invalidLink': 'Este enlace no es válido o ha caducado.',
  'resetPassword.requestNewLink': 'Solicitar un nuevo enlace',

  // signup
  'signup.title': 'Registrarse',
  'signup.confirmPasswordLabel': 'Confirmar contraseña',
  'signup.passwordsDoNotMatch': 'Las contraseñas no coinciden',
  'signup.submit': 'Registrarse',

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
  'settings.accountTabLabel': 'Cuenta',
  'settings.feedbackTabLabel': 'Comentarios',
  'settings.feedbackTitle': 'Enviar comentarios',
  'settings.feedbackTextLabel': 'Tus comentarios',
  'settings.feedbackSubmit': 'Enviar comentarios',
  'settings.feedbackSuccess': '¡Gracias por tus comentarios!',
  'settings.feedbackError': 'Ocurrió un error al enviar tus comentarios. Inténtalo de nuevo.',
  'settings.feedbackValidationEmpty': 'Escribe algún comentario antes de enviar.',
  'settings.feedbackValidationTooLong': 'Los comentarios deben tener 2000 caracteres o menos.',
  'settings.deleteAccountTitle': 'Eliminar cuenta',
  'settings.deleteAccountIntro': 'Elimina de forma permanente tu cuenta y tus datos personales.',
  'settings.deleteAccountOpen': 'Eliminar cuenta',
  'settings.deleteAccountWhatIsDeleted': 'Esto elimina de forma permanente tus colecciones, tus monedas registradas y tus comentarios.',
  'settings.deleteAccountWhatStays': 'Las monedas que enviaste al catálogo permanecen en él, sin vínculo contigo.',
  'settings.deleteAccountPasswordLabel': 'Contraseña actual',
  'settings.deleteAccountAcknowledge': 'Entiendo que esto no se puede deshacer',
  'settings.deleteAccountSubmit': 'Eliminar mi cuenta de forma permanente',
  'settings.deleteAccountCancel': 'Cancelar',
  'settings.deleteAccountWrongPassword': 'La contraseña es incorrecta.',
  'settings.deleteAccountError': 'Ocurrió un error al eliminar tu cuenta. Inténtalo de nuevo.',
};

export default account;
