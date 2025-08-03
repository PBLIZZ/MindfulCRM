import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['server/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  shims: true,
  clean: true,
  sourcemap: true,
  dts: false,
  splitting: false,
  outDir: 'dist',
  // Fix: Mark everything except local code as external
  external: [
    /^[^./]|^\.[^./]/, // All node_modules
    /node:/, // Node built-ins
  ],
  noExternal: [
    /^\.\.\/shared/, // Bundle shared folder
    /^\.\.?\//, // Bundle relative imports
  ],
  esbuildOptions(options) {
    options.packages = 'external'; // Don't bundle any npm packages
  },
});
