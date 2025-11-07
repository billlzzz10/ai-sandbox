import path from 'node:path';

import { runTestCommand } from '../testRunner';

describe('runTestCommand', () => {
  const fixturesDir = path.join(__dirname, '__fixtures__');

  it('executes a safe command successfully', async () => {
    const script = path.join(fixturesDir, 'fastTask.js');
    const result = await runTestCommand(`node ${script}`);
    expect(result.stdout.trim()).toBe('fast-task-output');
    expect(result.exitCode).toBe(0);
  });

  it('enforces timeouts for long running commands', async () => {
    const script = path.join(fixturesDir, 'longTask.js');
    await expect(runTestCommand(`node ${script}`, { timeoutMs: 200 })).rejects.toMatchObject({
      reason: 'TIMEOUT',
    });
  });

  it('rejects commands with unsafe characters', async () => {
    await expect(runTestCommand('echo hello && rm -rf /')).rejects.toMatchObject({
      reason: 'VALIDATION',
    });
  });
});
