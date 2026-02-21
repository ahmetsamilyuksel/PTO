import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../index';

export function auditMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  // Attach audit helper to request
  (req as any).audit = async (
    entityType: string,
    entityId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'SIGN' | 'REJECT' | 'EXPORT' | 'PACKAGE',
    oldValues?: any,
    newValues?: any
  ) => {
    try {
      await prisma.auditLog.create({
        data: {
          entityType,
          entityId,
          action,
          performedById: req.userId || null,
          oldValues: oldValues || undefined,
          newValues: newValues || undefined,
          ipAddress: req.ip || req.socket.remoteAddress || null,
        },
      });
    } catch (err) {
      console.error('Audit log error:', err);
    }
  };
  next();
}
