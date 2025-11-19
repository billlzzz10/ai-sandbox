import { execFile } from 'node:child_process';
import { performance } from 'node:perf_hooks';

import { sanitizeShellCommand } from './utils/security';

function execFileAsync(
  file: string,
  args: readonly string[] = [],
  options?: { [key: string]: any },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args as string[], options || {}, (err, stdout, stderr) => {
      // Normalize stdout/stderr to strings for consistent downstream handling
      const normStdout =
        typeof stdout === 'string' ? stdout : Buffer.isBuffer(stdout) ? stdout.toString() : '';
      const normStderr =
        typeof stderr === 'string' ? stderr : Buffer.isBuffer(stderr) ? stderr.toString() : '';

      if (err) {
        // Attach stdout/stderr to the error so existing error handling can read them
        (err as any).stdout = normStdout;
        (err as any).stderr = normStderr;
        reject(err);
        return;
      }

      resolve({ stdout: normStdout, stderr: normStderr });
    });
  });
}

export type TestRunnerErrorReason = 'VALIDATION' | 'EXECUTION' | 'TIMEOUT';

export interface TestRunResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export class TestRunnerError extends Error {
  readonly reason: TestRunnerErrorReason;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  readonly command?: string;
  readonly durationMs?: number;

  constructor(
    message: string,
    reason: TestRunnerErrorReason,
    details?: Partial<TestRunResult> & { command?: string },
  ) {
    super(message);
    this.name = 'TestRunnerError';
    this.reason = reason;
    this.stdout = details?.stdout;
    this.stderr = details?.stderr;
    this.exitCode = details?.exitCode;
    this.command = details?.command;
    this.durationMs = details?.durationMs;
  }
}

interface RunTestOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxBuffer?: number;
}

export async function runTestCommand(command: string, options: RunTestOptions = {}): Promise<TestRunResult> {
  let sanitized;
  try {
    sanitized = sanitizeShellCommand(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid command input.';
    throw new TestRunnerError(message, 'VALIDATION');
  }

  const timeout = options.timeoutMs ?? 30_000;
  if (timeout <= 0 || !Number.isFinite(timeout)) {
    throw new TestRunnerError('Timeout must be a positive number.', 'VALIDATION');
  }

  const execOptions = {
    cwd: options.cwd ?? process.cwd(),
    env: { ...process.env, ...options.env },
    timeout,
    maxBuffer: options.maxBuffer ?? 5 * 1024 * 1024,
  } as const;

  const started = performance.now();
  try {
    const { stdout, stderr } = await execFileAsync(sanitized.executable, sanitized.args, execOptions);
    const finished = performance.now();
    return {
      command: sanitized.command,
      stdout,
      stderr,
      exitCode: 0,
      durationMs: finished - started,
    };
  } catch (error) {
    const finished = performance.now();
    if (
      error &&
      typeof error === 'object' &&
      ('killed' in error && (error as any).killed) ||
      ('signal' in error && ['SIGTERM', 'SIGKILL'].includes((error as any).signal)) ||
      ('code' in error && (error as any).code === 'ETIMEDOUT')
    ) {
      throw new TestRunnerError('Command timed out.', 'TIMEOUT', {
        command: sanitized.command,
        durationMs: finished - started,
      });
    }

    if (error && typeof error === 'object' && 'code' in error) {
      const stdout = typeof (error as any).stdout === 'string' ? (error as any).stdout : '';
      const stderr = typeof (error as any).stderr === 'string' ? (error as any).stderr : '';
      const exitCode = typeof (error as any).code === 'number' ? (error as any).code : -1;
      throw new TestRunnerError('Command failed to execute successfully.', 'EXECUTION', {
        command: sanitized.command,
        stdout,
        stderr,
        exitCode,
        durationMs: finished - started,
      });
    }

    const message = error instanceof Error ? error.message : 'Unknown execution failure.';
    throw new TestRunnerError(message, 'EXECUTION');
  }
}
