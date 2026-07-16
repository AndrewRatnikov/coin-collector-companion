// class-validator's default messages lead with the property name (e.g. "email must be an
// email", "password must be longer than or equal to 8 characters"), so a case-insensitive
// prefix match is enough to route each message back to its form field.
export function fieldErrorsFrom(details: string[], fields: string[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const detail of details) {
    const field = fields.find((f) => detail.toLowerCase().startsWith(f.toLowerCase()));
    if (field && !errors[field]) {
      errors[field] = detail;
    }
  }
  return errors;
}
