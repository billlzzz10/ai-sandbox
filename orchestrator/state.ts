import { Plan } from './interfaces';
import { logger } from '../telemetry/logger';

export type TaskStatus = 'PLANNING' | 'PLAN_APPROVED' | 'EXECUTING' | 'DONE' | 'ERROR';

export interface ReviewRecord {
  diff: string;
  valid: boolean;
  violations: string[];
  checkedAt: string;
}

export interface ExecutionRecord {
  command: string;
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  completedAt: string;
}

export interface Task {
  id: string;
  status: TaskStatus;
  plan?: Plan;
  feedback?: string;
  createdAt: string;
  updatedAt: string;
  reviewHistory: ReviewRecord[];
  executionHistory: ExecutionRecord[];
}

// In-memory store for tasks. In a real app, this would be a database.
const taskStore = new Map<string, Task>();

export const taskState = {
  createTask(taskId: string): Task {
    if (taskStore.has(taskId)) {
      throw new Error(`Task with ID '${taskId}' already exists.`);
    }
    const newTask: Task = {
      id: taskId,
      status: 'PLANNING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reviewHistory: [],
      executionHistory: [],
    };
    taskStore.set(taskId, newTask);
    logger.info(`Task created`, { taskId });
    return newTask;
  },

  getTask(taskId: string): Task | undefined {
    return taskStore.get(taskId);
  },

  updateTask(taskId: string, updates: Partial<Omit<Task, 'id'>>): Task {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task with ID '${taskId}' not found.`);
    }

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    taskStore.set(taskId, updatedTask);
    logger.info(`Task updated`, {
      taskId,
      status: updatedTask.status,
      hasPlan: !!updatedTask.plan,
    });

    return updatedTask;
  },

  recordReview(taskId: string, record: Omit<ReviewRecord, 'checkedAt'> & { checkedAt?: string }): Task {
    const existing = this.getTask(taskId);
    if (!existing) {
      throw new Error(`Task with ID '${taskId}' not found.`);
    }
    const nextRecord: ReviewRecord = {
      ...record,
      checkedAt: record.checkedAt ?? new Date().toISOString(),
    };
    const history = [...existing.reviewHistory, nextRecord];
    return this.updateTask(taskId, { reviewHistory: history });
  },

  recordExecution(taskId: string, record: Omit<ExecutionRecord, 'completedAt'> & { completedAt?: string }): Task {
    const existing = this.getTask(taskId);
    if (!existing) {
      throw new Error(`Task with ID '${taskId}' not found.`);
    }
    const nextRecord: ExecutionRecord = {
      ...record,
      completedAt: record.completedAt ?? new Date().toISOString(),
    };
    const history = [...existing.executionHistory, nextRecord];
    return this.updateTask(taskId, { executionHistory: history });
  },

  getLatestReview(taskId: string): ReviewRecord | undefined {
    const task = this.getTask(taskId);
    if (!task || task.reviewHistory.length === 0) {
      return undefined;
    }
    return task.reviewHistory[task.reviewHistory.length - 1];
  },

  reset(): void {
    taskStore.clear();
  },
};