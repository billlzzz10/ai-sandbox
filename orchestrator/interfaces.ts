export interface ToolCall {
  toolName: string;
  args: any[];
}

export interface PlanStep {
  file: string;
  symbol?: string;
  action: 'insert' | 'replace' | 'create' | 'delete';
  testImpact?: string;
}

export interface Plan {
  taskId: string;
  goals: string[];
  steps: PlanStep[];
  risks: string[];
  evidence: string[]; // symbols/refs found by Serena
}

export interface Patch {
  taskId: string;
  diffs: Array<{ path: string; hunks: string }>;
}

export interface TestResult {
  taskId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface PolicyViolation {
  id: string;
  path?: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  rule: string;
}

export interface MemoryItem {
  id: string;
  project: string;
  scope: string; // path|module|symbol
  statement: string;
  tags: string[];
  evidence: string[];
  firstSeen: string;
  lastConfirmed: string;
}

export interface LogEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: Record<string, any>;
}