/** Replaces every `{key}` in the template with `String(value)`; unknown placeholders stay as they are. */
export function fill(template: string, values: Record<string, string | number>): string {
  let text = template;
  for (const [key, value] of Object.entries(values)) {
    text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}
