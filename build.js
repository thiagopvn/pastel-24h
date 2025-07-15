import { build } from 'esbuild';
import { execSync } from 'child_process';

// Build do frontend
console.log('Building frontend...');
execSync('npm run build', { stdio: 'inherit' });

// Build do backend
console.log('Building backend...');
await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  packages: 'external',
  format: 'esm',
  outfile: 'dist/index.js',
  sourcemap: true,
});

console.log('Build completed!');