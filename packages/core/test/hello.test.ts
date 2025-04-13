
    import { describe, it, expect } from 'vitest';
    import { hello } from '../src/main';

    describe('hello', () => {
      it('returns the correct greeting', () => {
        expect(hello()).toBe('Hello from core!');
      });
    });
    