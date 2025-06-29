import { randomUUID } from 'crypto';

// Types
type SessionData = Record<string, any>;
type Environment = 'test' | 'development' | 'production';
type SessionEntry<T = SessionData> = {
  data: T;
  timestamp: number;
};
type SessionStore<T = SessionData> = Map<string, SessionEntry<T>>;
type SessionConfig = {
  environment: Environment;
  ttl: number;
  maxSessions: number;
};

// Global store (closure-based)
const createSessionStore = <T = SessionData>() => {
  const store: SessionStore<T> = new Map();
  return store;
};

// Global shared store
let globalStore: SessionStore = createSessionStore();
let currentConfig: SessionConfig | null = null;

// Default configurations for environment
const getDefaultConfig = (env: Environment): SessionConfig => ({
  environment: env,
  ttl: env === 'test' ? 5 * 60 * 1000 : 30 * 60 * 1000, // 5min test, 30min altri
  maxSessions: env === 'test' ? 100 : 1000
});

// Initialization of the system (call once)
const initSessions = (env: Environment, customConfig?: Partial<SessionConfig>): SessionConfig => {
  const config = { ...getDefaultConfig(env), ...customConfig };
  currentConfig = config;

  // Automatic cleanup setup
  const cleanupInterval = Math.min(config.ttl / 2, 5 * 60 * 1000);
  setInterval(() => cleanup(globalStore, config.ttl), cleanupInterval);

  return config;
};

// Cleanup expired sessions
const cleanup = (store: SessionStore, ttl: number): void => {
  const now = Date.now();
  for (const [sessionId, entry] of store) {
    if (now - entry.timestamp > ttl) {
      store.delete(sessionId);
    }
  }
};

// Evict oldest session
const evictOldest = (store: SessionStore): void => {
  let oldestId = '';
  let oldestTime = Infinity;

  for (const [id, entry] of store) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp;
      oldestId = id;
    }
  }

  if (oldestId) {
    store.delete(oldestId);
  }
};

// Generate session ID
const generateSessionId = (env: Environment): string =>
  env === 'test'
    ? `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    : randomUUID();

// Create default data for session
const createDefaultData = (env: Environment): SessionData => ({
  createdAt: new Date().toISOString(),
  environment: env,
  ...(env === 'test' && { isTestSession: true, testData: {} })
});

// Check if a session is valid
const isSessionValid = (entry: SessionEntry | undefined, ttl: number): boolean => {
  if (!entry) return false;
  return Date.now() - entry.timestamp <= ttl;
};

// CRUD functional operations

// Create new session
const createSession = <T = SessionData>(initialData?: T): string => {
  if (!currentConfig) {
    throw new Error('Sistema sessioni non inizializzato. Chiama initSessions() prima.');
  }

  // Session limit management
  if (globalStore.size >= currentConfig.maxSessions) {
    evictOldest(globalStore);
  }

  const sessionId = generateSessionId(currentConfig.environment);
  const data = initialData || createDefaultData(currentConfig.environment);

  globalStore.set(sessionId, {
    data: data as SessionData,
    timestamp: Date.now()
  });

  return sessionId;
};

// Get session
const getSession = <T = SessionData>(sessionId: string): T | null => {
  if (!currentConfig) return null;

  const entry = globalStore.get(sessionId);
  if (!isSessionValid(entry, currentConfig.ttl)) {
    globalStore.delete(sessionId);
    return null;
  }

  return entry!.data as T;
};

// Update session (immutable merge)
const updateSession = <T = SessionData>(sessionId: string, updates: Partial<T>): boolean => {
  if (!currentConfig) return false;

  const entry = globalStore.get(sessionId);
  if (!isSessionValid(entry, currentConfig.ttl)) {
    globalStore.delete(sessionId);
    return false;
  }

  const updatedData = { ...entry!.data, ...updates };
  globalStore.set(sessionId, {
    data: updatedData,
    timestamp: Date.now()
  });

  return true;
};

// Remove session
const removeSession = (sessionId: string): boolean => {
  return globalStore.delete(sessionId);
};

// Check if session exists
const hasSession = (sessionId: string): boolean => {
  if (!currentConfig) return false;
  const entry = globalStore.get(sessionId);
  return isSessionValid(entry, currentConfig.ttl);
};

// Get all active sessions
const getActiveSessions = (): string[] => {
  if (!currentConfig) return [];
  cleanup(globalStore, currentConfig.ttl);
  return Array.from(globalStore.keys());
};

// Clean all sessions
const clearAllSessions = (): void => {
  globalStore.clear();
};

// Statistics
const getSessionStats = () => ({
  totalSessions: globalStore.size,
  environment: currentConfig?.environment || 'uninitialized'
});

// Higher-order functions for specific contexts

// Create a session context with isolated configuration
const withSessionContext = <T>(
  env: Environment,
  config: Partial<SessionConfig> = {}
) => {
  initSessions(env, config);

  return {
    create: <U = T>(data?: U) => createSession(data),
    get: <U = T>(id: string) => getSession<U>(id),
    update: <U = T>(id: string, updates: Partial<U>) => updateSession(id, updates),
    remove: removeSession,
    exists: hasSession,
    clear: clearAllSessions,
    stats: getSessionStats
  };
};

// Utility functions for test
const withTestSessions = <T = SessionData>(fn: (sessionId: string) => void, initialData?: T): void => {
  const originalConfig = currentConfig;
  initSessions('test');

  const sessionId = createSession(initialData);

  try {
    fn(sessionId);
  } finally {
    removeSession(sessionId);
    currentConfig = originalConfig;
  }
};

// Compose function for multiple operations
const composeSessionOps = (...ops: Array<(sessionId: string) => boolean>) =>
  (sessionId: string): boolean =>
    ops.every(op => op(sessionId));

export {
  // Initialization
  initSessions,

  // Base operations
  createSession,
  getSession,
  updateSession,
  removeSession,
  hasSession,
  getActiveSessions,
  clearAllSessions,
  getSessionStats,

  // Higher-order functions
  withSessionContext,
  withTestSessions,
  composeSessionOps,

  // Types
  type SessionData,
  type Environment,
  type SessionConfig
};

// Usage examples:
/*
// Production setup
initSessions('production', { ttl: 60 * 60 * 1000 });

// Base usage
const sessionId = createSession({ userId: 123, role: 'admin' });
const userData = getSession(sessionId);
updateSession(sessionId, { lastLogin: new Date().toISOString() });

// Isolated context
const testContext = withSessionContext('test');
const testSessionId = testContext.create({ testCase: 'login' });

// Test helper function
withTestSessions(sessionId => {
  updateSession(sessionId, { status: 'testing' });
  console.log(getSession(sessionId));
}, { initialTest: true });

// Composed operations
const validateAndUpdate = composeSessionOps(
  hasSession,
  (id) => updateSession(id, { validated: true })
);
*/