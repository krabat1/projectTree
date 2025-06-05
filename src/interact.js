import readline from 'node:readline';
/**
 * @function
 * @name prompt
 * @param {string} promptText 
 * @returns {Promise<string>}
 */
export function prompt(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(promptText, answer => {
      rl.close();
      resolve(answer);
    });
  });
}