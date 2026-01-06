import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { registerVisualRoutes } from './visual/routes/visualRoutes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // API
  const visualRouter = express.Router();
  registerVisualRoutes(visualRouter);
  app.use('/api/v1/visual', visualRouter);

  // Artifacts (dev + MVP)
  const storageRoot = path.resolve(process.cwd(), 'storage');
  app.use('/storage', express.static(storageRoot));

  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

  return app;
}
