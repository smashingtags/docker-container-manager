import { User, LoginRequest, LoginResponse, UserRole } from '@/types/api.types';
import { DatabaseService } from '@/services/database.service';

export interface AuthService {
  login(credentials: LoginRequest): Promise<LoginResponse>;
  validateToken(token: string): Promise<User | null>;
  createUser(username: string, password: string, role: UserRole): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  listUsers(): Promise<User[]>;
}

export class AuthServiceImpl implements AuthService {
  constructor(private databaseService: DatabaseService) {}

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // Implementation will be added in task 12.1
    throw new Error('Not implemented');
  }

  async validateToken(token: string): Promise<User | null> {
    // Implementation will be added in task 12.1
    throw new Error('Not implemented');
  }

  async createUser(username: string, password: string, role: UserRole): Promise<User> {
    // Implementation will be added in task 12.1
    throw new Error('Not implemented');
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    // Implementation will be added in task 12.1
    throw new Error('Not implemented');
  }

  async deleteUser(id: string): Promise<void> {
    // Implementation will be added in task 12.1
    throw new Error('Not implemented');
  }

  async listUsers(): Promise<User[]> {
    // Implementation will be added in task 12.1
    throw new Error('Not implemented');
  }
}