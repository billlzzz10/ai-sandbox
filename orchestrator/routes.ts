import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';

import { serenaAdapter } from '../serena-adapter';
import { memoryStore } from '../memory/store';
import { logger } from '../telemetry/logger';
import { TestRunnerError, runTestCommand } from '../testRunner';
import { validateRules } from '../validate';
import { truncateForStorage } from '../utils/security';
import { executionQueue } from './shared';
import { Plan } from './interfaces';
import { taskState } from './state';

const router = Router();

// POST /tasks/plan
router.post('/plan', async (req: Request, res: Response) => {
  const { requirement, context } = req.body;

  if (!requirement || typeof requirement !== 'string') {
    return res.status(400).json({ error: 'A non-empty requirement string is required.' });
  }

  const taskId = randomBytes(8).toString('hex');
  taskState.createTask(taskId);

  try {
    // 1. Use Serena to explore code (mocked)
    const symbols = await serenaAdapter.search_for_pattern(context || 'controller');
    const evidence = symbols.map(s => `${s.filePath}:${s.line}`);

    // 2. Generate a mock plan
    const plan: Plan = {
      taskId,
      goals: [requirement],
      steps: [
        {
          file: 'mock/path/to/file.ts',
          symbol: 'someFunction',
          action: 'replace',
          testImpact: 'Requires new unit tests for the updated logic.',
        },
        {
          file: 'mock/path/to/anotherFile.ts',
          action: 'create',
          testImpact: 'Requires a new test file.',
        },
      ],
      risks: ['The change might affect downstream dependencies.'],
      evidence,
    };

    // 3. Save the plan to the task state
    taskState.updateTask(taskId, { plan });

    logger.info('Plan generated successfully', { taskId });
    res.status(201).json({ taskId, plan });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during planning.';
    logger.error('Failed to generate plan', { taskId, error: errorMessage });
    taskState.updateTask(taskId, { status: 'ERROR' });
    res.status(500).json({ error: 'Failed to generate plan.' });
  }
});

// POST /tasks/approve_plan
router.post('/approve_plan', async (req: Request, res: Response) => {
  const { taskId, feedback } = req.body;

  if (!taskId || typeof taskId !== 'string') {
    return res.status(400).json({ error: 'A valid taskId is required.' });
  }

  try {
    const task = taskState.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: `Task with ID '${taskId}' not found.` });
    }

    if (task.status !== 'PLANNING') {
      return res
        .status(409)
        .json({ error: `Task is not in a plannable state. Current state: ${task.status}` });
    }

    // Update task state to approved
    const updatedTask = taskState.updateTask(taskId, { status: 'PLAN_APPROVED', feedback });

    // Extract and save key points to memory
    if (updatedTask.plan) {
      const keyPoints = memoryStore.extract_plan_keypoints(updatedTask.plan);
      await memoryStore.upsert(keyPoints);
      logger.info('Extracted and saved key points from plan', { taskId });
    }

    logger.info('Plan approved', { taskId, hasFeedback: !!feedback });
    res.status(200).json({ taskId, status: 'PLAN_APPROVED', message: 'Plan approved successfully.' });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    logger.error('Failed to approve plan', { taskId, error: errorMessage });
    res.status(500).json({ error: 'Failed to approve plan.' });
  }
});

// POST /tasks/:taskId/review
router.post('/:taskId/review', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { diffContent } = req.body ?? {};

  if (!diffContent || typeof diffContent !== 'string' || !diffContent.trim()) {
    return res.status(400).json({ error: 'A non-empty diffContent string is required.' });
  }

  try {
    const task = taskState.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: `Task with ID '${taskId}' not found.` });
    }

    const validation = validateRules(diffContent);
    taskState.recordReview(taskId, {
      diff: truncateForStorage(diffContent),
      valid: validation.valid,
      violations: validation.violations,
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Rules violation',
        violations: validation.violations,
      });
    }

    return res.status(200).json({
      taskId,
      status: 'REVIEW_APPROVED',
      message: 'Diff validated successfully.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    logger.error('Failed to record review', { taskId, error: message });
    return res.status(500).json({ error: 'Failed to process review.' });
  }
});

// POST /tasks/:taskId/execute
router.post('/:taskId/execute', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { command } = req.body ?? {};

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'A non-empty command string is required.' });
  }

  const task = taskState.getTask(taskId);
  if (!task) {
    return res.status(404).json({ error: `Task with ID '${taskId}' not found.` });
  }

  if (executionQueue.isSaturated()) {
    return res
      .status(429)
      .json({ error: 'Test execution concurrency limit reached. Please retry shortly.' });
  }

  try {
    const result = await executionQueue.run(() => runTestCommand(command));
    taskState.recordExecution(taskId, {
      command: result.command,
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    });
    return res.status(200).json({ taskId, result });
  } catch (error) {
    if (error instanceof TestRunnerError) {
      const status = error.reason === 'VALIDATION' ? 400 : error.reason === 'TIMEOUT' ? 504 : 502;
      taskState.recordExecution(taskId, {
        command: error.command ?? command,
        success: false,
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? error.message,
        exitCode: typeof error.exitCode === 'number' ? error.exitCode : -1,
        durationMs: error.durationMs ?? 0,
      });
      return res.status(status).json({
        error: error.message,
        reason: error.reason,
      });
    }

    const message = error instanceof Error ? error.message : 'Unknown execution failure.';
    logger.error('Failed to execute task command', { taskId, error: message });
    taskState.recordExecution(taskId, {
      command,
      success: false,
      stdout: '',
      stderr: message,
      exitCode: -1,
      durationMs: 0,
    });
    return res.status(500).json({ error: 'Failed to execute command.' });
  }
});

export const orchestratorRoutes = router;