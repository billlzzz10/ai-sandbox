import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime();
  const { method, url, ip, headers } = req;

  logger.info('Request received', {
    request: {
      method,
      url,
      ip,
      headers: {
        'user-agent': headers['user-agent'],
        'referer': headers['referer'],
      },
    },
  });

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e9 + diff[1]) / 1e6;
    const { statusCode, statusMessage } = res;

    const level = statusCode >= 400 ? 'error' : 'info';

    logger[level]('Request finished', {
      request: {
        method,
        url,
      },
      response: {
        statusCode,
        statusMessage,
      },
      durationMs: parseFloat(durationMs.toFixed(2)),
    });
  });

  next();
}