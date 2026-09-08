const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function interpolatePlaceholders(
  template: string,
  variables: Record<string, string | number | undefined | null>,
): string {
  return template.replace(PLACEHOLDER_RE, (_, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function extractPlaceholderKeys(template: string): string[] {
  const keys = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, 'g');
  while ((match = re.exec(template)) !== null) {
    keys.add(match[1]);
  }
  return [...keys];
}