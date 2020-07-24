class TranslationParser {
  
  setup(lang, dir, prefix) {
    return this._setup(lang, dir, prefix);
  }

  getMessage(prefix, id, params, language) {
    return this._getMessage(prefix, id, params, language);
  }

}

module.exports = TranslationParser;
