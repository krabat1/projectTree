#!/usr/bin/env node
// @ts-check

import fs from 'fs';
import path from 'path';
import ignore from "ignore";
import readline from "readline";
import process from 'node:process';

/**
 * @typedef {Object} Logger
 * @property {(...args: any[]) => void} step
 * @property {(...args: any[]) => void} trace
 * @property {(...args: any[]) => void} warn
 * @property {(...args: any[]) => void} error
 */
/** @type {Logger} */
const logger = {
    step: (...args) => { if (verbose >= 1) console.log(prefix('step', ...args), ...args) },
    trace: (...args) => { if (verbose >= 2) console.log(prefix('trace', ...args), ...args) },
    warn: (...args) => console.warn('⚠️ ', ...args),
    error: (...args) => console.error('❌ ', ...args)
};
/** @function
 * @name prefix
 * @param {string} prop 
 * @param  {any[]} args
 * @returns {string}
 */
function prefix(prop, ...args) {
    if (prop === 'step') {
        return args[0] === '' ? '' : '🟡 ';
    } else if (prop === 'trace') {
        return args[0] === '' ? '' : '🔍 ';
    }
    throw new Error(`Unknown prefix prop: ${prop}`);
}


/** @type {Array} */
const args = process.argv.slice(2);
/** @type {string} */
const githubUrlArg = args.find(arg => arg.startsWith('--github-url='));
/** @type {string} */
const depthArg = args.find(arg => arg.startsWith('--depth='));
/** @type {string} */
const verboseArg = args.find(arg => arg.startsWith('--verbose'));
/** @type {string | null} */
const githubUrl = githubUrlArg ? githubUrlArg.split('=')[1] : null;
/** @type {number} */
const depth = depthArg ? parseInt(depthArg.split('=')[1], 10) : 0;
/** @type {number} */
const verbose = verboseArg ? parseInt(verboseArg.split('=')[1], 10) : 0;
logger.trace('');
logger.trace('USER INPUTS:\r\n-------------');
logger.trace('--githubUrl: ', githubUrl)
logger.trace('--depth: ', depth)
logger.trace('--verbose: ', verbose, '\n')

if (githubUrl === null) {
    logger.error('❌ --github-url argument is required ');
    logger.error('     format: <user>/<repo>/<branch|commit>');
    process.exit(1);
}

/** @type {Array} */
const [user, repo, ...branchParts] = githubUrl.split('/');
/** @type {string} */
const branch = branchParts.join('/');
/** @type {boolean} */
let hashMode = /^[0-9a-f]{40}$/i.test(branch);

if (isNaN(depth) || depth < 0 || depth > 20) {
    logger.error('❌ --depth value must be between 0 and 20');
    process.exit(1);
}

logger.trace('USER INPUT PROCESSING:\r\n----------------------');
logger.trace('USER: ', user);
logger.trace('REPO: ', repo);
logger.trace('branchParts ', branchParts);
logger.trace('branch ', branch);
logger.trace('hashMode ', hashMode);
logger.trace('');

hashMode
    ? logger.trace('BRANCH LOOKS LIKE A COMMIT HASH, WE NEED CONFIRMATION\r\n')
    : logger.trace('BRANCH IS DEFINITELY NOT A COMMIT HASH\r\n');

async function askInput() {
    console.log(`Parsed GitHub ref:`);
    console.log(`    user:   ${user}`);
    console.log(`    repo:   ${repo}`);
    console.log(`    ref:    ${branch}`);
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
        answer = await prompt(
            "❓  Swap / eXit / Continue ? (s/x/c): "
        );
    } while (!['x', 's', 'c'].includes(answer.toLowerCase()))

    if (hashMode && answer.toLowerCase() === 's') {
        hashMode = !hashMode;
        console.log('🔁  Swapped: we will interpret it in branch mode.\n');
    } else if (answer.toLowerCase() === 'c') {
        console.log('✔️   Continue process\n');
    } else if (answer.toLowerCase() === 'x') {
        console.log(`❌   Quitting at the user's request.\n`);
        process.exit(1);
    }
}

await askInput()

// baseDir by cwd and depth argument

/** @type {string} */
const baseDir = path.resolve(process.cwd(), ...Array(depth).fill('..'));

logger.trace('SET UP THE BASE DIRECTORY (baseDir): ', baseDir)
logger.trace('')

/** @type {Object} */
const ig = ignore()

// Load .gitignore and .ptignore files
/** @type {string} */
const gitignorePath = path.join(baseDir, '.gitignore')
/** @type {string} */
const ptignorePath = path.join(baseDir, '.ptignore')
/** @type {string[]} */
const ignorePaths = [gitignorePath, ptignorePath]
/** @type {Array} */
const notExist = [];

/** @function 
 * @name askIgnores
 * @param {string} param
 * @returns {Promise<boolean | undefined>}
*/
async function askIgnores(param) {

    /** @type {string} */
    let answer = '';
    if (param === null) return;
    do {
        if (param === 'both') {
            answer = await prompt("❓  There are no ignore files in the root directory, should I create them? (y/n): ");
        } else if (param === 'gitignore' || param === 'ptignore') {
            answer = await prompt(`There are no .${param} file in the root directory, should I create them? (y/n): `);
        }
    } while (!['y', 'n'].includes(answer.toLowerCase()))

    return answer?.toLowerCase() === 'y';
}

/** @function 
 * @name createIgnore
 * @param {string} filePath
 * @returns {Promise<void>}
*/
async function createIgnore(filePath) {
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
        await fs.promises.writeFile(filePath, data);
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
        await storedStatus.setStatus(res.status + ' ' + (res.status >= 200 && res.status < 400).toString());
        return res.status >= 200 && res.status < 400;
    } catch (error) {
        console.error(error.stack);
        return false;
    }
}

/** @function
 * @name prompt
 * @param {string} question 
 * @returns {Promise<string>}
 */
function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

(async () => {
    for (let ignorePath of ignorePaths) {
        if (!fs.existsSync(ignorePath)) {
            notExist.push(ignorePath)
        }
    }
    if (notExist.length > 0) {
        logger.step('WE ARE ASKING THE USER ABOUT MISSING IGNORE FILES\n');
    }
    if (notExist.length == 0) {
        logger.step('IT SEEMS TO HAVE BOTH IGNORE FILES\n');
    }
    if (notExist.length == 2) {
        /** @type {boolean | undefined} */
        let create = await askIgnores('both');
        if (create) {
            for (let ignorePath of ignorePaths) {
                await createIgnore(ignorePath)
            }
        }
    } else if (notExist.length == 1) {
        /** @type {string} */
        let param;
        ((notExist[0]).endsWith('gitignore'))
            ? param = 'gitignore'
            : param = 'ptignore';
        /** @type {boolean | undefined} */
        let create = await askIgnores(param);
        if (create) { await createIgnore(notExist[0]) }
    }

    logger.trace(`ADD IGNORES TO 'ig' OBJECT`)

    for (let ignorePath of ignorePaths) {
        if (fs.existsSync(ignorePath)) {
            ig.add(fs.readFileSync(ignorePath, 'utf8').split(/\r?\n/))
            logger.trace(`ADDED: ${ignorePath}`);
        } else {
            logger.trace(`FILE NOT EXIST: ${ignorePath}`);
        }
    }
    logger.trace(``);
    /** @function
     * @name isIgnored
     * @param {string} relPath
     * @returns {boolean}
    */
    const isIgnored = (relPath) => {
        /** @type {string} */
        const normalizedPath = relPath.replace(/\\/g, '/');
        /** @type {boolean} */
        const ignored = ig.ignores(normalizedPath);
        return ignored;
    };

    // Generate GitHub raw link
    /** @function
     * @name getGitHubRawLink
     * @param {string} filePath
     * @returns {Promise<string | undefined>}
    */
    async function getGitHubRawLink(filePath) {
        /** @type {string} */
        const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
        if (hashMode) {
            return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${relPath}`;
        } else {
            return `https://raw.githubusercontent.com/${user}/${repo}/refs/heads/${branch}/${relPath}`;
        }
    }

    // build project-tree

    /** @typedef {{
     *   type: 'file' | 'directory',
     *   name: string,
     *   path: string,
     *   size?: number,
     *   githubRaw?: string,
     *   children?: TreeItem[]
     * }} TreeItem
     */


    /** @function
     * @name buildTree
     * @param {string} dir
     * @returns {Promise<TreeItem[]>}
    */
    async function buildTree(dir) {
        // If readdirSync() called with withFileTypes: true the result data will be an array of Dirent.
        //** @type {fs.Dirent[]} */
        /** @type {import('fs').Dirent[]} */
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        /** @type {TreeItem[]} */
        const results = [];


        for (const entry of entries) {
            /** @type {string} */
            const fullPath = path.join(dir, entry.name);
            /** @type {string} */
            const relPath = path.relative(baseDir, fullPath);

            if (isIgnored(relPath)) logger.trace('❌ DROP ignored: ', relPath, '\r\n\r\n------------------------------\r\n')
            if (isIgnored(relPath)) continue;
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
                item.size = fs.statSync(fullPath).size
            }

            if (entry.isDirectory()) {
                item.children = await buildTree(fullPath);
            } else if (entry.isFile()) {
                item.githubRaw = await getGitHubRawLink(fullPath);
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

            if( !(item.type === "directory" && item.children?.length === 0) ){
                results.push(item);
            }
            

        }
        return results;
    }

    // Generate and save projectTree.json

    hashMode
        ? logger.trace('EXAMINE FILES & CHECK URL FOR STATUS:\r\n\r\n-------------------------------------\r\n')
        : logger.trace('EXAMINE FILES:\r\n\r\n------------------------------\r\n');

    /** @type {TreeItem[]} */
    const tree = await buildTree(baseDir);
    /** @type {string} */
    const outPath = path.join(baseDir, 'projectTree.json');
    fs.writeFileSync(outPath, JSON.stringify(tree, null, 2));
    console.log(`💎   projectTree.json created: ${outPath}`);
})()
