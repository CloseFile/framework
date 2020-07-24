/**
 * Created by krasilneg on 25.04.17.
 */
let translate;

const init = (options) => {
  translate = options.translate;
};

const strings = (prefix, id, params, language) => {
  if (!translate) {
    return id;
  }
  return translate.getMessage(prefix, id, params, language);
};

const unprefix = (prefix, lang) => (str, params) => strings(prefix, str, params, lang);

module.exports.init = init;
module.exports.s = strings;
module.exports.unprefix = unprefix;
