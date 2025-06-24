import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createIgnore } from '../src/core.js'; // vagy ahonnan exportálod

describe('createIgnore', () => {
  it('1️⃣. should create .ptignore file with default content', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
    console.log('TEMP DIR:', tempDir);
    const ignorePath = path.join(tempDir, '.ptignore');
    const answer = true

    await createIgnore(ignorePath, answer);

    const content = await fs.readFile(ignorePath, 'utf8');
    try {
      expect(content).toMatch(/\.git/);
      console.log('😃 The ".git" folder is included in the ignore')
    } catch (err) {
      console.log('☹️ The ".git" folder is NOT included in the ignore')
      console.log('❗️  ' + err.stack)
      throw err
    }
  });
  it('2️⃣. should create .ptignore file without the default content', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
    console.log('TEMP DIR:', tempDir);
    const ignorePath = path.join(tempDir, '.ptignore');
    const answer = false

    await createIgnore(ignorePath, answer);

    const content = await fs.readFile(ignorePath, 'utf8');

    try {
      expect(content.trim()).toMatch('');
      console.log('😃 The ignore is empty.')
    } catch (err) {
      console.log('☹️ Ignore is NOT empty.')
      console.log('❗️  ' + err.stack)
      throw err
    }
  });
});