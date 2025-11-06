import { Router, Request, Response } from 'express';
import { serenaAdapter } from '../serena-adapter';
import { taskState } from './state';
import { Plan } from './interfaces';
import { logger } from '../telemetry/logger';
import { memoryStore } from '../memory/store';
import { randomBytes } from 'crypto';
import { workspaceManager } from '../workspace/manager';
import { testRunner } from '../testing/runner';

const router = Router();

// POST /tasks/plan
router.post('/plan', async (req: Request, res: Response) => {
  const { requirement, context, taskId: existingTaskId } = req.body;
  let taskId = existingTaskId;
  let task;

  if (!requirement || typeof requirement !== 'string') {
    return res.status(400).json({ error: 'A non-empty requirement string is required.' });
  }

  let finalRequirement = requirement;

  if (taskId) {
    task = taskState.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: `Task with ID '${taskId}' not found.` });
    }
    if (task.feedback) {
      finalRequirement = `Previous feedback: "${task.feedback}". Original requirement: "${requirement}"`;
      logger.info('Incorporating feedback into new plan', { taskId });
    }
  } else {
    taskId = randomBytes(8).toString('hex');
    taskState.createTask(taskId);
  }

  try {
    // 1. Use Serena to explore code (mocked)
    const symbols = await serenaAdapter.search_for_pattern(context || 'controller');
    const evidence = symbols.map(s => `${s.filePath}:${s.line}`);

    // 2. Generate a mock plan
    const plan: Plan = {
      taskId,
      goals: [finalRequirement],
      steps: [
        {
          file: 'file1.txt',
          action: 'replace',
          testImpact: 'Should replace the content of file1.txt.',
        },
        {
          file: 'file2.txt',
          action: 'create',
          testImpact: 'Should create a new file named file2.txt.',
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
        return res.status(409).json({ error: `Task is not in a plannable state. Current state: ${task.status}`})
    }

    // Create the workspace for the task
    await workspaceManager.create(taskId);

    // Update task state to approved
    const updatedTask = taskState.updateTask(taskId, { status: 'PLAN_APPROVED', feedback });

    // Extract and save key points to memory
    if (updatedTask.plan) {
      const keyPoints = memoryStore.extract_plan_keypoints(updatedTask.plan);
      await memoryStore.upsert(keyPoints);
      logger.info('Extracted and saved key points from plan', { taskId });
    }

    logger.info('Plan approved', { taskId, hasFeedback: !!feedback });
    res.status(200).json({ taskId, status: 'PLAN_APPROVED', message: 'Plan approved and workspace created.' });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    logger.error('Failed to approve plan', { taskId, error: errorMessage });
    res.status(500).json({ error: 'Failed to approve plan.' });
  }
});

// POST /tasks/:taskId/execute
router.post('/:taskId/execute', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const task = taskState.getTask(taskId);

    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status !== 'PLAN_APPROVED') return res.status(409).json({ error: `Task cannot be executed. Status: ${task.status}`});
    if (!task.plan) return res.status(400).json({ error: 'Task has no plan to execute.'});

    try {
        taskState.updateTask(taskId, { status: 'EXECUTING' });

        for (const step of task.plan.steps) {
            switch (step.action) {
                case 'replace':
                    const replacementContent = `// Content replaced by task ${taskId}\n`;
                    await serenaAdapter.replace_code_block(taskId, step.file, replacementContent);
                    break;
                case 'create':
                    const newFileContent = `// New file created by task ${taskId}\n`;
                    await serenaAdapter.create_file(taskId, step.file, newFileContent);
                    break;
                // 'insert' and 'delete' can be implemented in future phases
                default:
                    logger.warn(`Unsupported plan step action: ${step.action}`, { taskId });
            }
        }

        taskState.updateTask(taskId, { status: 'TESTING' });
        res.status(200).json({ message: 'Execution complete. Ready for testing.' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        taskState.updateTask(taskId, { status: 'ERROR' });
        logger.error('Execution failed', { taskId, error: message });
        res.status(500).json({ error: 'Execution failed.' });
    }
});

// POST /tasks/:taskId/test
router.post('/:taskId/test', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const { command, args } = req.body;
    const task = taskState.getTask(taskId);

    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status !== 'TESTING') return res.status(409).json({ error: `Task cannot be tested. Status: ${task.status}`});
    if (!command) return res.status(400).json({ error: 'A command is required.'});

    try {
        const workspacePath = workspaceManager.getPath(taskId);
        const testResult = await testRunner.run(taskId, command, args || [], workspacePath);

        taskState.updateTask(taskId, { status: 'REVIEW', testResult: { ...testResult, taskId } });

        res.status(200).json({ message: 'Testing complete. Ready for review.', testResult });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        taskState.updateTask(taskId, { status: 'ERROR' });
        logger.error('Testing failed', { taskId, error: message });
        res.status(500).json({ error: 'Testing failed.' });
    }
});

// POST /tasks/:taskId/review
router.post('/:taskId/review', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const task = taskState.getTask(taskId);

    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status !== 'REVIEW') return res.status(409).json({ error: `Task is not ready for review. Status: ${task.status}`});

    try {
        const diffs = await workspaceManager.generateDiff(taskId);
        const reviewData = {
            diffs,
            testResult: task.testResult,
            summary: `Review for task ${taskId}. Found ${diffs.length} modified file(s).`
        };
        res.status(200).json(reviewData);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Review generation failed', { taskId, error: message });
        res.status(500).json({ error: 'Failed to generate review data.' });
    }
});

// POST /tasks/:taskId/approve_patch
router.post('/:taskId/approve_patch', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const task = taskState.getTask(taskId);

    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status !== 'REVIEW') return res.status(409).json({ error: `Cannot approve patch. Status: ${task.status}`});

    try {
        taskState.updateTask(taskId, { status: 'DONE' });
        // In a real scenario, this would trigger merging the code from the workspace.
        // For now, we just clean up the workspace.
        await workspaceManager.destroy(taskId);
        res.status(200).json({ message: 'Patch approved. Task marked as DONE.' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Patch approval failed', { taskId, error: message });
        res.status(500).json({ error: 'Failed to approve patch.' });
    }
});

// POST /tasks/:taskId/feedback
router.post('/:taskId/feedback', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const { feedback } = req.body;

    if (!feedback) return res.status(400).json({ error: 'Feedback content is required.' });

    try {
        taskState.updateTask(taskId, { feedback, status: 'PLANNING' }); // Revert to planning

        // Save feedback to memory
        await memoryStore.upsert({
            project: 'ai-sandbox',
            scope: `task:${taskId}`,
            statement: `Feedback received: ${feedback}`,
            tags: ['feedback', 'human-in-the-loop'],
            evidence: [],
        });

        res.status(200).json({ message: 'Feedback received. Task has been reset to PLANNING state for revision.' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to process feedback', { taskId, error: message });
        res.status(500).json({ error: 'Failed to process feedback.' });
    }
});


export const orchestratorRoutes = router;