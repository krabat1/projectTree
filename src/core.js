import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { prompt } from './interact.js';
import { logger, setLogLevel } from './logger.js';
import ignore from 'ignore';

/** 
 * @function
 * @param {Object} params
 * @param {string|null} params.githubUrl
 * @param {number} params.depth
 * @param {number} params.verbose
 * @param {string} params.baseDir
 * @param {string | undefined} params.verboseArg
 * @param {string | undefined} params.depthArg
 * @returns {Promise<void>}
 */
export async function runBuildFlow({ githubUrl, depth, verbose, baseDir, verboseArg, depthArg }) {
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

  /** @type {string} */
  const actualBranch = parts.branch;
  if (actualBranch) {/** */ }
  /** @type {{hashMode: boolean }} */
  const { hashMode } = await askInput({ parts, verbose, depth, verboseArg, depthArg });

  /** @type {string} */
  const gitignorePath = path.join(baseDir, '.gitignore');
  /** @type {string} */
  const ptignorePath = path.join(baseDir, '.ptignore');
  /** @type {string[]} */
  const ignorePaths = [gitignorePath, ptignorePath];
  /** @type {Array} */
  const notExist = [];

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

  if (notExist.length === 2) {
    /** @type {boolean | undefined} */
    let create = await askIgnores('both');
    if (create) {
      for (let ignorePath of ignorePaths) {
        await createIgnore(ignorePath);
      }
    }
  } else if (notExist.length === 1) {
    /** @type {string} */
    let ignoreName;
    ((notExist[0]).endsWith('gitignore'))
      ? ignoreName = 'gitignore'
      : ignoreName = 'ptignore';
    /** @type {boolean | undefined} */
    let create = await askIgnores(ignoreName);
    if (create) {
      await createIgnore(notExist[0]);
    }
  }

  // IGNORE ADD

  /** @type {ReturnType<typeof ignore>} */
  const ig = ignore()

  logger.trace(`ADD IGNORES TO 'ig' OBJECT`)

  for (let ignorePath of ignorePaths) {
    let result
    try {
      await fs.access(ignorePath)
      result = await fs.readFile(ignorePath, 'utf8')
      if (result) {
        ig.add(result.split(/\r?\n/))
        logger.trace(`ADDED: ${ignorePath}`);
      }
    } catch {
      logger.trace(`FILE NOT EXIST: ${ignorePath}`);
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
 * @param {number} inputOptions.depth 
 * @param {string | undefined} inputOptions.verboseArg 
 * @param {string | undefined} inputOptions.depthArg 
 * @returns {Promise<{hashMode: boolean }>}
 */
async function askInput(inputOptions) {
  const { parts, verbose, depth, verboseArg, depthArg } = inputOptions
  /** @type {boolean} */
  let hashMode = false;
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
  } else if (verbose === 0) {
    console.log("💬  You set the --verbose argument to 0, we will only\n    inform you of the most necessary information.")
  } else if (verbose === 1) {
    console.log("💬  You set the --verbose argument to 1, we will\n    inform you about the most important steps")
  } else if (verbose === 2) {
    console.log("💬  You set the --verbose argument to 2, we\n    will inform you about every small step. ")
  }
  if (depthArg === undefined) {
    console.log("❗️  --depth: You did not specify a --depth argument, so we assume\n    that your application's entry point is at its root (0).")
  } else if (depth === 0) {
    console.log(`--depth=0: You have defined the entry point of your application in its root.`)
  } else {
    console.log(`--depth=${depth}: The entry point of your application is ${depth} directory levels deep from its root.`)
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
  do {
    answer = await prompt("❓  Swap / eXit / Continue ? (s/x/c): ");
  } while (!['x', 's', 'c'].includes(answer.toLowerCase().trim()));

  if (hashMode && answer.toLowerCase() === 's') {
    hashMode = !hashMode;
    console.log('🔁  Swapped: we will interpret it in branch mode.\n');
  } else if (answer.toLowerCase() === 'c') {
    console.log('✔️   Continue process\n');
  } else if (answer.toLowerCase() === 'x') {
    console.log(`❌   Quitting at the user's request.\n`);
    process.exit(0);
  }

  return { hashMode };
}

/** @function 
 * @name askIgnores
 * @param {string} ignoreName
 * @returns {Promise<boolean | undefined>}
*/
async function askIgnores(ignoreName) {

  /** @type {string} */
  let answer = '';
  if (ignoreName === null) return;
  do {
    if (ignoreName === 'both') {
      answer = await prompt("❓  There are no ignore files in the root directory, should I create them? (y/n): ");
    } else if (ignoreName === 'gitignore' || ignoreName === 'ptignore') {
      answer = await prompt(`There is no .${ignoreName} file in the root directory, should I create them? (y/n): `);
    }
  } while (!['y', 'n'].includes(answer.toLowerCase()))

  return answer?.toLowerCase() === 'y';
}

/** @function 
 * @name createIgnore
 * @param {string} filePath
 * @returns {Promise<void>}
*/
export async function createIgnore(filePath) {
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
    const which = base;
    logger.trace('WHICH IGNORE FILE? .', which, '\n')
    /** @type {string} */
    const data = content[which]?.join("\n");
    /** @type {string} */
    const messageTryText = ` 🔧  ${filePath}\n🟡   🔧  Let's try to create it and upload it with basic content.\n`
    messageTry = {
      gitignore: messageTryText,
      ptignore: messageTryText
    }
    logger.step(messageTry[which]);
    await fs.writeFile(filePath, data);
    /** @type {string} */
    const messageDoneText = ` ✔️  ${filePath}\n🟡   ✔️  Created it with the basic ignore content.\n`
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
const isIgnored = (relPath, ig) => {
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
  const branch = rest.join('/') || 'main';
  return { user, repo, branch };
}