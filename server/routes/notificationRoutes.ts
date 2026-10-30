import { Router, Response } from 'express';
import { db } from '../db';
import { requireAuth, AuthenticatedRequest } from '../middleware';

export const notificationRouter = Router();

/**
 * GET /api/notifications
 * Fetches notifications for current user
 */
notificationRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const list = Array.isArray(db.notifications) ? db.notifications : [];
  const userNotifications = list
    .filter((n) => n && n.user_id === userId)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  res.json({ success: true, notifications: userNotifications });
});

/**
 * PATCH /api/notifications/:id/read
 * Marks notification as read
 */
notificationRouter.patch('/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const notificationId = req.params.id;
  const userId = req.user!.id;
  const list = Array.isArray(db.notifications) ? db.notifications : [];

  const notif = list.find((n) => n && n.id === notificationId && n.user_id === userId);
  if (!notif) {
    res.status(404).json({ success: false, error: 'Notification not found.' });
    return;
  }

  notif.is_read = true;
  db.saveToDisk();

  res.json({ success: true, notification: notif });
});

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications as read for current user
 */
notificationRouter.patch('/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const list = Array.isArray(db.notifications) ? db.notifications : [];
  for (const n of list) {
    if (n && n.user_id === userId) {
      n.is_read = true;
    }
  }
  db.saveToDisk();
  res.json({ success: true, message: 'All notifications marked as read.' });
});

/**
 * GET /api/user/notification-preferences
 * Gets user notification preferences
 */
notificationRouter.get('/preferences', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db.findUserById(req.user!.id);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found.' });
    return;
  }

  const prefs = user.notification_preferences || db.getDefaultNotificationPreferences();
  res.json({ success: true, preferences: prefs });
});

/**
 * PATCH /api/user/notification-preferences
 * Updates user notification preferences (opt-in / opt-out switches)
 */
notificationRouter.patch('/preferences', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db.findUserById(req.user!.id);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found.' });
    return;
  }

  const currentPrefs = user.notification_preferences || db.getDefaultNotificationPreferences();
  const updatedPrefs = { ...currentPrefs, ...req.body };

  user.notification_preferences = updatedPrefs;
  user.updated_at = new Date().toISOString();
  db.users.set(user.id, user);
  db.saveToDisk();

  res.json({ success: true, preferences: updatedPrefs });
});

/**
 * GET /api/admin/email-logs
 * Retrieves simulated email logs for staging/testing review
 */
notificationRouter.get('/email-logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const logs = (Array.isArray(db.emailLogs) ? db.emailLogs : []).slice(-50).reverse();
  res.json({ success: true, emailLogs: logs });
});
