import { ExecutionQueue } from './executionQueue';

export const executionQueue = new ExecutionQueue(5);

export function resetSharedStateForTesting(): void {
  if (process.env.NODE_ENV === 'test') {
    executionQueue.reset();
  }
}
