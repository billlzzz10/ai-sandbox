import { logger } from '../telemetry/logger';

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
    logger.info(`[SerenaAdapter] Called find_symbol for '${symbol}' in '${filePath}'`);
    // Mock response
    return {
      filePath,
      symbol,
      location: {
        uri: `file://${process.cwd()}/${filePath}`,
        range: {
          start: { line: 10, character: 4 },
          end: { line: 10, character: 15 },
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
    logger.info(`[SerenaAdapter] Called find_referencing_symbols for '${symbol}' from '${filePath}'`);
    // Mock response
    return [
      {
        filePath: 'some/other/file.ts',
        location: {
          uri: `file://${process.cwd()}/some/other/file.ts`,
          range: {
            start: { line: 5, character: 20 },
            end: { line: 5, character: 31 },
          },
        },
      },
    ];
  }

  /**
   * Reads the content of a file.
   * NOTE: This is a placeholder. The real implementation might be more complex.
   * @param filePath - The path to the file.
   * @returns The mock content of the file.
   */
  async read_file(filePath: string): Promise<string> {
    logger.info(`[SerenaAdapter] Called read_file for '${filePath}'`);
    // Mock response
    return `// Mock content of ${filePath}\\nconsole.log("hello world");`;
  }

  /**
   * Searches for a pattern in the codebase.
   * @param pattern - The regex pattern to search for.
   * @returns A list of mock search results.
   */
  async search_for_pattern(pattern: string): Promise<any[]> {
    logger.info(`[SerenaAdapter] Called search_for_pattern with pattern: ${pattern}`);
    // Mock response
    return [
      {
        filePath: 'some/file.ts',
        line: 42,
        match: 'some matching text',
      },
    ];
  }

  /**
   * Writes content to a file. This is intentionally not implemented yet.
   * @param filePath - The path to the file.
   * @param content - The content to write.
   */
  async write_file(filePath: string, content: string): Promise<void> {
    logger.warn(`[SerenaAdapter] STUB: write_file called for '${filePath}', but it is disabled.`);
    throw new Error('Writing files is currently disabled in this phase.');
  }
}

export const serenaAdapter = new SerenaAdapter();