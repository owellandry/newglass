/**
 * Mock implementation of Electron API for web environments
 * This allows the app to run in a browser without Electron
 */

// In-memory storage for web mode
const webStorage = new Map<string, any>();

// Create mock Electron API
export const createElectronMock = () => {
  return {
    // App info
    getAppVersion: () => Promise.resolve('1.0.0-web'),

    // Store operations
    store: {
      get: (key: string) => {
        console.log(`[Mock] Getting store value for: ${key}`);
        return Promise.resolve(webStorage.get(key) || null);
      },
      set: (key: string, value: any) => {
        console.log(`[Mock] Setting store value for: ${key}`);
        webStorage.set(key, value);
        return Promise.resolve();
      },
      delete: (key: string) => {
        console.log(`[Mock] Deleting store value for: ${key}`);
        webStorage.delete(key);
        return Promise.resolve();
      },
    },

    // Window operations
    window: {
      showSettings: () => Promise.resolve(),
      close: () => Promise.resolve(),
      minimize: () => Promise.resolve(),
      toggleAlwaysOnTop: () => Promise.resolve(),
      setSize: () => Promise.resolve(),
      setPosition: () => Promise.resolve(),
      getBounds: () => Promise.resolve({ x: 0, y: 0, width: 400, height: 600 }),
    },

    // Dialog operations
    dialog: {
      showError: () => Promise.resolve(),
      showMessage: () => Promise.resolve(),
    },

    // OpenRouter API (pass through to fetch in web mode)
    openrouter: {
      request: (options: {
        endpoint: string;
        method: string;
        headers: Record<string, string>;
        body?: string;
      }) => {
        console.log('[Mock] OpenRouter request', options);
        // In web mode, we'll use fetch directly
        return fetch(options.endpoint, {
          method: options.method,
          headers: options.headers,
          body: options.body,
        }).then(res => res.json());
      },
    },

    // Audio operations (no-op in web mode)
    audio: {
      startCapture: () => Promise.resolve(),
      stopCapture: () => Promise.resolve(),
    },

    // Screen operations (no-op in web mode)
    screen: {
      capture: () => Promise.resolve(null),
    },
  };
};

// Initialize the mock if we're in a web environment
if (typeof window !== 'undefined' && window.electronAPI === undefined) {
  console.log('Initializing Electron API mock for web environment');
  // @ts-ignore - we're intentionally adding this to the window object
  window.electronAPI = createElectronMock();
}