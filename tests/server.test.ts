import request from 'supertest';

import { createServer } from '../server';
import { taskState } from '../orchestrator/state';
import { resetSharedStateForTesting } from '../orchestrator/shared';
import { TestRunnerError, runTestCommand } from '../testRunner';

jest.mock('../testRunner', () => {
  const actual = jest.requireActual('../testRunner');
  return {
    ...actual,
    runTestCommand: jest.fn(),
  };
});

describe('server orchestrator routes', () => {
  const app = createServer();
  const runTestCommandMock = runTestCommand as jest.MockedFunction<typeof runTestCommand>;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    taskState.reset();
    resetSharedStateForTesting();
    runTestCommandMock.mockReset();
  });

  it('rejects review submissions that violate rules', async () => {
    const task = taskState.createTask('task-1');
    expect(task).toBeDefined();

    const response = await request(app)
      .post('/tasks/task-1/review')
      .send({
        diffContent: 'diff --git a/file.ts b/file.ts\n+++ b/file.ts\n+// TODO: fix',
      });

    expect(response.status).toBe(400);
    expect(response.body.violations).toContain('Added lines must not contain TODO or FIXME markers.');
  });

  it('renders an HTML review for approved diffs', async () => {
    taskState.createTask('task-2');
    const diff = [
      'diff --git a/file.ts b/file.ts',
      '+++ b/file.ts',
      '+const value = 1;',
    ].join('\n');

    const reviewResponse = await request(app)
      .post('/tasks/task-2/review')
      .send({ diffContent: diff });

    expect(reviewResponse.status).toBe(200);

    const viewResponse = await request(app).get('/tasks/task-2/review');
    expect(viewResponse.status).toBe(200);
    expect(viewResponse.text).toContain('const value = 1;');
  });

  it('enforces a concurrency cap of five execution commands', async () => {
    const tasks = Array.from({ length: 6 }, (_, index) => `exec-task-${index}`);
    tasks.forEach(taskId => taskState.createTask(taskId));

    const resolvers: Array<() => void> = [];
    runTestCommandMock.mockImplementation(
      () =>
        new Promise(resolve => {
          resolvers.push(() =>
            resolve({
              command: 'npm test',
              stdout: '',
              stderr: '',
              exitCode: 0,
              durationMs: 5,
            }),
          );
        }),
    );

    const pending = tasks.slice(0, 5).map(taskId =>
      request(app).post(`/tasks/${taskId}/execute`).send({ command: 'npm test' }),
    );

    await new Promise(resolve => setTimeout(resolve, 20));

    const overflowResponse = await request(app)
      .post(`/tasks/${tasks[5]}/execute`)
      .send({ command: 'npm test' });

    expect(overflowResponse.status).toBe(429);

    resolvers.splice(0).forEach(resolve => resolve());
    await Promise.all(pending);
  });

  it('returns detailed errors from the test runner', async () => {
    taskState.createTask('task-3');
    runTestCommandMock.mockRejectedValue(
      new TestRunnerError('Command timed out.', 'TIMEOUT', {
        command: 'npm test',
        durationMs: 2500,
      }),
    );

    const response = await request(app)
      .post('/tasks/task-3/execute')
      .send({ command: 'npm test' });

    expect(response.status).toBe(504);
    expect(response.body.reason).toBe('TIMEOUT');
  });
});
