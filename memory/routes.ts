import { Router, Request, Response } from 'express';
import { memoryStore } from './store';
import { logger } from '../telemetry/logger';

const router = Router();

// POST /memory/upsert
router.post('/upsert', async (req: Request, res: Response) => {
  const { item } = req.body;

  if (!item || typeof item !== 'object' || !item.id) {
    return res.status(400).json({ error: 'A valid MemoryItem object with an id is required.' });
  }

  try {
    await memoryStore.upsert(item);
    logger.info('Memory item upserted', { id: item.id });
    res.status(201).json({ message: 'Memory item saved.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    logger.error('Failed to upsert memory item', { error: message });
    res.status(500).json({ error: 'Failed to save memory item.' });
  }
});

// GET /memory/query
router.get('/query', async (req: Request, res: Response) => {
  const { q, tags } = req.query;

  if (!q && !tags) {
    return res.status(400).json({ error: 'A query parameter "q" or "tags" is required.' });
  }

  try {
    const results = await memoryStore.query({
      keyword: typeof q === 'string' ? q : undefined,
      tags: typeof tags === 'string' ? tags.split(',') : undefined,
    });
    logger.info('Memory query performed', { query: { q, tags }, resultCount: results.length });
    res.status(200).json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    logger.error('Failed to query memory', { error: message });
    res.status(500).json({ error: 'Failed to query memory.' });
  }
});

export const memoryRoutes = router;