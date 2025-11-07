import { promises as fs } from 'node:fs';
import path from 'node:path';
import validator from 'validator';

import { logger } from '../telemetry/logger';
import { sanitizeWorkspacePath } from '../utils/security';

const WORKSPACE_ROOT = process.env.WORKSPACE_DIR
  ? path.resolve(process.env.WORKSPACE_DIR)
  : path.resolve(process.cwd());

const SEARCH_DIRECTORIES = ['.', 'orchestrator', 'serena-adapter', 'telemetry', 'memory'];

function sanitizePattern(pattern: string): RegExp {
  const trimmed = validator.trim(pattern ?? '');
  if (!validator.isLength(trimmed, { min: 1, max: 128 })) {
    throw new Error('Search pattern must be between 1 and 128 characters.');
  }
  if (trimmed.includes('\n')) {
    throw new Error('Search pattern must be a single line.');
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

async function safeReadFile(filePath: string): Promise<string> {
  const resolved = sanitizeWorkspacePath(filePath, WORKSPACE_ROOT);
  return fs.readFile(resolved, 'utf-8');
}

async function findFilesMatching(pattern: RegExp, limit = 25): Promise<any[]> {
  const results: any[] = [];
  const visited = new Set<string>();

  const queue: string[] = SEARCH_DIRECTORIES.map(directory =>
    sanitizeWorkspacePath(directory, WORKSPACE_ROOT),
  );

  while (queue.length > 0 && results.length < limit) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const stat = await fs.stat(current).catch(() => null);
    if (!stat) {
      continue;
    }

    if (stat.isFile()) {
      const content = await fs.readFile(current, 'utf-8');
      const match = pattern.exec(content);
      if (match) {
        const relative = path.relative(WORKSPACE_ROOT, current);
        const beforeMatch = content.slice(0, match.index ?? 0);
        const line = beforeMatch.split('\n').length;
        results.push({
          filePath: relative,
          line,
          match: match[0],
          location: {
            uri: `file://${path.join(WORKSPACE_ROOT, relative)}`,
            range: {
              start: { line: Math.max(0, line - 1), character: 0 },
              end: { line: Math.max(0, line - 1), character: match[0].length },
            },
          },
        });
      }
      continue;
    }

    if (stat.isDirectory()) {
      try {
        const entries = await fs.readdir(current);
        for (const entry of entries) {
          if (['node_modules', '.git', 'dist'].includes(entry)) {
            continue;
          }
          const next = path.join(current, entry);
          const nextStat = await fs.lstat(next).catch(() => null);
          if (nextStat?.isSymbolicLink()) {
            continue; // Skip symbolic links to prevent traversal
          }
          queue.push(next);
        }
      } catch (error) {
        // Skip directories that cannot be read
        continue;
      }
    }
  }

  return results.slice(0, limit);
}

/**
 * Mocks a client for the Serena (MCP) service.
 * In a real implementation, this would make HTTP or gRPC calls.
 */
class SerenaAdapter {
  constructor() {
    logger.info('SerenaAdapter initialized (mock mode).');
  }

  /**
   * Finds the definition of a symbol in a given file.
   * @param filePath - The path to the file.
   * @param symbol - The symbol to find.
   * @returns A mock location of the symbol.
   */
  async find_symbol(filePath: string, symbol: string): Promise<any> {
    const sanitizedPath = sanitizeWorkspacePath(filePath, WORKSPACE_ROOT);
    const safeSymbol = validator.trim(symbol ?? '');
    logger.info(`[SerenaAdapter] Called find_symbol for '${safeSymbol}' in '${sanitizedPath}'`);
    return {
      filePath: path.relative(WORKSPACE_ROOT, sanitizedPath),
      symbol: safeSymbol,
      location: {
        uri: `file://${sanitizedPath}`,
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: Math.max(0, safeSymbol.length - 1) },
        },
      },
    };
  }

  /**
   * Finds all references to a symbol.
   * @param filePath - The path to the file where the symbol is defined.
   * @param symbol - The symbol to find references for.
   * @returns A list of mock reference locations.
   */
  async find_referencing_symbols(filePath: string, symbol: string): Promise<any[]> {
    const sanitizedPath = sanitizeWorkspacePath(filePath, WORKSPACE_ROOT);
    const safeSymbol = validator.trim(symbol ?? '');
    logger.info(
      `[SerenaAdapter] Called find_referencing_symbols for '${safeSymbol}' from '${sanitizedPath}'`,
    );

    const pattern = sanitizePattern(safeSymbol);
    const matches = await findFilesMatching(pattern, 10);

    if (matches.length === 0) {
      return [
        {
          filePath: path.relative(WORKSPACE_ROOT, sanitizedPath),
          location: {
            uri: `file://${sanitizedPath}`,
          },
        },
      ];
    }

    return matches;
  }

  /**
   * Reads the content of a file.
   * NOTE: This is a placeholder. The real implementation might be more complex.
   * @param filePath - The path to the file.
   * @returns The mock content of the file.
   */
  async read_file(filePath: string): Promise<string> {
    const sanitizedPath = sanitizeWorkspacePath(filePath, WORKSPACE_ROOT);
    logger.info(`[SerenaAdapter] Reading file '${sanitizedPath}'`);
    try {
      return await safeReadFile(path.relative(WORKSPACE_ROOT, sanitizedPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read file.';
      logger.error('Failed to read file', { filePath: sanitizedPath, error: message });
      throw new Error(message);
    }
  }

  /**
   * Searches for a pattern in the codebase.
   * @param pattern - The regex pattern to search for.
   * @returns A list of mock search results.
   */
  async search_for_pattern(pattern: string): Promise<any[]> {
    const safePattern = sanitizePattern(pattern);
    logger.info(`[SerenaAdapter] Searching for pattern: ${safePattern}`);
    return findFilesMatching(safePattern, 25);
  }

  /**
   * Writes content to a file. This is intentionally not implemented yet.
   * @param filePath - The path to the file.
   * @param content - The content to write.
   */
  async write_file(filePath: string, content: string): Promise<void> {
    sanitizeWorkspacePath(filePath, WORKSPACE_ROOT);
    logger.warn(`[SerenaAdapter] STUB: write_file called for '${filePath}', but it is disabled.`);
    throw new Error('Writing files is currently disabled in this phase.');
  }
}

export const serenaAdapter = new SerenaAdapter();