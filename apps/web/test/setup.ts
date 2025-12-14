import { vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// Setup test environment
beforeAll(() => {
  // Ensure tmp directory exists for database tests
  const tmpDir = './tmp/dbtests';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
});

// Mock console.error in tests to keep output clean
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  vi.clearAllMocks();
});

// Global test timeout (30 seconds for database operations)
vi.setConfig({ testTimeout: 30000 });

// Clean up temporary files after all tests
afterAll(() => {
  const tmpDir = './tmp/dbtests';
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});