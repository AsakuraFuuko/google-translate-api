var querystring = require('querystring');

var got = require('got');
var token = require('@vitalets/google-translate-token');

var languages = require('./languages');

function translate(text, opts) {
    opts = opts || {};

    var e;
    [opts.from, opts.to].forEach(function (lang) {
        if (lang && !languages.isSupported(lang)) {
            e = new Error();
            e.code = 400;
            e.message = 'The language \'' + lang + '\' is not supported';
        }
    });
    if (e) {
        return new Promise(function (resolve, reject) {
            reject(e);
        });
    }

    opts.from = opts.from || 'auto';
    opts.to = opts.to || 'en';
    opts.tld = opts.tld || 'com';

    opts.from = languages.getCode(opts.from);
    opts.to = languages.getCode(opts.to);

    return token.get(text, {tld: opts.tld}).then(function (token) {
        var url = 'https://translate.google.' + opts.tld + '/translate_a/single';
        var data = {
            client: opts.client || 't',
            sl: opts.from,
            tl: opts.to,
            hl: opts.to,
            dt: ['at', 'bd', 'ex', 'ld', 'md', 'qca', 'rw', 'rm', 'ss', 't'],
            ie: 'UTF-8',
            oe: 'UTF-8',
            otf: 1,
            ssel: 0,
            tsel: 0,
            kc: 7,
            q: text
        };
        data[token.name] = token.value;

        return url + '?' + querystring.stringify(data);
    }).then(function (url) {
        return got(url).then(function (res) {
            var result = {
                to: {
                    means: [],
                    text: '',
                    translit: ''
                },
                from: {
                    language: {
                        didYouMean: false,
                        iso: ''
                    },
                    text: {
                        autoCorrected: false,
                        value: '',
                        didYouMean: false
                    },
                    orig: '',
                    translit: ''
                },
                raw: ''
            };

            if (opts.raw) {
                result.raw = res.body;
            }

            var body = JSON.parse(res.body);
            body[0].forEach(function (obj) {
                if (obj[0]) {
                    result.to.text += obj[0];
                }
                if (obj[2]) {
                    result.to.translit += obj[2];
                }
            });

            body[0].forEach(function (obj) {
                if (obj[1]) {
                    result.from.orig += obj[1];
                }
                if (obj[3]) {
                    result.from.translit += obj[3];
                }
            });

            if (body[1]) {
                body[1].forEach(function (obj) {
                    var type = obj[0];
                    var arr = obj[1];
                    result.to.means.push({
                        type: type,
                        means: arr
                    })
                })
            }

            if (body[2] === body[8][0][0]) {
                result.from.language.iso = body[2];
            } else {
                result.from.language.didYouMean = true;
                result.from.language.iso = body[8][0][0];
            }

            if (body[7] && body[7][0]) {
                var str = body[7][0];

                str = str.replace(/<b><i>/g, '[');
                str = str.replace(/<\/i><\/b>/g, ']');

                result.from.text.value = str;

                if (body[7][5] === true) {
                    result.from.text.autoCorrected = true;
                } else {
                    result.from.text.didYouMean = true;
                }
            }

            return result;
        }).catch(function (err) {
            err.message += `\nUrl: ${url}`;
            if (err.statusCode !== undefined && err.statusCode !== 200) {
                err.code = 'BAD_REQUEST';
            } else {
                err.code = 'BAD_NETWORK';
            }
            throw err;
        });
    });
}

module.exports = translate;
module.exports.languages = languages;
