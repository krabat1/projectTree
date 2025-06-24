import { describe, it, expect } from 'vitest';
import { parseGithubUrl } from '../src/core.js';

describe('parseGithubUrl', () => {
  it('1️⃣. should return user, repo and branch from valid input', () => {
    const input = 'krabat1/projectTree/main';
    const result = parseGithubUrl(input);
    try {
      expect(result).toEqual({
        user: 'krabat1',
        repo: 'projectTree',
        branch: 'main'
      });
      console.log('😃 We got the user, repo and branch back.')
    } catch (err) {
      console.log('☹️ We did not get the user, repo and branch back.')
      console.log('❗️  ' + err.stack)
      throw err
    }
  });

  it('2️⃣. should return null if branch is missing (parts.length < 3)', () => {
    const input = 'krabat1/projectTree';
    const result = parseGithubUrl(input);
    try {
      expect(result).toEqual(null);
      console.log('😃 We got a null value back because the branch was missing.')
    } catch (err) {
      console.log('☹️ We should have returned a null value because the branch was missing.')
      console.log('❗️  ' + err.stack)
      throw err
    }
  });

  it('3️⃣. should allow slashes in branch', () => {
    const input = 'krabat1/projectTree/feature/refactor/core';
    const result = parseGithubUrl(input);
    try {
      expect(result).toEqual({
        user: 'krabat1',
        repo: 'projectTree',
        branch: 'feature/refactor/core'
      });
      console.log('😃 There are slashes in the branches.')
    } catch (err) {
      console.log('☹️ There are NO slashes in the branches.')
      console.log('❗️  ' + err.stack)
      throw err
    }
  });
});