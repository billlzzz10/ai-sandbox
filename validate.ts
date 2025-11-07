import validator from 'validator';

interface ValidationResult {
  valid: boolean;
  violations: string[];
}

function isYamlFile(path: string): boolean {
  return path.endsWith('.yml') || path.endsWith('.yaml');
}

export function validateRules(diffContent: string): ValidationResult {
  const violations: string[] = [];
  const trimmed = diffContent ?? '';

  if (!validator.isLength(trimmed, { min: 1 })) {
    return { valid: false, violations: ['Diff content cannot be empty.'] };
  }

  const lines = trimmed.split('\n');
  const addedLines = lines.filter(line => line.startsWith('+') && !line.startsWith('+++'));
  const yamlFiles = new Set<string>();

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      const filePath = line.replace('+++ b/', '').trim();
      if (isYamlFile(filePath)) {
        yamlFiles.add(filePath);
      }
    }
  }

  addedLines.forEach(line => {
    const value = line.slice(1);
    if (value.toUpperCase().includes('TODO') || value.toUpperCase().includes('FIXME')) {
      violations.push('Added lines must not contain TODO or FIXME markers.');
    }
    if (/console\.log\s*\(/.test(value)) {
      violations.push('Debug logging (console.log) is not allowed in new code.');
    }
  });

  if (yamlFiles.size > 0) {
    for (const line of addedLines) {
      const value = line.slice(1).trim();
      if (value.includes(':')) {
        const key = value.split(':')[0];
        if (!/^[a-z0-9_]+$/.test(key)) {
          violations.push(`YAML key "${key}" must be snake_case alphanumeric.`);
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
