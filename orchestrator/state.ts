import { Plan } from './interfaces';
import { logger } from '../telemetry/logger';

import { TestResult } from './interfaces';

export type TaskStatus =
  | 'PLANNING'
  | 'PLAN_APPROVED'
  | 'EXECUTING'
  | 'TESTING'
  | 'REVIEW'
  | 'DONE'
  | 'ERROR';

export interface Task {
  id: string;
  status: TaskStatus;
  plan?: Plan;
  feedback?: string;
  testResult?: TestResult;
  createdAt: string;
  updatedAt: string;
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
};