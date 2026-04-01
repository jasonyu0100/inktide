// Setup file for Vitest tests
// This runs before each test file

// Mock performance.now for timing tests if not available
if (typeof performance === 'undefined') {
  (global as Record<string, unknown>).performance = {
    now: () => Date.now(),
  };
}
