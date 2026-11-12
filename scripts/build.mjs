import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('miniapp', 'dist', { recursive: true });
console.log('Mini App copied to dist/');
