#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// manage CLI parameters
const args = process.argv.slice(2);
const githubUrlArg = args.find(arg => arg.startsWith('--github-url='));
const githubUrl = githubUrlArg ? githubUrlArg.split('=')[1] : null;

// Current Working Directory
const baseDir = process.cwd();

// Load .ptignore file
const ignoreFile = path.join(baseDir, '.ptignore');
const ignored = fs.existsSync(ignoreFile)
  ? fs.readFileSync(ignoreFile, 'utf-8').split('\n').map(x => x.trim()).filter(Boolean)
  : [];

// Ignore files
const isIgnored = (relPath) => {
  return ignored.some(pattern => relPath.startsWith(pattern));
};

// Generate GitHub raw link
function getGitHubRawLink(filePath) {
  if (!githubUrl) return null;
  const [user, repo, branch] = githubUrl.split('/');
  const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
  return `https://raw.githubusercontent.com/${user}/${repo}/refs/heads/${branch}/${relPath}`;
}

// build project-tree
function buildTree(dir) {
  const result = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (isIgnored(relPath)) continue;

    if (entry.isDirectory()) {
      result[entry.name] = buildTree(fullPath);
    } else if (entry.isFile()) {
      result[entry.name] = {
        path: relPath,
        githubRaw: getGitHubRawLink(fullPath)
      };
    }
  }

  return result;
}

// Generate and save projectTree.json
const tree = buildTree(baseDir);
const outPath = path.join(baseDir, 'projectTree.json');
fs.writeFileSync(outPath, JSON.stringify(tree, null, 2));
console.log(`✅ projectTree.json létrehozva: ${outPath}`);