mespeak 2.0.2 (npm), a CommonJS wrapper over Norbert Landsteiner's meSpeak (speak.js, eSpeak). Licence: GNU GPL (eSpeak and the other code
here are under the GNU GPL, see the header of index.js). Changes here: the two files were turned into ES modules (`export default`, `import`)
and ESpeak.js was re-encoded from Latin-1 to UTF-8 (same character codes) so the bundler can read it. Voice data comes from the `mespeak`
npm package (src/mespeak_config.json and voices/en/en-us.json).
