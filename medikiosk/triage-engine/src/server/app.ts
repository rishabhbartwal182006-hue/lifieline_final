import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import patientEventRouter from './routes/patientEvent.js';
import { ALL_RULES } from '../rules/index.js';
import { seedDashboard } from '../demo/seedDashboard.js';
import { fileURLToPath } from 'url';
import path from 'path';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ONLINE',
      system: 'MediKiosk Real-Time Red-Flag & Triage Engine',
      version: '1.0.0',
      activeRulesCount: ALL_RULES.length,
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/events', patientEventRouter);

  const dashboardDir = fileURLToPath(new URL('../../dashboard', import.meta.url));
  app.use('/dashboard', (req, res, next) => {
    if (req.path === '/' || req.path === '') return res.sendFile(path.join(dashboardDir, 'index.html'));
    next();
  });
  app.use('/dashboard', express.static(dashboardDir));
  app.get('/', (_req: Request, res: Response) => res.redirect('/dashboard/'));

  app.post('/api/events/demo/seed', async (_req: Request, res: Response) => {
    await seedDashboard();
    res.status(200).json({ success: true, message: 'Dashboard demo encounters seeded.' });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  });

  return app;
}
