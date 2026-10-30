import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken, AUTH_COOKIE_NAME, toSafeUser } from './auth';
import { db } from './db';
import { User, SafeUser } from './types';

export interface AuthenticatedSocket extends Socket {
  user?: SafeUser;
}

let io: SocketIOServer | null = null;

function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = decodeURIComponent(parts.slice(1).join('=').trim());
      list[key] = val;
    }
  });
  return list;
}

// Track active users per board room
const activeBoardUsers = new Map<string, Set<string>>(); // boardId -> Set of userIds

/**
 * Initialize Socket.io with HTTP server
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication Handshake Middleware
  io.use((socket: AuthenticatedSocket, next) => {
    let token: string | undefined = undefined;

    // 1. Try reading from cookie header
    const cookieHeader = socket.handshake.headers.cookie;
    if (cookieHeader) {
      const parsedCookies = parseCookies(cookieHeader);
      token = parsedCookies[AUTH_COOKIE_NAME];
    }

    // 2. Fallback to auth payload in socket handshake
    if (!token && socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    }

    if (!token) {
      // Allow connection but mark as unauthenticated if needed, or reject
      return next(new Error('Authentication required for real-time connection.'));
    }

    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid or expired authentication token.'));
    }

    const user = db.findUserById(payload.userId);
    if (!user || !user.is_active) {
      return next(new Error('User account not found or inactive.'));
    }

    const { password_hash, google_access_token, google_refresh_token, ...safeUser } = user;
    socket.user = safeUser;
    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    console.log(`[Socket.io] User connected: ${user?.name} (${user?.id}) on socket ${socket.id}`);

    // Join Board Room
    socket.on('join:board', ({ boardId }: { boardId: string }) => {
      if (!boardId || !user) return;

      // Verify user has permission to join this board
      const role = db.getBoardMembership(boardId, user.id);
      if (!role) {
        socket.emit('error:permission', { message: 'Access denied for this board.' });
        return;
      }

      const roomName = `board:${boardId}`;
      socket.join(roomName);

      // Add to presence list
      if (!activeBoardUsers.has(boardId)) {
        activeBoardUsers.set(boardId, new Set());
      }
      activeBoardUsers.get(boardId)!.add(user.id);

      console.log(`[Socket.io] ${user.name} joined room ${roomName}`);

      // Broadcast updated presence to room
      const activeIds = Array.from(activeBoardUsers.get(boardId) || []);
      const activeMembers = activeIds
        .map((id) => db.findUserById(id))
        .filter((u): u is User => Boolean(u))
        .map((u) => toSafeUser(u));
      io?.to(roomName).emit('board:presence', {
        boardId,
        activeUserIds: activeIds,
        activeMembers,
      });
    });

    // Leave Board Room
    socket.on('leave:board', ({ boardId }: { boardId: string }) => {
      if (!boardId || !user) return;
      const roomName = `board:${boardId}`;
      socket.leave(roomName);

      if (activeBoardUsers.has(boardId)) {
        activeBoardUsers.get(boardId)!.delete(user.id);
        const activeIds = Array.from(activeBoardUsers.get(boardId) || []);
        const activeMembers = activeIds
          .map((id) => db.findUserById(id))
          .filter((u): u is User => Boolean(u))
          .map((u) => toSafeUser(u));
        io?.to(roomName).emit('board:presence', {
          boardId,
          activeUserIds: activeIds,
          activeMembers,
        });
      }
      console.log(`[Socket.io] ${user.name} left room ${roomName}`);
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket.io] User disconnected: ${user?.name}`);
      if (user) {
        for (const [boardId, userSet] of activeBoardUsers.entries()) {
          if (userSet.has(user.id)) {
            userSet.delete(user.id);
            const roomName = `board:${boardId}`;
            const activeIds = Array.from(userSet);
            const activeMembers = activeIds
              .map((id) => db.findUserById(id))
              .filter((u): u is User => Boolean(u))
              .map((u) => toSafeUser(u));
            io?.to(roomName).emit('board:presence', {
              boardId,
              activeUserIds: activeIds,
              activeMembers,
            });
          }
        }
      }
    });
  });

  return io;
}

/**
 * Socket.io Event Broadcast Helpers
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function broadcastToBoard(boardId: string, event: string, data: any, excludeSocketId?: string): void {
  if (!io) return;
  const room = `board:${boardId}`;
  if (excludeSocketId) {
    io.to(room).except(excludeSocketId).emit(event, data);
  } else {
    io.to(room).emit(event, data);
  }
}

export function broadcastCardMoved(boardId: string, payload: any, excludeSocketId?: string): void {
  broadcastToBoard(boardId, 'card:moved', payload, excludeSocketId);
}

export function broadcastCardCreated(boardId: string, card: any, excludeSocketId?: string): void {
  broadcastToBoard(boardId, 'card:created', { card }, excludeSocketId);
}

export function broadcastCardUpdated(boardId: string, card: any): void {
  broadcastToBoard(boardId, 'card:updated', { card });
}

export function broadcastCardDeleted(boardId: string, cardId: string): void {
  broadcastToBoard(boardId, 'card:deleted', { cardId });
}

export function broadcastActivityLogged(boardId: string, log: any): void {
  broadcastToBoard(boardId, 'board:activity', { log });
}

export function broadcastChecklistItemUpdated(boardId: string, item: any): void {
  broadcastToBoard(boardId, 'checklist:updated', { item });
}
