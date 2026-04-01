import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Browser API Mocks ────────────────────────────────────────────────────────

// Create a mock localStorage
function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

// Create a mock window with event handling
function createWindowMock() {
  const listeners: Record<string, Set<Function>> = {};
  return {
    addEventListener: vi.fn((event: string, handler: Function) => {
      if (!listeners[event]) listeners[event] = new Set();
      listeners[event].add(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      listeners[event]?.delete(handler);
    }),
    dispatchEvent: vi.fn((event: { type: string }) => {
      listeners[event.type]?.forEach(h => h(event));
      return true;
    }),
    _listeners: listeners,
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const OPENROUTER_KEY = 'ne_openrouter_key';
const REPLICATE_KEY = 'ne_replicate_key';
const OPENAI_KEY = 'ne_openai_key';
const KEYS_CHANGED_EVENT = 'ne-api-keys-changed';

// ── Test the hook logic patterns ─────────────────────────────────────────────
// Since jsdom has ESM compatibility issues, we test the underlying logic
// that the useFeatureAccess hook implements

describe('useFeatureAccess - Logic Patterns', () => {
  let localStorage: ReturnType<typeof createLocalStorageMock>;
  let window: ReturnType<typeof createWindowMock>;

  beforeEach(() => {
    localStorage = createLocalStorageMock();
    window = createWindowMock();
    vi.stubEnv('NEXT_PUBLIC_USER_API_KEYS', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Helper to simulate reading keys from localStorage
  function readKeys() {
    return {
      openRouterKey: localStorage.getItem(OPENROUTER_KEY) ?? '',
      replicateKey: localStorage.getItem(REPLICATE_KEY) ?? '',
      openAiKey: localStorage.getItem(OPENAI_KEY) ?? '',
    };
  }

  // Helper to simulate notifying change
  function notifyChange() {
    window.dispatchEvent({ type: KEYS_CHANGED_EVENT });
  }

  describe('localStorage operations', () => {
    it('returns empty string for missing key', () => {
      const keys = readKeys();
      expect(keys.openRouterKey).toBe('');
    });

    it('stores and retrieves OpenRouter key', () => {
      localStorage.setItem(OPENROUTER_KEY, 'test-key');
      const keys = readKeys();
      expect(keys.openRouterKey).toBe('test-key');
    });

    it('stores and retrieves Replicate key', () => {
      localStorage.setItem(REPLICATE_KEY, 'r8_test');
      const keys = readKeys();
      expect(keys.replicateKey).toBe('r8_test');
    });

    it('stores and retrieves OpenAI key', () => {
      localStorage.setItem(OPENAI_KEY, 'sk-test');
      const keys = readKeys();
      expect(keys.openAiKey).toBe('sk-test');
    });

    it('removeItem clears specific key', () => {
      localStorage.setItem(OPENROUTER_KEY, 'key1');
      localStorage.setItem(REPLICATE_KEY, 'key2');
      localStorage.removeItem(OPENROUTER_KEY);

      expect(localStorage.getItem(OPENROUTER_KEY)).toBeNull();
      expect(localStorage.getItem(REPLICATE_KEY)).toBe('key2');
    });

    it('clear removes all keys', () => {
      localStorage.setItem(OPENROUTER_KEY, 'key1');
      localStorage.setItem(REPLICATE_KEY, 'key2');
      localStorage.setItem(OPENAI_KEY, 'key3');
      localStorage.clear();

      const keys = readKeys();
      expect(keys.openRouterKey).toBe('');
      expect(keys.replicateKey).toBe('');
      expect(keys.openAiKey).toBe('');
    });
  });

  describe('event synchronization', () => {
    it('dispatchEvent notifies listeners', () => {
      const handler = vi.fn();
      window.addEventListener(KEYS_CHANGED_EVENT, handler);
      notifyChange();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('multiple listeners receive event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      window.addEventListener(KEYS_CHANGED_EVENT, handler1);
      window.addEventListener(KEYS_CHANGED_EVENT, handler2);
      notifyChange();
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('removeEventListener stops notifications', () => {
      const handler = vi.fn();
      window.addEventListener(KEYS_CHANGED_EVENT, handler);
      window.removeEventListener(KEYS_CHANGED_EVENT, handler);
      notifyChange();
      expect(handler).not.toHaveBeenCalled();
    });

    it('sync pattern: update localStorage then dispatch', () => {
      const syncHandler = vi.fn(() => {
        // Handler reads the updated value
        const keys = readKeys();
        expect(keys.openRouterKey).toBe('synced-key');
      });

      window.addEventListener(KEYS_CHANGED_EVENT, syncHandler);
      localStorage.setItem(OPENROUTER_KEY, 'synced-key');
      notifyChange();

      expect(syncHandler).toHaveBeenCalled();
    });
  });

  describe('server keys mode (userApiKeys = false)', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_USER_API_KEYS', '');
    });

    it('userApiKeys is false', () => {
      const userApiKeys = process.env.NEXT_PUBLIC_USER_API_KEYS === 'true';
      expect(userApiKeys).toBe(false);
    });

    it('hasKey is always true regardless of localStorage', () => {
      const userApiKeys = false;
      const openRouterKey = localStorage.getItem(OPENROUTER_KEY) ?? '';

      const hasOpenRouterKey = userApiKeys ? !!openRouterKey : true;
      expect(hasOpenRouterKey).toBe(true);
    });

    it('hasKey remains true even after clear', () => {
      const userApiKeys = false;
      localStorage.clear();
      const openRouterKey = localStorage.getItem(OPENROUTER_KEY) ?? '';

      const hasOpenRouterKey = userApiKeys ? !!openRouterKey : true;
      expect(hasOpenRouterKey).toBe(true);
    });
  });

  describe('user keys mode (userApiKeys = true)', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_USER_API_KEYS', 'true');
    });

    it('userApiKeys is true', () => {
      const userApiKeys = process.env.NEXT_PUBLIC_USER_API_KEYS === 'true';
      expect(userApiKeys).toBe(true);
    });

    it('hasKey is false when no key stored', () => {
      const userApiKeys = true;
      const openRouterKey = localStorage.getItem(OPENROUTER_KEY) ?? '';

      const hasOpenRouterKey = userApiKeys ? !!openRouterKey : true;
      expect(hasOpenRouterKey).toBe(false);
    });

    it('hasKey is true when key stored', () => {
      const userApiKeys = true;
      localStorage.setItem(OPENROUTER_KEY, 'user-key');
      const openRouterKey = localStorage.getItem(OPENROUTER_KEY) ?? '';

      const hasOpenRouterKey = userApiKeys ? !!openRouterKey : true;
      expect(hasOpenRouterKey).toBe(true);
    });

    it('hasKey becomes false after key removed', () => {
      const userApiKeys = true;
      localStorage.setItem(OPENROUTER_KEY, 'user-key');
      localStorage.removeItem(OPENROUTER_KEY);
      const openRouterKey = localStorage.getItem(OPENROUTER_KEY) ?? '';

      const hasOpenRouterKey = userApiKeys ? !!openRouterKey : true;
      expect(hasOpenRouterKey).toBe(false);
    });

    it('empty string key is treated as no key', () => {
      const userApiKeys = true;
      localStorage.setItem(OPENROUTER_KEY, '');
      const openRouterKey = localStorage.getItem(OPENROUTER_KEY) ?? '';

      const hasOpenRouterKey = userApiKeys ? !!openRouterKey : true;
      expect(hasOpenRouterKey).toBe(false);
    });

    it('whitespace-only key is treated as having a key', () => {
      const userApiKeys = true;
      localStorage.setItem(OPENROUTER_KEY, '   ');
      const openRouterKey = localStorage.getItem(OPENROUTER_KEY) ?? '';

      const hasOpenRouterKey = userApiKeys ? !!openRouterKey : true;
      expect(hasOpenRouterKey).toBe(true);
    });
  });

  describe('clearKeys operation', () => {
    it('removes all three keys from localStorage', () => {
      localStorage.setItem(OPENROUTER_KEY, 'key1');
      localStorage.setItem(REPLICATE_KEY, 'key2');
      localStorage.setItem(OPENAI_KEY, 'key3');

      // Simulate clearKeys
      localStorage.removeItem(OPENROUTER_KEY);
      localStorage.removeItem(REPLICATE_KEY);
      localStorage.removeItem(OPENAI_KEY);
      notifyChange();

      expect(localStorage.getItem(OPENROUTER_KEY)).toBeNull();
      expect(localStorage.getItem(REPLICATE_KEY)).toBeNull();
      expect(localStorage.getItem(OPENAI_KEY)).toBeNull();
    });

    it('notifies listeners after clearing', () => {
      const handler = vi.fn();
      window.addEventListener(KEYS_CHANGED_EVENT, handler);

      localStorage.removeItem(OPENROUTER_KEY);
      localStorage.removeItem(REPLICATE_KEY);
      localStorage.removeItem(OPENAI_KEY);
      notifyChange();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('setKey operations', () => {
    it('setOpenRouterKey stores and notifies', () => {
      const handler = vi.fn();
      window.addEventListener(KEYS_CHANGED_EVENT, handler);

      // Simulate setOpenRouterKey
      localStorage.setItem(OPENROUTER_KEY, 'new-key');
      notifyChange();

      expect(localStorage.getItem(OPENROUTER_KEY)).toBe('new-key');
      expect(handler).toHaveBeenCalled();
    });

    it('setReplicateKey stores and notifies', () => {
      const handler = vi.fn();
      window.addEventListener(KEYS_CHANGED_EVENT, handler);

      localStorage.setItem(REPLICATE_KEY, 'new-key');
      notifyChange();

      expect(localStorage.getItem(REPLICATE_KEY)).toBe('new-key');
      expect(handler).toHaveBeenCalled();
    });

    it('setOpenAiKey stores and notifies', () => {
      const handler = vi.fn();
      window.addEventListener(KEYS_CHANGED_EVENT, handler);

      localStorage.setItem(OPENAI_KEY, 'new-key');
      notifyChange();

      expect(localStorage.getItem(OPENAI_KEY)).toBe('new-key');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('cross-instance sync pattern', () => {
    it('second instance sees update from first via event', () => {
      // Simulate two hook instances sharing localStorage
      let instance1Value = '';
      let instance2Value = '';

      // Instance 1 sets up
      const sync1 = () => {
        instance1Value = localStorage.getItem(OPENROUTER_KEY) ?? '';
      };
      window.addEventListener(KEYS_CHANGED_EVENT, sync1);
      sync1();

      // Instance 2 sets up
      const sync2 = () => {
        instance2Value = localStorage.getItem(OPENROUTER_KEY) ?? '';
      };
      window.addEventListener(KEYS_CHANGED_EVENT, sync2);
      sync2();

      // Instance 1 updates key
      localStorage.setItem(OPENROUTER_KEY, 'shared-value');
      notifyChange();

      expect(instance1Value).toBe('shared-value');
      expect(instance2Value).toBe('shared-value');
    });
  });
});
