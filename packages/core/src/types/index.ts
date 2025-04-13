/**
 * core - Type Definitions
 */

/**
 * Example interface
 */
export interface ExampleConfig {
  /**
   * A sample property
   */
  enabled: boolean;
  
  /**
   * A sample string property
   */
  name: string;
  
  /**
   * Optional configuration options
   */
  options?: Record<string, unknown>;
} 