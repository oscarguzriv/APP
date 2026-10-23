import express from 'express';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authRouter } from './server/routes/authRoutes.ts';
import { boardRouter } from './server/routes/boardRoutes.ts';
import { invitationRouter } from './server/routes/invitationRoutes.ts';
import { initSocketServer } from './server/socket.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Ensure public/uploads exists
  const uploadsDir = path.resolve(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Initialize Socket.io
  const io = initSocketServer(server);

  // Core Express Middlewares
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Serve uploaded images statically
  app.use('/uploads', express.static(uploadsDir));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'PrimeShift Backend', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/invitations', invitationRouter);
  app.use('/api/boards', boardRouter);
  app.use('/api', boardRouter); // Exposes /api/cards/* and /api/users/*

  // Vite Dev Server middleware or Static build
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[HospitaList Server] Running on http://localhost:${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error('[HospitaList Server] Failed to start server:', err);
  process.exit(1);
});
