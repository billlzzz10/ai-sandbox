import path from 'node:path';
import validator from 'validator';

const DEFAULT_ALLOWED_COMMAND_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._/:@=,(){}[]+" + ' ';
const DEFAULT_ALLOWED_PATH_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._/:@" + ' ';

export interface SanitizedCommand {
  executable: string;
  args: string[];
  command: string;
}

export function sanitizeShellCommand(input: string, options?: { allowedChars?: string }): SanitizedCommand {
  const allowed = options?.allowedChars ?? DEFAULT_ALLOWED_COMMAND_CHARS;
  const trimmed = validator.trim(input ?? '');
  if (!validator.isLength(trimmed, { min: 1, max: 256 })) {
    throw new Error('Command must be between 1 and 256 characters.');
  }
  if (!validator.isWhitelisted(trimmed, allowed)) {
    throw new Error('Command contains unsupported characters.');
  }
  if (trimmed.includes('\n')) {
    throw new Error('Command must be a single line.');
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error('Command is empty after sanitization.');
  }
  return {
    executable: tokens[0],
    args: tokens.slice(1),
    command: tokens.join(' '),
  };
}

export function sanitizeWorkspacePath(
  inputPath: string,
  baseDir: string = process.env.WORKSPACE_DIR
    ? path.resolve(process.env.WORKSPACE_DIR)
    : path.resolve(process.cwd()),
  options?: { allowedChars?: string },
): string {
  const allowed = options?.allowedChars ?? DEFAULT_ALLOWED_PATH_CHARS;
  const trimmed = validator.trim(inputPath ?? '');
  if (!validator.isLength(trimmed, { min: 1, max: 512 })) {
    throw new Error('File path must be between 1 and 512 characters.');
  }
  if (!validator.isWhitelisted(trimmed, allowed)) {
    throw new Error('File path contains unsupported characters.');
  }
  if (trimmed.includes('\0')) {
    throw new Error('File path contains null bytes.');
  }

  const resolved = path.resolve(baseDir, trimmed);
  const normalizedBase = baseDir.endsWith(path.sep) ? baseDir : `${baseDir}${path.sep}`;
  if (!resolved.startsWith(normalizedBase) && resolved !== baseDir) {
    throw new Error('Resolved path escapes the workspace directory.');
  }
  return resolved;
}

export function truncateForStorage(value: string, limit = 20000): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n...<truncated ${value.length - limit} characters>`;
}
