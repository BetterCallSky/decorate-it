import bunyan from 'bunyan';
import Joi from 'joi';
import decorator, { resetId } from '../src/decorator';

describe('decorator', () => {
  let _debug;
  let _error;

  beforeEach(() => {
    resetId();
    _debug = sinon.stub(bunyan.prototype, 'debug');
    _error = sinon.stub(bunyan.prototype, 'error');
  });

  afterEach(() => {
    bunyan.prototype.debug.restore();
    bunyan.prototype.error.restore();
  });

  // sometimes a function can throw or return rejected promise
  async function _invoke(fn) {
    await fn();
  }

  describe('[sync]', () => {
    let _service;
    before(() => {
      function add(a, b) {
        return a + b;
      }

      add.schema = {
        a: Joi.number().required(),
        b: Joi.number().required(),
      };
      _service = { add };
      decorator(_service, 'CalcService');
    });

    it('should add 2 numbers', () => {
      const result = _service.add(1, 2);
      expect(result).to.be.equal(3);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 }, 'ENTER add:', '{ a: 1, b: 2 }');
      _debug.secondCall.should.have.been.calledWith({ id: 1 }, ' EXIT add:', '3');
    });

    it('should add 2 numbers (string format)', () => {
      const result = _service.add('1', '2');
      expect(result).to.be.equal(3);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 }, 'ENTER add:', "{ a: '1', b: '2' }");
      _debug.secondCall.should.have.been.calledWith({ id: 1 }, ' EXIT add:', '3');
    });

    it('should throw a validation error if argument is invalid', () => {
      expect(() => _service.add('1', { foo: 'bar' })).to.throw(/"b" must be a number/);
      _error.should.have.been.calledWith;
    });
  });

  describe('[sync no params]', () => {
    let _service;
    before(() => {
      function getValue() {
        return 1;
      }

      getValue.schema = { };
      _service = { getValue };
      decorator(_service, 'CalcService');
    });

    it('should get value', () => {
      const result = _service.getValue();
      expect(result).to.be.equal(1);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 }, 'ENTER getValue:', '{ }');
      _debug.secondCall.should.have.been.calledWith({ id: 1 }, ' EXIT getValue:', '1');
    });
  });


  describe('[async]', () => {
    let _service;
    let _user;

    before(() => {
      _user = { id: 1, username: 'john' };

      async function getUser(id) {
        if (id === 1) {
          return await new Promise((resolve) => {
            setTimeout(() => resolve(_user), 10);
          });
        }
        throw new Error('User not found');
      }

      getUser.params = ['id'];
      getUser.schema = {
        id: Joi.number().required(),
      };
      _service = { getUser };
      decorator(_service, 'UserService');
    });

    it('should get user', async() => {
      const user = await _service.getUser(1);
      expect(user).to.be.equal(_user);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 }, 'ENTER getUser:', '{ id: 1 }');
      _debug.secondCall.should.have.been.calledWith({ id: 1 }, ' EXIT getUser:', "{ id: 1, username: 'john' }");
    });

    it('should throw a validation error if argument is invalid', async() => {
      expect(_invoke(() => _service.getUser({ foo: 'bar' }))).to.be.rejectedWith(/"id" must be a number/);
      _error.should.have.been.calledWith;
    });

    it('should throw an error if user is not found', async() => {
      expect(_invoke(() => _service.getUser(2))).to.be.rejectedWith(/User not found/);
      _error.should.have.been.calledWith;
    });
  });

  describe('[remove properties]', () => {
    let _service;
    let _hash;
    before(() => {
      _hash = 'ba817ef716';

      function hashPassword(password) { // eslint-disable-line no-unused-vars
        return _hash;
      }

      hashPassword.removeOutput = true;
      hashPassword.schema = {
        password: Joi.string().required(),
      };
      _service = { hashPassword };
      decorator(_service, 'SecurityService');
    });

    it('should remove input and output properties', () => {
      const result = _service.hashPassword('secret');
      expect(result).to.be.equal(_hash);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 }, 'ENTER hashPassword:', "{ password: '<removed>' }");
      _debug.secondCall.should.have.been.calledWith({ id: 1 }, ' EXIT hashPassword:', '<removed>');
    });
  });


  describe('[special properties]', () => {
    let _service;
    before(() => {
      function foo(req, res, obj, array) { // eslint-disable-line no-unused-vars
        return true;
      }

      foo.schema = {
        req: Joi.object(),
        res: Joi.object(),
        obj: Joi.object(),
        array: Joi.array().sparse(),
      };
      _service = { foo };
      decorator(_service, 'BarService');
    });

    it('should map req', () => {
      const req = {
        method: 'GET',
        url: '/users',
        headers: {
          h1: '1',
          h2: '2',
        },
        connection: {
          remoteAddress: '::1',
          remotePort: 3000,
          dummy: 123,
        },
        dummy: 123,
      };
      _service.foo(req, undefined, undefined, undefined);
      _debug.should.have.been.calledTwice;
      const log = `{ req: 
   { method: 'GET',
     url: '/users',
     headers: { h1: '1', h2: '2' },
     remoteAddress: '::1',
     remotePort: 3000 } }`;
      _debug.firstCall.should.have.been.calledWith({ id: 1 }, 'ENTER foo:', log);
    });

    it('should map res', () => {
      const res = {
        statusCode: 500,
        _header: '123',
        dummy: 123,
      };
      _service.foo(undefined, res, undefined, undefined);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 },
        'ENTER foo:', "{ res: { statusCode: 500, header: '123' } }");
    });

    it('should map a deep obj', () => {
      const obj = {
        a: { b: { c: { d: { e: 1 } } } },
      };
      _service.foo(undefined, undefined, obj, undefined);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 },
        'ENTER foo:', '{ obj: { a: { b: { c: { d: [Object] } } } } }');
    });

    it('should map a circular obj', () => {
      const obj = { a: 1 };
      obj.sub = obj;
      _service.foo(undefined, undefined, obj, undefined);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 },
        'ENTER foo:', "{ obj: { a: 1, sub: '[Circular]' } }");
    });

    it('should map a big array', () => {
      const array = new Array(100);
      _service.foo(undefined, undefined, undefined, array);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 },
        'ENTER foo:', "{ array: 'Array(100)' }");
    });
  });

  describe('[custom config]', () => {
    let _service;
    let _hash;
    before(() => {
      _hash = 'ba817ef716';

      function hashPassword(password) { // eslint-disable-line no-unused-vars
        return _hash;
      }

      hashPassword.removeOutput = true;
      hashPassword.schema = {
        password: Joi.string().required(),
      };
      _service = { hashPassword };
      decorator(_service, 'SecurityService');
    });

    it('should change config values', () => {
      decorator.configure({
        removeFields: ['a', 'b'],
        debug: false,
        depth: 1,
        maxArrayLength: 10,
      });

      function add(a, b) {
        return a + b;
      }

      add.schema = {
        a: Joi.number().required(),
        b: Joi.number().required(),
      };
      _service = { add };
      decorator(_service, 'CalcService');
      _service.add(1, 2);
      _debug.should.have.been.calledTwice;
      _debug.firstCall.should.have.been.calledWith({ id: 1 }, 'ENTER add:', "{ a: '<removed>', b: '<removed>' }");
      _debug.secondCall.should.have.been.calledWith({ id: 1 }, ' EXIT add:', '3');
    });
  });
});
