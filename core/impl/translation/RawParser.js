const TranslationParser = require('../../interfaces/TranslationParser');
const {toAbsolute} = require('core/system');
const path = require('path');
const {
  merge, isConfig, processDir, readConfig
} = require('core/util/read');

const parseLang = lang => typeof lang === 'string' ? (lang.match(/[a-z]+/gi)[0]).toLowerCase() : undefined;

class RawParser extends TranslationParser {

  constructor(options) {
    super();
    this.log = options.log;
    this.systemBase = {};
    this.byLangBase = {};
    this.sources = new Set();
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
    this.sources.add(absDir);
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
      isConfig,
      (fn) => {
        const messages = readConfig(fn);
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

  _getMessage(prefix, id, params, language) {
    let str;
    const lang = parseLang(language);
    if (prefix && id) {
      if (lang && this.byLangBase.hasOwnProperty(lang)) {
        const base = this.byLangBase[lang];
        if (base.hasOwnProperty(prefix)) {
          if (base[prefix].hasOwnProperty(id))
            str = base[prefix][id];
        }
      }
      if (!str && this.systemBase.hasOwnProperty(prefix)) {
        if (this.systemBase[prefix].hasOwnProperty(id))
          str = this.systemBase[prefix][id];
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

module.exports = RawParser;
