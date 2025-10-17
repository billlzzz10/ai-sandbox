import { promises as fs } from 'fs';
import path from 'path';
import { MemoryItem, Plan } from '../orchestrator/interfaces';
import { logger } from '../telemetry/logger';
import { randomBytes } from 'crypto';

const memoryFilePath = path.join(process.cwd(), 'memory', 'store.jsonl');

async function ensureMemoryFile(): Promise<void> {
  try {
    await fs.access(memoryFilePath);
  } catch {
    await fs.writeFile(memoryFilePath, '', 'utf8');
    logger.info('Created memory store file at', { path: memoryFilePath });
  }
}

async function upsert(item: Omit<MemoryItem, 'id' | 'firstSeen' | 'lastConfirmed'> & { id?: string }): Promise<MemoryItem> {
  await ensureMemoryFile();

  const fullItem: MemoryItem = {
    id: item.id || randomBytes(8).toString('hex'),
    firstSeen: new Date().toISOString(),
    lastConfirmed: new Date().toISOString(),
    ...item,
  };

  const line = JSON.stringify(fullItem) + '\\n';
  await fs.appendFile(memoryFilePath, line, 'utf8');
  return fullItem;
}

async function query({ keyword, tags }: { keyword?: string; tags?: string[] }): Promise<MemoryItem[]> {
  await ensureMemoryFile();
  const lines = (await fs.readFile(memoryFilePath, 'utf8')).split('\\n').filter(Boolean);
  const items: MemoryItem[] = lines.map(line => JSON.parse(line));

  let results = items;

  if (keyword) {
    const lowerKeyword = keyword.toLowerCase();
    results = results.filter(item => item.statement.toLowerCase().includes(lowerKeyword));
  }

  if (tags && tags.length > 0) {
    results = results.filter(item => tags.every(tag => item.tags.includes(tag)));
  }

  return results;
}

function extract_plan_keypoints(plan: Plan): Omit<MemoryItem, 'id' | 'firstSeen' | 'lastConfirmed'> {
    const scope = [...new Set(plan.steps.map(s => s.file.split('/')[0]))].join(', ');
    const statement = `Objective: ${plan.goals.join(', ')}. Touches modules: ${scope}.`;

    return {
        project: 'ai-sandbox', // Or dynamically determined
        scope: scope,
        statement: statement,
        tags: ['plan', 'generated', ...plan.steps.map(s => s.action)],
        evidence: plan.evidence,
    };
}


export const memoryStore = {
  upsert,
  query,
  extract_plan_keypoints,
};