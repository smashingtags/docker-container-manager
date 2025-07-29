import { Request } from 'express';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  timestamp: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
  };
}

export type UserRole = 'admin' | 'user' | 'readonly';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  createdAt: Date;
  lastLogin?: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'id'>;
  expiresIn: number;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  containers: {
    total: number;
    running: number;
    stopped: number;
  };
  timestamp: Date;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
  }>;
  timestamp: Date;
}