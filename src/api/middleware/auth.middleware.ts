import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from '@/types/api.types';
import { AuthService } from '@/modules/auth';

export function createAuthMiddleware(authService: AuthService) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractToken(req);
      
      if (!token) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No authentication token provided',
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const user = await authService.validateToken(token);
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired authentication token',
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(role: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    const roleHierarchy: Record<UserRole, number> = {
      'readonly': 1,
      'user': 2,
      'admin': 3
    };

    if (roleHierarchy[req.user.role] < roleHierarchy[role]) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions. Required role: ${role}`,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    next();
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}