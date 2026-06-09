import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Brand guard (Workstream A): the raster PNG logo must not be imported in
 *  source anymore — every surface renders the <Logo/> component (crisp SVG). */
function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe('logo brand guard', () => {
  it('no source file imports the raster upchange-logo.png', () => {
    const srcRoot = resolve(__dirname, '../../../');
    const offenders = walk(srcRoot).filter((file) =>
      /import\s+\w+\s+from\s+['"].*upchange-logo\.png['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
