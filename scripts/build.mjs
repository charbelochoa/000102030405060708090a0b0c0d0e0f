import { build } from 'esbuild'
import { mkdir, cp } from 'node:fs/promises'

await mkdir('build/server', { recursive: true })
await mkdir('build/cli', { recursive: true })
await build({
  entryPoints: ['server/index.ts'],
  outfile: 'build/server/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external'
})
await cp('skills', 'build/skills', { recursive: true })
await build({
  entryPoints: ['cli/index.ts'],
  outfile: 'build/cli/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external'
})
