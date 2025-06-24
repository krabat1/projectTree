import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBuildFlow } from '../src/core.js';
import * as logger from '../src/logger.js';
import ignore from 'ignore';

vi.mock('../src/logger.js', () => ({
  logger: {
    error: vi.fn(),
    step: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn()
  },
  setLogLevel: vi.fn()
}));

vi.mock('../src/interaction.js', () => ({
  askInput: vi.fn().mockResolvedValue({ hashMode: false }),
  askIgnores: vi.fn().mockResolvedValue(false)
}));



const baseArgs = {
  githubUrl: null,
  depth: 0,
  verbose: 0,
  baseDir: '/fake/path',
  verboseArg: undefined,
  depthArg: undefined,
};

describe('runBuildFlow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1️⃣. should exit if githubUrl is missing', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('EXIT') });

    try {
      await expect(runBuildFlow({ ...baseArgs, githubUrl: null }))
        .rejects.toThrow('EXIT');
      console.log('😃 We got an error due to missing githubUrl, that\'s good')
    } catch (err) {
      console.log('☹️ We didn\'t get an error about missing githubUrl, even though we should have')
      console.log('❗️  ' + err.stack)
      throw err
    }
    try {
      expect(logger.logger.error).toHaveBeenCalledWith('--github-url argument is required');
      console.log('😃 Error message appeared due to githubUrl, this is good')
    } catch (err) {
      console.log('☹️ Error message is missing due to missing githubUrl')
      console.log('❗️  ' + err.stack)
      throw err
    }

    try {
      expect(exitSpy).toHaveBeenCalledWith(1);
      console.log('😃 managed to exit the process with 1 (missing githubUrl)')
    } catch (err) {
      console.log('☹️ failed to exit process with 1 (missing githubUrl)')
      console.log('❗️  ' + err.stack)
      throw err
    }
  });

  it('2️⃣. should exit if githubUrl is invalid', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('EXIT') });
    try {
      await expect(runBuildFlow({ ...baseArgs, githubUrl: 'krabat1' }))
        .rejects.toThrow('EXIT');
      console.log('😃 managed to throw an error on bad githubUrl')
    } catch (err) {
      console.log('☹️ failed to throw an error on bad githubUrl')
      console.log('❗️  ' + err.stack)
      throw err
    }

    try {
      expect(logger.logger.error).toHaveBeenCalledWith('Invalid GitHub URL format');
      console.log('😃 managed to send correct message to user about wrong githubUrl')
    } catch (err) {
      console.log('☹️ failed to send correct message to user about wrong githubUrl')
      console.log('❗️  ' + err.stack)
      throw err

    }
    try {
      expect(exitSpy).toHaveBeenCalledWith(1);
      console.log('😃 managed to exit the process with 1 (invalid githubUrl)')
    } catch (err) {
      console.log('☹️ failed to exit the process with 1 (invalid githubUrl)')
      console.log('❗️  ' + err.stack)
      throw err
    }
  });
});

describe('ignore() instance', () => {
  it('3️⃣. should create a valid ignore object with .ignores method', () => {
    const ig = ignore();
    try {
      expect(typeof ig).toBe('object');
      console.log('😃 "ig" is of type object')
    } catch (err) {
      console.log('☹️ "ig" is NOT an object')
      console.log('❗️  ' + err.stack)
      throw err
    }

    try {
      expect(typeof ig.ignores).toBe('function');
      console.log('😃 "ig.ignores" is of type function')
    } catch (err) {
      console.log('☹️ "ig.ignores" is NOT a function type')
      console.log('❗️  ' + err.stack)
      throw err
    }

    try {
      expect(ig.ignores('node_modules/')).toBe(false); // üres ignore lista → semmit nem szűr
      console.log('😃 the "node_modules/" folder is not filtered because it is an empty ignore file')
    } catch (err) {
      console.log('☹️ ignore should be empty, but it still filters the "node_modules/" folder')
      console.log('❗️  ' + err.stack)
      throw err
    }

    ig.add('node_modules/');
    try {
      expect(ig.ignores('node_modules/')).toBe(true);
      console.log('😃 the "node_modules/" folder has been added to the ig and is filtered')
    } catch (err) {
      console.log('☹️ the "node_modules/" folder has been added to the ig, but is not filtered yet')
      console.log('❗️  ' + err.stack)
      throw err
    }

    try {
      expect(ig.ignores('src/')).toBe(false);
      console.log('😃 the "src/" folder is not filtered')
    } catch (err) {
      console.log('☹️ the "src/" folder is filtered and shouldn\'t be')
      console.log('❗️  ' + err.stack)
      throw err
    }

    try {
      expect(ig.constructor.name).toBe('Ignore');
      console.log('😃 the constructor of "ig" is "Ignore"')
    } catch (err) {
      console.log('☹️ the constructor of "ig" is NOT "Ignore"')
      console.log('❗️  ' + err.stack)
      throw err
    }
  });
});

