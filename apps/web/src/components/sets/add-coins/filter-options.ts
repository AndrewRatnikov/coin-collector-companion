export interface MenuOption {
  value: string;
  label: string;
}

export function withSelected(values: string[], selected: string): string[] {
  return selected !== '' && !values.includes(selected) ? [...values, selected] : values;
}
