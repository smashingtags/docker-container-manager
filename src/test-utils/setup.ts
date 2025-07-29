// Jest setup file for test configuration
import { logger } from '../utils/logger';

// Suppress console logs during tests unless explicitly needed
beforeAll(() => {
  logger.silent = true;
});

afterAll(() => {
  logger.silent = false;
});

// Global test utilities
(global as any).testTimeout = 10000; // 10 seconds default timeout