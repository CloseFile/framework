const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const {mergeWith} = require('lodash');
const {promisify} = require('util');
const readdirPromise = promisify(fs.readdir);
const lstatPromise = promisify(fs.lstat);
const readFilePromise = promisify(fs.readFile);
const writeFilePromise = promisify(fs.writeFile);
const mkdirp = require('mkdirp');

const potTemplateStr = `#
# IONDV Framework.
<% Object.keys(tokens).forEach((token) => { %>
<% tokens[token].forEach((line) => { %>
#: <%=line%><% }) %>
msgid "<%=token%>"
msgstr ""<% }) %>
`;
const potTemplate = ejs.compile(potTemplateStr, {});

function lineNumbersByIndex(index, allLines){
    let lineNumber = 0;
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].index > index) {
        break;
      }
      lineNumber++;
    }
    return lineNumber;
}

function mergeTokens(left, right) {
  return mergeWith(left, right, (objValue, srcValue) => {
    if (Array.isArray(objValue)) {
      return objValue.concat(srcValue);
    }
  })
}

async function extractTokens(str, filePath) {
  const tokens = {};
  const tokenRegex = /__\('([^']*)'|__\("([^"]*)"|__\(`([^`]*)`/gi;
  const newLineRegex = /(^)[\S\s]/gm;

  const tokenMatch = Array.from(str.matchAll(tokenRegex));
  const allLines = Array.from(str.matchAll(newLineRegex));

  tokenMatch.forEach((part) => {
    const token = part[1];
    const lineNumber = lineNumbersByIndex(part.index, allLines);
    const line = `${path.relative(path.resolve(__dirname, '..'), filePath)}:${lineNumber}`;
    if (Array.isArray(tokens[token])) {
      tokens[token].push(line);
    } else {
      tokens[token] = [line];
    }
  });
  return tokens;
}

async function walk(dirPath, excludeDirs) {
  let tokens = {};
  const files = await opendir(dirPath, excludeDirs);
  for (let i = 0; i < files.length; i++) {
    if (files[i].isDir) {
      const subDirTokens = await walk(files[i].path, excludeDirs);
      tokens = mergeTokens(tokens, subDirTokens);
    } else {
      const fileContents = await readFilePromise(files[i].path, 'utf8');
      const fileTokens = await extractTokens(fileContents, files[i].path);
      tokens = mergeTokens(tokens, fileTokens);
    }
  }
  return tokens;
}

async function writePotFile(potFilePath, description, tokens) {
  let contents = potTemplate({tokens});
  await writeFilePromise(potFilePath, contents);
  return potFilePath;
}

async function opendir(dirPath, excludeDirs) {
  const files = await readdirPromise(dirPath);
  const results = [];
  for (let i = 0; i < files.length; i++) {
    if (files[i][0] !== '.' && !excludeDirs.includes(files[i])) {
      const filePath = path.resolve(dirPath, files[i]);
      const stat = await lstatPromise(filePath);
      results.push({name: files[i], path: filePath, isDir: stat.isDirectory()});
    }
  }
  return results;
}

async function run() {
  // core
  const frameworkTokens = await walk(path.resolve(__dirname, '..'), ['node_modules', 'i18n', 'modules', 'applications']);
  const fPotFileDir = path.resolve(__dirname, '..', 'i18n');
  await mkdirp(fPotFileDir);
  await writePotFile(path.resolve(fPotFileDir, 'framework.pot'), {}, frameworkTokens);
  // modules
  const modules = await opendir(path.resolve(__dirname, '..', 'modules'), ['node_modules', 'i18n']);
  for (let i = 0; i < modules.length; i++) {
    if (modules[i].isDir) {
      const moduleTokens = await walk(modules[i].path, ['node_modules', 'i18n']);
      const mPotFileDir = path.resolve(modules[i].path, 'i18n');
      await mkdirp(mPotFileDir);
      await writePotFile(path.resolve(mPotFileDir, `${modules[i].name}.pot`), {}, moduleTokens);
    }
  }
  // applications
  const apps = await opendir(path.resolve(__dirname, '..', 'applications'), ['node_modules', 'i18n']);
  for (let i = 0; i < apps.length; i++) {
    if (apps[i].isDir) {
      const appTokens = await walk(apps[i].path, ['node_modules', 'i18n']);
      const aPotFileDir = path.resolve(apps[i].path, 'i18n');
      await mkdirp(aPotFileDir);
      await writePotFile(path.resolve(aPotFileDir, `${apps[i].name}.pot`), {}, appTokens);
    }
  }
  // finish
  console.log('done!');
}

run()
