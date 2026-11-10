// English dictionary, account area: login, forgotPassword, resetPassword, signup and settings keys.
// Merged into the full dictionary by `./index.ts` (see that file for the typing).
const account = {
  // login
  'login.title': 'Log in',
  'login.submit': 'Log in',
  'login.forgotPasswordLink': 'Forgot password?',
  'login.passwordResetNotice': 'Your password was reset. Log in with your new password.',

  // forgot / reset password
  'forgotPassword.title': 'Reset your password',
  'forgotPassword.intro': "Enter the email for your account and we'll send you a link to set a new password.",
  'forgotPassword.submit': 'Send reset link',
  'forgotPassword.sent': "If an account exists for that email, we've sent a link to reset your password. The link expires in 1 hour.",
  'forgotPassword.tooManyRequests': 'Too many reset requests. Please try again later.',
  'forgotPassword.backToLogin': 'Back to log in',
  'resetPassword.title': 'Choose a new password',
  'resetPassword.newPasswordLabel': 'New password',
  'resetPassword.confirmPasswordLabel': 'Confirm new password',
  'resetPassword.passwordsDoNotMatch': 'Passwords do not match',
  'resetPassword.submit': 'Set new password',
  'resetPassword.invalidLink': 'This reset link is invalid or has expired.',
  'resetPassword.requestNewLink': 'Request a new link',

  // signup
  'signup.title': 'Sign up',
  'signup.confirmPasswordLabel': 'Confirm password',
  'signup.passwordsDoNotMatch': 'Passwords do not match',
  'signup.submit': 'Sign up',

  // settings
  'settings.title': 'Settings',
  'settings.emailLabel': 'Email',
  'settings.memberSinceLabel': 'Member since',
  'settings.changePasswordTitle': 'Change password',
  'settings.currentPasswordLabel': 'Current password',
  'settings.newPasswordLabel': 'New password',
  'settings.confirmNewPasswordLabel': 'Confirm new password',
  'settings.passwordsDoNotMatch': 'Passwords do not match',
  'settings.changePasswordSubmit': 'Change password',
  'settings.changePasswordSuccess': 'Password changed successfully.',
  'settings.changePasswordError': 'Something went wrong changing your password. Please try again.',
  'settings.accountTabLabel': 'Account',
  'settings.feedbackTabLabel': 'Feedback',
  'settings.feedbackTitle': 'Send feedback',
  'settings.feedbackTextLabel': 'Your feedback',
  'settings.feedbackSubmit': 'Submit feedback',
  'settings.feedbackSuccess': 'Thanks for your feedback!',
  'settings.feedbackError': 'Something went wrong sending your feedback. Please try again.',
  'settings.feedbackValidationEmpty': 'Please enter some feedback before submitting.',
  'settings.feedbackValidationTooLong': 'Feedback must be 2000 characters or fewer.',
  'settings.deleteAccountTitle': 'Delete account',
  'settings.deleteAccountIntro': 'Permanently delete your account and personal data.',
  'settings.deleteAccountOpen': 'Delete account',
  'settings.deleteAccountWhatIsDeleted': 'This permanently deletes your sets, your collection and your feedback.',
  'settings.deleteAccountWhatStays': 'Coins you submitted to the catalog stay in the catalog, no longer linked to you.',
  'settings.deleteAccountPasswordLabel': 'Current password',
  'settings.deleteAccountAcknowledge': 'I understand this cannot be undone',
  'settings.deleteAccountSubmit': 'Permanently delete my account',
  'settings.deleteAccountCancel': 'Cancel',
  'settings.deleteAccountWrongPassword': 'Password is incorrect.',
  'settings.deleteAccountError': 'Something went wrong deleting your account. Please try again.',
} satisfies Record<string, string>;

export default account;
