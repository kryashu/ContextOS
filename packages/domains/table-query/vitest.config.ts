import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    server: {
      deps: {
        inline: ['xlsx'],
      },
    },
  },
});
