import _ from 'lodash';
import Joi from 'joi';
import util from 'util';
import getParams from 'get-parameter-names';
import bunyan from 'bunyan';

const _config = {
  removeFields: ['password', 'token', 'accessToken'],
  debug: true,
  depth: 4,
  maxArrayLength: 30,
  loggerFactory: (serviceName, config) =>
    bunyan.createLogger({ name: serviceName, level: config.debug ? 'debug' : 'error' }),
};

let _seqId = 0;

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
  if (obj === undefined) {
    return obj;
  }
  const seen = [];
  return JSON.parse(JSON.stringify(obj, (name, value) => {
    if (seen.indexOf(value) !== -1) {
      return '[Circular]';
    }
    if (_.isObject(value)) {
      seen.push(value);
    }
    // Array of field names that should not be logged
    // add field if necessary (password, tokens etc)
    if (_.includes(_config.removeFields, name)) {
      return '<removed>';
    }
    if (name === 'req' && value && value.connection) {
      return {
        method: value.method,
        url: value.url,
        headers: value.headers,
        remoteAddress: value.connection.remoteAddress,
        remotePort: value.connection.remotePort,
      };
    }
    if (name === 'res' && value && value.statusCode) {
      return {
        statusCode: value.statusCode,
        header: value._header,
      };
    }
    if (_.isArray(value) && value.length > _config.maxArrayLength) {
      return `Array(${value.length})`;
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
  const ret = {};
  _.each(arr, (arg, i) => {
    ret[params[i]] = arg;
  });
  return ret;
}


function _serializeObject(obj) {
  return util.inspect(_sanitizeObject(obj), { depth: _config.depth });
}

/**
 * Copy decorator properties from the original method to the new method
 * @param method
 * @param newMethod
 * @returns {function}
 * @private
 */
function _keepProps(method, newMethod) {
  const props = ['methodName', 'params', 'removeOutput'];
  _.extend(newMethod, _.pick(method, props));
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
  _.extend(_config, opts);
}

/**
 * Reset counter (needed for tests)
 */
export function resetId() {
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
export function log(method, logger, opts) {
  const decorated = function logDecorator(...args) {
    const methodName = opts.methodName;
    const params = opts.params;
    const removeOutput = opts.removeOutput;
    const logExit = (output, id) => {
      const formattedOutput = removeOutput ? '<removed>' : _serializeObject(output);
      logger.debug({ id }, ` EXIT ${methodName}:`, formattedOutput);
      return output;
    };
    const id = ++_seqId;
    const formattedInput = params.length ? _serializeObject(_combineObject(params, args)) : '{ }';
    logger.debug({ id }, `ENTER ${methodName}:`, formattedInput);
    let result;

    try {
      result = method(...args);
    } catch (e) {
      logger.error(e);
      throw e;
    }
    // promise (or async function)
    if (result && _.isFunction(result.then)) {
      return result.then((asyncResult) => {
        logExit(asyncResult, id);
        return asyncResult;
      }).catch((e) => {
        logger.error({ id }, `ERROR ${methodName}: ${formattedInput} \n`, e);
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
 * @param {Boolean} method.sync the flag if method is sync or async
 * @returns {Function} the decorator
 */
export function validate(method) {
  const decorated = function validateDecorator(...args) {
    const params = method.params;
    const schema = method.schema;
    const value = _combineObject(params, args);
    let normalized;
    try {
      normalized = Joi.attempt(value, schema);
    } catch (e) {
      if (method.sync) {
        throw e;
      }
      return Promise.reject(e);
    }
    const newArgs = [];
    // Joi will normalize values
    // for example string number '1' to 1
    // if schema type is number
    _.each(params, (param) => {
      newArgs.push(normalized[param]);
    });
    return method(...newArgs);
  };
  return _keepProps(method, decorated);
}


/**
 * Decorate all methods in the service
 * @param {Object} service the service object
 * @param {String} serviceName the service name
 */
export default function decorate(service, serviceName) {
  const logger = _config.loggerFactory(serviceName, _config);
  _.map(service, (method, name) => {
    method.methodName = name;
    if (!method.params) {
      method.params = getParams(method);
    }
    service[name] = log(validate(method), logger, method);
  });
}

decorate.configure = configure;
