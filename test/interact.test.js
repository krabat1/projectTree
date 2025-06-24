import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';



// Mivel ESM, dinamikusan importáljuk
//const interact = await import('../src/interact.js');
const { runBuildFlow, getHashMode, notExist } = await import('../src/core.js');

const branch = 'krabat1/projectTree/main';
const hash = 'krabat1/projectTree/05edf3aa2a6ce12e107c018d57fa1a6a5aff9c21';
const githubUrl = [branch, hash, 'krabat1/projectTree'];
const ignorefiles = ['00', '01', '10', '11'];
const answerPrompt1 = ['x', 'c', 's'];
const answerPrompt2 = ['y', 'n'];
const depthArg = [undefined];
const verboseArg = [undefined];

const testCases = [];

let promptAnswers = []


githubUrl.forEach(a => {
  ignorefiles.forEach(b => {
    answerPrompt1.forEach(c => {
      answerPrompt2.forEach(d => {
        depthArg.forEach(e => {
          verboseArg.forEach(f => {
            const lastSegment = a.split('/').pop();
            const isHash = typeof lastSegment === 'string' && /^[0-9a-f]{40}$/.test(lastSegment);
            testCases.push({
              githubUrl: a,
              ignorefiles: b.split('').map(Number),
              answerPrompt1: c,
              answerPrompt2: d,
              depthArg: e,
              verboseArg: f,
              isHash
            });
          });
        });
      });
    });
  });
});

// Mockoljuk a node:readline modult
vi.mock('node:readline', () => {
  return {
    default: {
      createInterface: () => ({
        question: (_text, cb) => {
          cb(promptAnswers.shift() ?? 'x') // mindig a következő válasz
        },
        close: () => { }
      })
    }
  };
});

describe('prompt', () => {
  for (let index = 0; index < testCases.length; index++) {
    const testCase = testCases[index];
    const shouldSkip = !testCase.isHash && testCase.answerPrompt1 === 's';
    const testFn = shouldSkip ? it.skip : it;
    if (shouldSkip) {
      console.log(`THE CASE #️⃣ ${index + 1} MUST BE SKIPPED!`)
      testFn(`case #️⃣ ${index + 1} (skip)`, async () => {
        // tesztkód ide jönne
      });
      continue;
    }


    it(`case #️⃣ ${index + 1}`, async () => {
      while (notExist.length) notExist.pop();
      console.log('Details:', testCase)

      // Állítsuk be a prompt válaszokat
      promptAnswers = [testCase.answerPrompt1, testCase.answerPrompt2];

      // Készítsünk temp dir-t és fájlokat, ha szükséges
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `pt-test-${index}-`));
      if (testCase.ignorefiles[0]) {
        await fs.writeFile(path.join(tempDir, '.gitignore'), '# mock');
      }
      if (testCase.ignorefiles[1]) {
        await fs.writeFile(path.join(tempDir, '.ptignore'), '# mock');
      }

      let threw = null;
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('EXIT') });

      try {
        await runBuildFlow({
          githubUrl: testCase.githubUrl,
          depth: testCase.depthArg,
          verbose: testCase.verboseArg,
          baseDir: tempDir,
          verboseArg: testCase.verboseArg,
          depthArg: testCase.depthArg,
        });
      } catch (err) {
        threw = err;
      }
      //console.log('>>threw:', threw)

      if (testCase.githubUrl === 'krabat1/projectTree') {
        try {
          expect(threw).toBeTruthy()
          console.log('😃 we got an error due to bad githubUrl, that\'s good')
        } catch (err) {
          console.log('☹️ we didn\'t get an error about a bad githubUrl, even though we should have')
          console.log('❗️  ' + err.stack)
          throw err
        }
        try {
          expect(exitSpy).toHaveBeenCalledWith(1);
          console.log('😃 managed to exit the process with 1 (missing branch)')
        } catch (err) {
          console.log('☹️ failed to exit the process with 1 (missing branch)')
          console.log('❗️  ' + err.stack)
          throw err
        }
      } else {
        // Első kérdés a runbuildFlow futtatása után minden esetben

        if (testCase.answerPrompt1 === 'x') {
          try {
            expect(exitSpy).toHaveBeenCalledWith(1);
            console.log('😃 managed to exit the process with 1 (when choose [x])')
          } catch (err) {
            console.log('☹️ failed to exit the process with 1 (when choose [x])')
            console.log('❗️  ' + err.stack)
            throw err
          }
        } else {
          try {
            expect(threw).toBe(null);
            console.log('😃 runBuildFlow has not reported any errors so far')
          } catch (err) {
            console.log('☹️ runBuildFlow reported an error')
            console.log('❗️  ' + err.stack)
            throw err
          }
          if (testCase.answerPrompt1 === 'c') {
            console.log('>> ANSWER C', testCase.isHash, await getHashMode())
            if (testCase.isHash) {
              try {
                expect(await getHashMode()).toBe(true)
                console.log('😃 branch is a hash according to the pre-check')
              } catch (err) {
                console.log('☹️ branch is a branch in contrast to the preliminary examination')
                console.log('❗️  ' + err.stack)
                throw err
              }
            } else {
              try {
                expect(await getHashMode()).toBe(false)
                console.log('😃 a branch is a branch according to the pre-test')
              } catch (err) {
                console.log('☹️ branch is a hash in contrast to the preliminary examination')
                console.log('❗️  ' + err.stack)
                throw err
              }
            }
          } else if (testCase.isHash && testCase.answerPrompt1 === 's') {
            try {
              expect(await getHashMode()).toBe(false)
              console.log('😃 managed to treat the hash value as a branch')
            } catch (err) {
              console.log('☹️ failed to handle hash value as branch')
              console.log('❗️  ' + err.stack)
              throw err
            }
          }
        }

        // Második kérdés csak ha bármely ignore fájl hiányzik

        if (notExist.length > 0) {
          for (const missingFile of notExist) {
            const ignorePath = path.join(tempDir, path.basename(missingFile));
            const content = await fs.readFile(ignorePath, 'utf8');
            if (testCase.answerPrompt2 === 'y') {
              try {
                expect(content).toMatch(/(\.)?([a-zA-Z0-9]+)/);
                console.log('😃 ignore contains elements to be excluded')
              } catch (err) {
                console.log('☹️ the ignore is empty')
                console.log('❗️  ' + err.stack)
                throw err
              }
            } else if (testCase.answerPrompt2 === 'n') {
              try {
                expect(content.trim()).toBe('');
                console.log('😃 the ignore is empty')
              } catch (err) {
                console.log('☹️ ignore contains elements to be excluded')
                console.log('❗️  ' + err.stack)
                throw err
              }
            }
          }
        }
      }
    });
  }
});