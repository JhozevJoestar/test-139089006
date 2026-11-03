// Plain JS config keeps database tests independent of the CSS/Vite build plugins.
export default {
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
    maxWorkers: 1,
  },
};
