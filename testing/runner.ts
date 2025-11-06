import { spawn } from 'child_process';
import { logger } from '../telemetry/logger';
import { TestResult } from '../orchestrator/interfaces';

export class TestRunner {
  /**
   * Executes a shell command in a specified directory and captures the output.
   * @param taskId - The ID of the task, for logging purposes.
   * @param command - The command to execute (e.g., 'npm').
   * @param args - The arguments for the command (e.g., ['test']).
   * @param cwd - The working directory to run the command in.
   * @returns A promise that resolves with the TestResult.
   */
  async run(taskId: string, command: string, args: string[], cwd: string): Promise<Omit<TestResult, 'taskId'>> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      logger.info(`Running command: ${command} ${args.join(' ')} in ${cwd}`, { taskId });

      const proc = spawn(command, args, {
        cwd,
        env: { ...process.env, CI: 'true' }, // Add CI flag for non-interactive mode
        shell: true, // Use shell for better compatibility
      });

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (exitCode) => {
        const durationMs = Date.now() - startTime;
        const result: Omit<TestResult, 'taskId'> = {
          command: `${command} ${args.join(' ')}`,
          exitCode: exitCode ?? -1,
          stdout,
          stderr,
          durationMs,
        };

        const logStatus = exitCode === 0 ? 'succeeded' : 'failed';
        logger.info(`Command ${logStatus}`, { taskId, exitCode, durationMs });
        resolve(result);
      });

      proc.on('error', (err) => {
        const durationMs = Date.now() - startTime;
        logger.error(`Failed to start command: ${command}`, { taskId, error: err.message });
        resolve({
          command: `${command} ${args.join(' ')}`,
          exitCode: 1,
          stdout: '',
          stderr: `Failed to start process: ${err.message}`,
          durationMs,
        });
      });
    });
  }
}

export const testRunner = new TestRunner();