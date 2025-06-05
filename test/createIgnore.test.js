import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createIgnore } from '../src/core.js'; // vagy ahonnan exportálod

describe('createIgnore', () => { 
  it('should create .ptignore file with default content', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
    console.log('TEMP DIR:', tempDir);
    const ignorePath = path.join(tempDir, '.ptignore');

    await createIgnore(ignorePath);

    const content = await fs.readFile(ignorePath, 'utf8');
    expect(content).toMatch(/\.git/); 
  });
});