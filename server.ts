import express from 'express';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { authRouter } from './server/routes/authRoutes';
import { boardRouter } from './server/routes/boardRoutes';
import { invitationRouter } from './server/routes/invitationRoutes';
import { aiRouter } from './server/routes/aiRoutes';
import { notificationRouter } from './server/routes/notificationRoutes';
import { initSocketServer } from './server/socket';
import { requireAuth, verifyCsrf, AuthenticatedRequest } from './server/middleware';
import { db } from './server/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Ensure public/uploads exists
  const uploadsDir = path.resolve(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Initialize Socket.io
  const io = initSocketServer(server);

  // Security Headers via Helmet (relaxed in development for AI Studio preview, strict in production)
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https://api.dicebear.com", "https://images.unsplash.com"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      } : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
      frameguard: isProduction ? { action: 'sameorigin' } : false,
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    })
  );

  // Core Express Middlewares
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());
  app.use(verifyCsrf);

  // General API Rate Limiter
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
  });
  app.use('/api', generalLimiter);

  // Authenticated File Downloads: ensure only authorized board members or owners can view uploaded files
  app.get('/uploads/:filename', requireAuth, (req: AuthenticatedRequest, res: express.Response) => {
    const filename = req.params.filename;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({ success: false, error: 'Invalid file request.' });
      return;
    }

    const filePath = path.resolve(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'File not found.' });
      return;
    }

    const user = req.user!;
    const fullUrlPath = `/uploads/${filename}`;

    // Check if user is authorized member of any board with this image, own avatar, board wallpaper, or admin
    const hasAccess = Array.from(db.cards.values()).some((card) => {
      if (Array.isArray(card.image_paths) && card.image_paths.includes(fullUrlPath)) {
        const role = db.getBoardMembership(card.board_id, user.id);
        const board = db.boards.get(card.board_id);
        if (role) return true;
        if (board && board.created_by === user.id) return true;
        if (user.role === 'Admin/Group Owner' || user.role === 'Manager') {
          const creator = db.findUserById(board?.created_by || '');
          if (creator && creator.company.toLowerCase() === user.company.toLowerCase()) return true;
        }
      }
      return false;
    });

    const isOwnAvatar = Array.from(db.users.values()).some(
      (u) => u.id === user.id && u.avatar_url === fullUrlPath
    );

    const isBoardWallpaper = Array.from(db.boards.values()).some(
      (b) => b.background_value === fullUrlPath && (db.getBoardMembership(b.id, user.id) || b.created_by === user.id || user.role === 'Admin/Group Owner' || user.role === 'Manager')
    );

    if (!hasAccess && !isOwnAvatar && !isBoardWallpaper && user.role !== 'Admin/Group Owner') {
      res.status(403).json({ success: false, error: 'Access denied. You must be an authorized member of the board to view this file.' });
      return;
    }

    res.sendFile(filePath);
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'PrimeShift Backend', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/invitations', invitationRouter);
  app.use('/api/boards', boardRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/user', notificationRouter);
  app.use('/api/admin', notificationRouter);
  app.use('/api', boardRouter); // Exposes /api/cards/* and /api/users/*

  // Secure static file serving using NODE_ENV=production check
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Vite Dev Server middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[HospitaList Server] Running on http://0.0.0.0:${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      const altPort = PORT + 1;
      console.warn(`[HospitaList Server] Port ${PORT} in use, trying ${altPort}...`);
      server.listen(altPort, '0.0.0.0', () => {
        console.log(`[HospitaList Server] Running on http://0.0.0.0:${altPort}`);
      });
    } else {
      console.error('[HospitaList Server] Server listen error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('[HospitaList Server] Failed to start server:', err);
  process.exit(1);
});
