'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

exports.resetId = resetId;
exports.log = log;
exports.validate = validate;
exports.default = decorate;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _getParameterNames = require('get-parameter-names');

var _getParameterNames2 = _interopRequireDefault(_getParameterNames);

var _bunyan = require('bunyan');

var _bunyan2 = _interopRequireDefault(_bunyan);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _config = {
  removeFields: ['password', 'token', 'accessToken'],
  debug: true,
  depth: 4,
  maxArrayLength: 30
};

var _seqId = 0;

// ------------------------------------
// Private
// ------------------------------------

/**
 * Remove invalid properties from the object and hide long arrays
 * @param {Object} obj the object
 * @returns {Object} the new object with removed properties
 * @private
 */
function _sanitizeObject(obj) {
  var seen = [];
  return JSON.parse((0, _stringify2.default)(obj, function (name, value) {
    if (seen.indexOf(value) !== -1) {
      return '[Circular]';
    }
    if (_lodash2.default.isObject(value)) {
      seen.push(value);
    }
    // Array of field names that should not be logged
    // add field if necessary (password, tokens etc)
    if (_lodash2.default.includes(_config.removeFields, name)) {
      return '<removed>';
    }
    if (name === 'req' && value && value.connection) {
      return {
        method: value.method,
        url: value.url,
        headers: value.headers,
        remoteAddress: value.connection.remoteAddress,
        remotePort: value.connection.remotePort
      };
    }
    if (name === 'res' && value && value.statusCode) {
      return {
        statusCode: value.statusCode,
        header: value._header
      };
    }
    if (_lodash2.default.isArray(value) && value.length > _config.maxArrayLength) {
      return 'Array(' + value.length + ')';
    }
    return value;
  }));
}

/**
 * Convert array with arguments to object
 * @param {Array} params the name of parameters
 * @param {Array} arr the array with values
 * @private
 */
function _combineObject(params, arr) {
  var ret = {};
  _lodash2.default.each(arr, function (arg, i) {
    ret[params[i]] = arg;
  });
  return ret;
}

function _serializeObject(obj) {
  return _util2.default.inspect(_sanitizeObject(obj), { depth: _config.depth });
}

/**
 * Copy decorator properties from the original method to the new method
 * @param method
 * @param newMethod
 * @returns {function}
 * @private
 */
function _keepProps(method, newMethod) {
  var props = ['methodName', 'params', 'removeOutput'];
  _lodash2.default.extend(newMethod, _lodash2.default.pick(method, props));
  return newMethod;
}

// ------------------------------------
// Exports
// ------------------------------------

/**
 * Set global configuration for decorators
 * @param opts
 * @param {Array<String>} opts.removeFields the array of fields not won't be logged to the console
 * @param {Boolean} opts.debug the flag is debug information are enabled
 * @param {Number} opts.depth the object depth level when serializing
 * @param {Number} opts.maxArrayLength the maximum number of elements to include when formatting
 */
function configure(opts) {
  _lodash2.default.extend(_config, opts);
}

/**
 * Reset counter (needed for tests)
 */
function resetId() {
  _seqId = 0;
}

/**
 * Decorator for logging input and output arguments (debug mode)
 * and logging errors
 * @param {Function} method the method to decorate
 * @param {Function} logger the instance of the debug logger
 * @param {Object} opts the options
 * @param {Array} method.params the method parameters
 * @param {Boolean} opts.removeOutput true if don't log output (e.g. sensitive data)
 * @param {String} opts.methodName the method name
 * @returns {Function} the decorator
 */
function log(method, logger, opts) {
  var decorated = function logDecorator() {
    var methodName = opts.methodName;
    var params = opts.params;
    var removeOutput = opts.removeOutput;
    var logExit = function logExit(output, id) {
      var formattedOutput = removeOutput ? '<removed>' : _serializeObject(output);
      logger.debug({ id: id }, ' EXIT ' + methodName + ':', formattedOutput);
      return output;
    };
    var id = ++_seqId;

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var formattedInput = params.length ? _serializeObject(_combineObject(params, args)) : '{ }';
    logger.debug({ id: id }, 'ENTER ' + methodName + ':', formattedInput);
    var result = void 0;

    try {
      result = method.apply(undefined, args);
    } catch (e) {
      logger.error(e);
      throw e;
    }
    // promise (or async function)
    if (result && _lodash2.default.isFunction(result.then)) {
      return result.then(function (asyncResult) {
        logExit(asyncResult, id);
        return asyncResult;
      }).catch(function (e) {
        logger.error({ id: id }, 'ERROR ' + methodName + ': ' + formattedInput + ' \n', e);
        throw e;
      });
    }
    logExit(result, id);
    return result;
  };
  return _keepProps(method, decorated);
}

/**
 * Decorator for validating with Joi
 * @param {Function} method the method to decorate
 * @param {Array} method.params the method parameters
 * @param {Object} method.schema the joi schema
 * @returns {Function} the decorator
 */
function validate(method) {
  var decorated = function validateDecorator() {
    var params = method.params;
    var schema = method.schema;

    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    var value = _combineObject(params, args);
    var normalized = _joi2.default.attempt(value, schema);
    var newArgs = [];
    // Joi will normalize values
    // for example string number '1' to 1
    // if schema type is number
    _lodash2.default.each(params, function (param) {
      newArgs.push(normalized[param]);
    });
    return method.apply(undefined, newArgs);
  };
  return _keepProps(method, decorated);
}

/**
 * Decorate all methods in the service
 * @param {Object} service the service object
 * @param {String} serviceName the service name
 */
function decorate(service, serviceName) {
  var logger = _bunyan2.default.createLogger({ name: serviceName, level: _config.debug ? 'debug' : 'error' });
  _lodash2.default.map(service, function (method, name) {
    method.methodName = name;
    if (!method.params) {
      method.params = (0, _getParameterNames2.default)(method);
    }
    service[name] = log(validate(method), logger, method);
  });
}

decorate.configure = configure;