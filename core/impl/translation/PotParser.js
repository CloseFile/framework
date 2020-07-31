const TranslationParser = require('../../interfaces/TranslationParser');
const {toAbsolute} = require('core/system');
const path = require('path');
const fs = require('fs');
const {
  merge, processDir
} = require('core/util/read');
const { parsePo } = require('gettext-to-messageformat');
const MessageFormat = require('messageformat');

const parsingOptions = {
  pluralVariablePattern: /%(\w+)/,
  replacements: [
    {
      pattern: /[\\{}#]/g,
      replacement: '\\$&'
    },
    {
      pattern: /%(\d+)(?:\$\w)?/g,
      replacement: (_, n) => `{${n - 1}}`
    },
    {
      pattern: /%\((\w+)\)\w/g,
      replacement: '{$1}'
    },
    {
      pattern: /%(\w+)/g,
      replacement: '{$1}'
    },
    {
      pattern: /%\w/g,
      replacement: function () { return `{${this.n++}}` },
      state: { n: 0 }
    },
    {
      pattern: /%%/g,
      replacement: '%'
    }
  ]
};

function parsePoFile(fn) {
  const fileContents = fs.readFileSync(fn, {encoding: 'utf8'});
  const { headers, pluralFunction, translations } = parsePo(fileContents, parsingOptions);
  const mf = new MessageFormat({ [headers.language]: pluralFunction });
  console.log(translations);
  const messages = mf.compile(translations);
  return messages;
}

class PotParser extends TranslationParser {

  constructor(options) {
    super();
    this.log = options.log;
    this.systemBase = {};
    this.byLangBase = {};
  }

  _registerBase(prefix, base, lang) {
    if (prefix && base) {
      this.systemBase[prefix] = merge(base, this.systemBase[prefix] || {});
      if (lang) {
        this.byLangBase[lang] = this.byLangBase[lang] || {};
        this.byLangBase[lang][prefix] = merge(base, this.byLangBase[lang][prefix] || {});
      }
    }
  }

  _setup(lang, dir, prefix) {
    if (!lang || !dir)
      return;

    prefix = prefix || 'i18n';
    const absDir = toAbsolute(dir);
    const msgDir = path.join(absDir, lang);
    if (!msgDir.startsWith(absDir)) {
      this.log.warn(`incorrect language "${lang}"`);
      return;
    }
    let base;
    try {
      base = require(msgDir);
    } catch (err) {
      // Do nothing
    }
    base = base || {};
    processDir(msgDir,
      fn => ['.po'].includes(path.extname(fn)),
      (fn) => {
        const messages = parsePoFile(fn);
        base = merge(base, messages);
      },
      (err) => {
        if (err.code === 'ENOENT')
          this.log.info(`Base for language "${lang}" does not exist in path "${dir}"`);
        else
          throw err;
      },
      false);

    this._registerBase(prefix, base, lang);
    this.log.info(`i18n settings for language "${lang}" registered from path "${dir}"`);
  }

  _getMessage(prefix, id, params, lang) {
    let str;
    if (prefix && id) {
      if (lang && this.byLangBase.hasOwnProperty(lang)) {
        const base = this.byLangBase[lang];
        if (base.hasOwnProperty(prefix)) {
          if (base[prefix].hasOwnProperty(id))
            str = base[prefix][id](params);
        }
      }
      if (!str && this.systemBase.hasOwnProperty(prefix)) {
        if (this.systemBase[prefix].hasOwnProperty(id))
          str = this.systemBase[prefix][id](params);
      }
      str = str || id;
      params && Object.keys(params).forEach((p) => {
        str = str.replace(`%${p}`, params[p]);
      });
      return str;
    }
    return '';
  }

}

module.exports = PotParser;
