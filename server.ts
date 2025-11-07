import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import 'source-map-support/register';
import path from 'node:path';

import { loggingMiddleware } from './telemetry/middleware';
import { logger } from './telemetry/logger';
import { orchestratorRoutes } from './orchestrator/routes';
import { memoryRoutes } from './memory/routes';
import { taskState } from './orchestrator/state';

// Import legacy functions
const { loadAgent, improvePromptStub } = require('./legacy_agent_logic');

function createServer(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'ejs');

  // Middlewares
  app.use(helmet());
  app.use(express.json({ limit: '1mb', strict: true }));
  app.use(loggingMiddleware);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // --- New Routes ---
  app.use('/tasks', orchestratorRoutes);
  app.use('/memory', memoryRoutes);

  app.get('/tasks/:taskId/review', (req: Request, res: Response) => {
    const taskId = req.params.taskId;
    const review = taskState.getLatestReview(taskId);
    if (!review) {
      return res.status(404).render('review', {
        taskId,
        error: 'No review available for this task yet.',
        diffLines: [],
        violations: [],
      });
    }

    const diffLines = review.diff.split('\n').map(line => ({
      type: line.startsWith('+') ? 'addition' : line.startsWith('-') ? 'removal' : 'context',
      content: line,
    }));

    return res.render('review', {
      taskId,
      diffLines,
      error: undefined,
      violations: review.violations,
    });
  });

  // --- Existing Agent Routes (Legacy) ---
  const agentRouter = express.Router();
  agentRouter.post('/preview', (req: Request, res: Response) => {
    const { rolePath, prompt } = req.body || {};
    if (typeof rolePath !== 'string' || rolePath.trim() === '') {
      return res.status(400).json({ error: 'rolePath must be a non-empty string.' });
    }
    try {
      const { originalPrompt, refinedPrompt } = improvePromptStub(prompt ?? '');
      const agent = loadAgent(rolePath.trim());
      res.json({
        agent: {
          name: agent.name,
          description: agent.description,
          persona: agent.persona,
          rulesCount: agent.rules.length,
          tools: agent.listTools(),
        },
        prompts: {
          original: originalPrompt,
          refined: refinedPrompt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error('Failed to preview agent', { error: message });
      res.status(400).json({ error: message });
    }
  });

  agentRouter.post('/tools/execute', (req: Request, res: Response) => {
    const { rolePath, toolName, args } = req.body || {};
    if (typeof rolePath !== 'string' || !rolePath.trim()) {
      return res.status(400).json({ error: 'rolePath must be a non-empty string.' });
    }
    if (typeof toolName !== 'string' || !toolName.trim()) {
      return res.status(400).json({ error: 'toolName must be a non-empty string.' });
    }
    try {
      const agent = loadAgent(rolePath.trim());
      const execution = agent.runTool(toolName.trim(), args);
      if (!execution.success) {
        return res.status(400).json({ error: execution.error });
      }
      res.json({ result: execution.result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      logger.error('Failed to execute tool', { error: message });
      res.status(400).json({ error: message });
    }
  });
  app.use('/agents', agentRouter);


  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Global Error Handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unexpected server error', { path: req.path, error: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const app = createServer();
  app.listen(port, () => {
    logger.info(`🚀 Express server listening on port ${port}`);
  });
}

export { createServer };