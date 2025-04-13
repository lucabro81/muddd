/**
 * core - Main entry point
 */

import { hello } from './core';

// Re-export core functionality
export { hello };

// Export types
export * from './types';

export default {
  hello
}; 