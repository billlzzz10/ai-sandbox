import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../telemetry/logger';
import { createPatch } from 'diff';
import { glob } from 'glob';

const ROOT_WORKSPACE_DIR = path.join(process.cwd(), '.work');

class WorkspaceManager {
  /**
   * Initializes the root workspace directory.
   */
  async init() {
    try {
      await fs.mkdir(ROOT_WORKSPACE_DIR, { recursive: true });
      logger.info('Root workspace directory initialized.', { path: ROOT_WORKSPACE_DIR });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create root workspace directory.', { error: message });
      throw error;
    }
  }

  /**
   * Creates a new, sandboxed workspace for a given task.
   * It simulates cloning by copying the entire project content into the sandbox.
   * @param taskId - The unique identifier for the task.
   * @returns The absolute path to the newly created workspace.
   */
  async create(taskId: string): Promise<string> {
    const taskWorkspacePath = path.join(ROOT_WORKSPACE_DIR, taskId);
    logger.info(`Creating new workspace for task`, { taskId, path: taskWorkspacePath });

    try {
      // Clean up any previous workspace for this task
      await this.destroy(taskId);

      // In production, this would be process.cwd(). For tests, we can override.
      const sourceDir = process.env.TEST_SOURCE_DIR || process.cwd();

      // Copy project files to the new workspace
      await fs.cp(sourceDir, taskWorkspacePath, {
        recursive: true,
        filter: (src) => {
          const base = path.basename(src);
          return !['.git', 'node_modules', '.work'].includes(base);
        },
      });

      logger.info(`Workspace for task ${taskId} created successfully.`);
      return taskWorkspacePath;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to create workspace for task ${taskId}.`, { error: message });
      throw new Error(`Failed to create workspace for ${taskId}: ${message}`);
    }
  }

  /**
   * Destroys the workspace for a given task.
   * @param taskId - The unique identifier for the task.
   */
  async destroy(taskId: string): Promise<void> {
    const taskWorkspacePath = path.join(ROOT_WORKSPACE_DIR, taskId);
    try {
      await fs.rm(taskWorkspacePath, { recursive: true, force: true });
      logger.info(`Workspace for task ${taskId} destroyed.`, { path: taskWorkspacePath });
    } catch (error) {
        // Ignore if directory doesn't exist
        if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
            const message = error.message || 'Unknown error';
            logger.error(`Failed to destroy workspace for task ${taskId}.`, { error: message });
            throw error;
        }
    }
  }

  /**
   * Gets the path to a task's workspace.
   * @param taskId - The unique identifier for the task.
   * @returns The absolute path to the task's workspace.
   */
  getPath(taskId: string): string {
    return path.join(ROOT_WORKSPACE_DIR, taskId);
  }

  /**
   * Generates a unified diff for all modified files in a task's workspace.
   * @param taskId - The unique identifier for the task.
   * @returns An array of diff objects, each containing the file path and the diff hunk.
   */
  async generateDiff(taskId: string): Promise<{ path: string; diff: string }[]> {
    const taskWorkspacePath = this.getPath(taskId);
    logger.info(`Generating diff for task ${taskId}`);

    const workspaceFiles = await glob('**/*', {
      cwd: taskWorkspacePath,
      nodir: true,
      ignore: ['node_modules/**', '.git/**'],
    });

    const diffs = [];

    const sourceDir = process.env.TEST_SOURCE_DIR || process.cwd();

    for (const file of workspaceFiles) {
      const originalPath = path.join(sourceDir, file);
      const modifiedPath = path.join(taskWorkspacePath, file);

      try {
        const originalContent = await fs.readFile(originalPath, 'utf8');
        const modifiedContent = await fs.readFile(modifiedPath, 'utf8');

        if (originalContent !== modifiedContent) {
          const patch = createPatch(file, originalContent, modifiedContent);
          diffs.push({ path: file, diff: patch });
          logger.info(`Detected changes in ${file} for task ${taskId}`);
        }
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          // This is a new file created in the workspace
          const modifiedContent = await fs.readFile(modifiedPath, 'utf8');
          const patch = createPatch(file, '', modifiedContent);
          diffs.push({ path: file, diff: patch });
          logger.info(`Detected new file ${file} for task ${taskId}`);
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }

    return diffs;
  }
}

export const workspaceManager = new WorkspaceManager();
// Initialize the root directory on startup
workspaceManager.init();