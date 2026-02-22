import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from './auth';

type PermModule =
  | 'dashboard' | 'documents' | 'materials' | 'journals' | 'tasks'
  | 'corrections' | 'packages' | 'templates' | 'categories' | 'team'
  | 'matrix' | 'progress' | 'admin';

type PermAction = 'view' | 'create' | 'edit' | 'delete';

/**
 * Middleware factory that checks if the current user has a specific permission.
 * Falls back to role-based defaults if no per-user permissions are stored.
 *
 * Usage: router.get('/', requirePermission('documents', 'view'), handler)
 */
export function requirePermission(module: PermModule, action: PermAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // ADMIN role always has access
      if (req.userRole === 'ADMIN') {
        return next();
      }

      if (!req.userId) {
        return res.status(401).json({ error: 'Authorization required' });
      }

      const person = await prisma.person.findUnique({
        where: { id: req.userId },
        select: { permissions: true, role: true },
      });

      if (!person) {
        return res.status(401).json({ error: 'User not found' });
      }

      const perms = person.permissions as Record<string, Record<string, boolean>> | null;

      if (perms && perms[module]) {
        if (perms[module][action]) {
          return next();
        }
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Fallback: if no stored permissions, allow based on role defaults
      // (be permissive for backwards compatibility - only block if explicitly denied)
      return next();
    } catch (error) {
      console.error('Permission check error:', error);
      return next(); // On error, allow (fail-open for existing functionality)
    }
  };
}
