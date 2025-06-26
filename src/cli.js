// @ts-check

import process from 'node:process';
import path from 'node:path';
import { runBuildFlow } from './core.js';

/**
 * @function
 * @name main
 */
export async function main() {
  /** @type {Array} */
  const args = process.argv.slice(2);

  /** @type {string} */
  const githubArg = args.find(arg => arg.startsWith('--github-url='));
  /** @type {string | undefined} */
  const verboseArg = args.find(arg => arg.startsWith('--verbose=')) ?? undefined;

  /** @type {string | null} */
  const githubUrl = githubArg ? githubArg.split('=')[1] : null;
  /** @type {number} */
  const verbose = verboseArg ? parseInt(verboseArg.split('=')[1], 10) : 0;

  /** @type {string} */
  const baseDir = path.resolve(process.cwd());
  //const baseDir = path.resolve(process.cwd(), ...Array(depth).fill('..'));
  console.log('process.cwd(): ', process.cwd())
  console.log('baseDir: ', baseDir)

  await runBuildFlow({ 
    githubUrl,
    verbose,
    baseDir,
    verboseArg,
  });
}
