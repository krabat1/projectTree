// @ts-check

import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { prompt } from './interact.js';
import { logger, setLogLevel } from './logger.js';
import ignore from 'ignore';

/** @type {boolean} */
export let hashMode = false;
/** @type {boolean} */
/** @type {Array} */
export const notExist = [];

export async function getHashMode() { return hashMode }

/** 
 * @function
 * @param {Object} params
 * @param {string|null} params.githubUrl
 * @param {number} params.verbose
 * @param {string} params.baseDir
 * @param {string | undefined} params.verboseArg
 * @returns {Promise<void>}
 */
export async function runBuildFlow({ githubUrl, verbose, baseDir, verboseArg }) {
  if (!githubUrl) {
    logger.error('--github-url argument is required');
    logger.error('       format: <user>/<repo>/<branch|commit>');
    process.exit(1);
  }

  setLogLevel(verbose);

  /** @type {{ user: string, repo: string, branch: string } | null} */
  const parts = parseGithubUrl(githubUrl);
  if (!parts) {
    logger.error('Invalid GitHub URL format');
    process.exit(1);
  }




  hashMode = await askInput({ parts, verbose, verboseArg });

  /** @type {string} */
  const gitignorePath = path.join(baseDir, '.gitignore');
  /** @type {string} */
  const ptignorePath = path.join(baseDir, '.ptignore');
  /** @type {string[]} */
  const ignorePaths = [gitignorePath, ptignorePath];

  for (let ignorePath of ignorePaths) {
    try {
      await fs.access(ignorePath);
    } catch {
      notExist.push(ignorePath);
    }
  }

  if (notExist.length > 0) {
    logger.step('☝️ WE ARE ASKING THE USER ABOUT MISSING IGNORE FILES\n');
  }
  if (notExist.length === 0) {
    logger.step('👍 IT SEEMS TO HAVE BOTH IGNORE FILES\n');
  }


  if (notExist.length > 0) {
    /** @type {boolean | undefined} */
    let preCreate;
    if (notExist.length === 2) {
      preCreate = await askIgnores('both');
    } else if (notExist.length === 1) {
      /** @type {string} */
      let ignoreName;
      ((notExist[0]).endsWith('gitignore'))
        ? ignoreName = 'gitignore'
        : ignoreName = 'ptignore';
      preCreate = await askIgnores(ignoreName);
    }
    /** @type {boolean} */
    let create = true;
    if (typeof preCreate === "boolean") {
      create = preCreate
    }
    if (notExist.length === 2) {
      for (let ignorePath of ignorePaths) {
        await createIgnore(ignorePath, create);
      }
    } else {
      await createIgnore(notExist[0], create);
    }
  }

  // IGNORE ADD

  /** @type {ReturnType<typeof ignore>} */
  const ig = ignore()
  //logger.trace('typeof ig: ', ig.constructor.name)

  logger.trace(`ADD IGNORES TO 'ig' OBJECT`)

  for (let ignorePath of ignorePaths) {
    let result
    try {
      await fs.access(ignorePath)
      result = await fs.readFile(ignorePath, 'utf8')
      if (!result.trim()) {
        logger.warn(`${ignorePath} is empty - nothing will be ignored`);
      } else {
        ig.add(result.split(/\r?\n/))
        logger.trace(`ADDED: ${ignorePath}`);
      }
    } catch {
      logger.warn(`FILE NOT EXIST: ${ignorePath}`);
    }
  }

  logger.trace('', '\r\n\r\n-------------------------------------\r\n')

  // Generate and save projectTree.json

  hashMode
    ? logger.trace('EXAMINE FILES & CHECK URL FOR STATUS:\r\n\r\n-------------------------------------\r\n')
    : logger.trace('EXAMINE FILES:\r\n\r\n------------------------------\r\n');

  /** @type {TreeItem[]} */
  const tree = await buildTree({ baseDir, scanDir: baseDir, hashMode, ig, parts });
  /** @type {string} */
  const outPath = path.join(baseDir, 'projectTree.json');
  await fs.writeFile(outPath, JSON.stringify(tree, null, 2));
  console.log(`💎   projectTree.json created: ${outPath}`);
}

/**
 * @function
 * @name askInput
 * @param {Object} inputOptions 
 * @param {{ user:string, repo: string, branch: string }} inputOptions.parts 
 * @param {number} inputOptions.verbose 
 * @param {string | undefined} inputOptions.verboseArg 
 * @returns {Promise<boolean >}
 */
export async function askInput(inputOptions) {
  const { parts, verbose, verboseArg } = inputOptions
  hashMode = false;
  if (/^[0-9a-f]{40}$/.test(parts.branch)) {
    hashMode = true;
  }
  // Mindenképp jelentünk a felhasználónak nemcsak akkor ha a hashMode = true 
  logger.trace('USER INPUT PROCESSING:\r\n----------------------');
  logger.trace('USER: ', parts.user);
  logger.trace('REPO: ', parts.repo);
  //logger.trace('branchParts ', branchParts);
  logger.trace('branch ', parts.branch);
  logger.trace('hashMode ', hashMode);
  logger.trace('');

  hashMode
    ? logger.trace('BRANCH LOOKS LIKE A COMMIT HASH, WE NEED CONFIRMATION\r\n')
    : logger.trace('BRANCH IS DEFINITELY NOT A COMMIT HASH\r\n');

  console.log(`Parsed GitHub ref:`);
  console.log(`    user:   ${parts.user}`);
  console.log(`    repo:   ${parts.repo}`);
  console.log(`    ref:    ${parts.branch}`);
  console.log(`    type:   ${hashMode ? 'commit hash*' : 'branch'}`);

  console.log('');
  if (verboseArg === undefined) {
    console.log("💬  You not set the --verbose argument, we will only\n     inform you of the most necessary information.")
  } else {
    const text = [
      "we will only\n    inform you of the most necessary information.",
      "we will\n    inform you about the most important steps",
      "we\n    will inform you about every small step."
    ]
    console.log(`💬  You set the --verbose argument to ${verbose},  ${text[verbose]}`)
  }


  if (hashMode) {
    console.log(`\n * Note: this is 40 hex characters, but confirm that it is a commit hash.\n`);
  }
  console.log(`🔴  In case of any other errors, press [x] to exit and try again!`);
  if (hashMode) {
    console.log(`🟡  If the given ref value is correct, but not a commit hash, press [s] (swap),\n    and from now on we will interpret it as a branch.`);
  }
  console.log(`🟢  If everything is fine, press [c] to continue!\n`);

  /** @type {string} */
  let answer;
  if (hashMode) {
    do {
      answer = await prompt("❓  Swap / eXit / Continue ? (s/x/c): ");
    } while (!['x', 's', 'c'].includes(answer.toLowerCase().trim()));
  } else {
    do {
      answer = await prompt("❓  eXit / Continue ? (x/c): ");
    } while (!['x', 'c'].includes(answer.toLowerCase().trim()));
  }

  if (hashMode && answer.toLowerCase() === 's') {
    hashMode = !hashMode;
    console.log('🔁  Swapped: we will interpret it in branch mode.\n');
  } else if (answer.toLowerCase() === 'c') {
    console.log('✔️   Continue process\n');
  } else if (answer.toLowerCase() === 'x') {
    console.log(`❌   Quitting at the user's request.\n`);
    process.exit(1);
  }

  return hashMode;
}

/** @function 
 * @name askIgnores
 * @param {string} ignoreName
 * @returns {Promise<boolean | undefined>}
*/
export async function askIgnores(ignoreName) {

  /** @type {string} */
  let answer = '';
  if (ignoreName === null) return;
  do {
    if (ignoreName === 'both') {
      answer = await prompt("❓  There are no ignore files in the root directory, should I create them with base content (for an empty file choose no)? (y/n): ");
    } else if (ignoreName === 'gitignore' || ignoreName === 'ptignore') {
      answer = await prompt(`There is no .${ignoreName} file in the root directory, should I create them with base content (for an empty file choose no)? (y/n): `);
    }
  } while (!['y', 'n'].includes(answer.toLowerCase()))

  return answer?.toLowerCase() === 'y';
}

/** @function 
 * @name createIgnore
 * @param {string} filePath
 * @param {boolean} answer
 * @returns {Promise<void>}
*/
export async function createIgnore(filePath, answer) {
  /** @type {{
   * gitignore: string[],
   * ptignore: string[]
   * }} */
  const content = {
    gitignore: ["node_modules/"],
    ptignore: [
      "lib/",
      "test-fixtures/",
      "**/*.log",
      ".git",
      ".DS_Store",
      "Thumbs.db"
    ],
  }
  /** @type {{
   * gitignore: string,
   * ptignore: string
   * }} */
  let messageTry;
  /** @type {{
   * gitignore: string,
   * ptignore: string
   * }} */
  let messageDone;
  try {
    const base = path.basename(filePath).replace(/^\./, '');
    if (base !== 'gitignore' && base !== 'ptignore') {
      throw new Error(`Unsupported ignore file type: ${filePath}`);
    }
    /** @type {'gitignore' | 'ptignore'} */
    const which = /** @type {'gitignore' | 'ptignore'} */ (base);
    logger.trace('WHICH IGNORE FILE? .', which, '\n')
    /** @type {string} */
    let data = content[which]?.join("\n");
    /** @type {string} */
    const messageTryText = ` 🔧  ${filePath}\n🟡   🔧  Let's try to create it and upload it with basic content.\n`
    messageTry = {
      gitignore: messageTryText,
      ptignore: messageTryText
    }
    logger.step(messageTry[which]);
    if (!answer) { data = ''; }
    await fs.writeFile(filePath, data);
    /** @type {string} */
    let messageDoneText;
    if (!answer) {
      messageDoneText = ` ✔️  ${filePath}\n🟡   ✔️  Created it without content, as you wish.\n`
    } else {
      /** @type {string} */
      messageDoneText = ` ✔️  ${filePath}\n🟡   ✔️  Created it with the basic ignore content.\n`
    }
    messageDone = {
      gitignore: messageDoneText,
      ptignore: messageDoneText
    }
    logger.step(messageDone[which]);
  } catch (error) {
    console.error(`❌ ${filePath} It failed to create it`);
    console.error(error.stack);
    process.exit(1)
  }
}

/** 
 * @function
 * @name isIgnored
 * @param {string} relPath
 * @param {ReturnType<typeof ignore>} ig
 * @returns {boolean}
*/

export const isIgnored = (relPath, ig) => {
  /** @type {string} */
  const normalizedPath = relPath.replace(/\\/g, '/');
  /** @type {boolean} */
  const ignored = ig.ignores(normalizedPath);
  return ignored;
};

/** @function
 * @name getGitHubRawLink
 * @param {Object} rawLinkOptions
 * @param {string} rawLinkOptions.baseDir
 * @param {string} rawLinkOptions.filePath
 * @param {boolean} rawLinkOptions.hashMode
 * @param {{ user: string, repo: string, branch: string }} rawLinkOptions.parts
 * @returns {Promise<string | undefined>}
*/
async function getGitHubRawLink(rawLinkOptions) {
  const { baseDir, filePath, hashMode, parts } = rawLinkOptions
  /** @type {string} */
  const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
  if (hashMode) {
    return `https://raw.githubusercontent.com/${parts.user}/${parts.repo}/${parts.branch}/${relPath}`;
  } else {
    return `https://raw.githubusercontent.com/${parts.user}/${parts.repo}/refs/heads/${parts.branch}/${relPath}`;
  }
}

/**
 * @typedef {Object} storedStatus
 * @property {string} _stored
 * @property {() => string} getStatus
 * @property {(value: string) => void} setStatus
 */
/** @type {storedStatus} */
const storedStatus = {
  // data property
  _stored: '',
  // accessor property(getter)
  getStatus: function () {
    return this._stored;
  },
  setStatus: function (value) {
    this._stored = value;
  }
}

/** @function 
 * @name checkUrlExists
 * @param {string} url
 * @returns {Promise<boolean>}
*/
async function checkUrlExists(url) {
  try {
    /** @type {Response} */
    const res = await fetch(url, { method: 'HEAD' });
    storedStatus.setStatus(res.status + ' ' + (res.status >= 200 && res.status < 400).toString());
    return res.status >= 200 && res.status < 400;
  } catch (error) {
    console.error(error.stack);
    return false;
  }
}



// build project-tree

/** 
 * @typedef {{
 *   type: 'file' | 'directory',
 *   name: string,
 *   path: string,
 *   size?: number,
 *   githubRaw?: string,
 *   children?: TreeItem[]
 * }} TreeItem
 */

/**
 * @typedef {Object} BuildTreeOptions
 * @property {string} baseDir
 * @property {string} scanDir
 * @property {boolean} hashMode
 * @property {ReturnType<typeof ignore>} ig
 * @property {{ user: string, repo: string, branch: string }} parts
 */

/** 
 * @function
 * @name buildTree
 * @param {BuildTreeOptions} buildTreeOptions
 * @returns {Promise<TreeItem[]>}
 */

async function buildTree(buildTreeOptions) {
  const { baseDir, scanDir, hashMode, ig, parts } = buildTreeOptions
  // Additionally, when fs.readdir() or fs.readdirSync() is called with the withFileTypes option set to true, the resulting array is filled with <fs.Dirent> objects, rather than strings or <Buffer>s.
  /** @type {import('fs').Dirent[]} */
  const entries = await fs.readdir(scanDir, { withFileTypes: true });
  /** @type {TreeItem[]} */
  const results = [];

  for (const entry of entries) {
    /** @type {string} */
    const fullPath = path.join(scanDir, entry.name);
    /** @type {string} */
    const relPath = path.relative(baseDir, fullPath);
    //    console.log(baseDir,'\r\n', fullPath)
    if (isIgnored(relPath, ig)) {
      logger.trace('❌ DROP ignored: ', relPath, '\r\n\r\n------------------------------\r\n')
      continue;
    }
    logger.trace('✅ KEEP not ignored: ', relPath)
    if (!hashMode) {
      logger.trace('', '\r\n------------------------------\r\n')
    }

    /** @type {TreeItem} */
    const item = {
      type: entry.isDirectory() ? 'directory' : 'file',
      name: entry.name,
      path: relPath.replace(/\\/g, '/'),
    };


    if (!entry.isDirectory()) {
      /** @type {Object | undefined} */
      let fileStat;
      try {
        fileStat = await fs.stat(fullPath)
      } catch (err) {
        console.error(err.stack)
      }
      item.size = fileStat.size
    }

    if (entry.isDirectory()) {
      item.children = await buildTree({
        ...buildTreeOptions,           // all other properties unchanged
        scanDir: fullPath              // only scanDir changes
      });
    } else if (entry.isFile()) {
      item.githubRaw = await getGitHubRawLink({ baseDir, filePath: fullPath, hashMode, parts });
    }

    if (hashMode && 'githubRaw' in item && typeof item.githubRaw === 'string') {
      /** @type {boolean} */
      const statusOk = await checkUrlExists(item.githubRaw)

      if (!statusOk) {
        logger.trace('❌ STATUS: ', storedStatus.getStatus());
        logger.trace('', '\r\n\r\n------------------------------\r\n')
        continue;
      } else {
        logger.trace('✅ STATUS: ', storedStatus.getStatus(), '\r\n🔍  🌐 URL: ', item.githubRaw, '\r\n🔍  💻 LOCAL: ', fullPath);
        logger.trace('', '\r\n\r\n------------------------------\r\n')
      }

    }

    if (!(item.type === "directory" && item.children?.length === 0)) {
      results.push(item);
    }


  }
  return results;
}




/**
 * @function
 * @name parseGithubUrl
 * @param {string} input 
 * @returns {{ user: string, repo: string, branch: string } | null}
 */
export function parseGithubUrl(input) {
  /** @type {Array} */
  const parts = input.split('/');
  if (parts.length < 3) return null;
  /** @type {Array} */
  const [user, repo, ...rest] = parts;
  /** @type {string} */
  const branch = rest.join('/');
  return { user, repo, branch };
}