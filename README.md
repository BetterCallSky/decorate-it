# decorate-it
[![Build Status](https://travis-ci.org/lsentkiewicz/decorate-it.svg?branch=master)](https://travis-ci.org/lsentkiewicz/decorate-it)
[![codecov](https://codecov.io/gh/lsentkiewicz/decorate-it/branch/master/graph/badge.svg)](https://codecov.io/gh/lsentkiewicz/decorate-it)

Decorate-it is a simple library for validation and logging.  
It depends on [joi](https://github.com/hapijs/joi) (validator) and [bunyan](https://github.com/trentm/node-bunyan) (logger)

## Installation

```
npm i --save decorate-it
```


## Sample usage
file `services/CalcService.js`
```js
import Joi from 'joi';
import decorate from 'decorate-it';

function add(a, b) {
  return a + b;
}

add.sync = true;
add.schema = {
  a: Joi.number().required(),
  b: Joi.number().required(),
};


// create your service
const CalcService = {
  add,
};

// decorate it, it will mutate CalcService
decorate(CalcService, 'CalcService');

export default CalcService;

```

use service
```js
import CalcService from './services/CalcService';


CalcService.add(1, 3); // returns 4
CalcService.add('5', '6'); // returns 11, input parameters are converted to number types
CalcService.add('1', { foo: 'bar' }); // logs and throws an error
```

![Alt text](https://monosnap.com/file/7fZER5fIdYfMmWQ4uiPe8iZSXEdfrG.png)

See example under `example/example1.js`. Run it using `npm run example1`.


## Async sample usage
file `services/UserService.js`
```js
import Joi from 'joi';
import decorate from 'decorate-it';

async function getUser(id) {
  if (id === 1) {
    return await new Promise((resolve) => {
      setTimeout(() => resolve({ id: 1, username: 'john' }), 100);
    });
  }
  throw new Error('User not found');
}
getUser.sync = false; // optional, false by default
getUser.params = ['id'];
getUser.schema = {
  id: Joi.number().required(),
};


// create your service
const UserService = {
  getUser,
};

// decorate it, it will mutate UserService
decorate(UserService, 'UserService');

export default UserService;

```

use service
```js
import UserService from './services/UserService';


await UserService.getUser(1); // returns { id: 1, username: 'john' }
await UserService.getUser(222); // throws 'User not found'
```

![Alt text](https://monosnap.com/file/Kk2wCus4TYBWES4KBCQWElwu6OpuES.png)

See example under `example/example2.js`. Run it using `npm run example2`.  
**NOTE** parameter names cannot be automatically retrieved from `async` methods.  
You must define them explicitly in `params` property like this `getUser.params = ['id'];`


## Removing security information
By default properties `password`, `token`, `accessToken` are removed from logging.  
Additionally you can define `removeOutput = true` to remove the method result.  
Example:

file `services/SecurityService.js`
```js
import Joi from 'joi';
import decorate from 'decorate-it';

function hashPassword(password) {
  return 'ba817ef716'; // hash password here
}

hashPassword.removeOutput = true;
hashPassword.schema = {
  password: Joi.string().required(),
};


// create your service
const SecurityService = {
  hashPassword,
};

// decorate it, it will mutate SecurityService
decorate(SecurityService, 'SecurityService');

export default SecurityService;

```

use service
```js
import SecurityService from './services/SecurityService';

SecurityService.hashPassword('secret-password');
```

![Alt text](https://monosnap.com/file/QuUXmIPKJ4GLNI1NvoAN8T2ClLnMv3.png)

See example under `example/example3.js`. Run it using `npm run example3`.


## Configuration
```
import decorate from 'decorate-it';

decorate.configure({
  removeFields: Array<String>, // the array of fields not won't be logged to the console, default: ['password', 'token', 'accessToken'],
  debug: true/false,           // the flag is parameter/ouput logging is enabled, (errors are always enabled), default: true
  depth: number,               // the object depth level when serializing, default: 4           
  maxArrayLength: number,      // the maximum number of elements to include when formatting an array, default: 30  
})
```

You must configure it, before creating any service.

## Special properties
if the parameter name is `req` it's assumed that the object is an express request.  
Only properties are logged: `method`, `url`, `headers`, `remoteAddress`, `remotePort`.  


if the parameter name is `res` it's assumed that the object is an express response.  
Only properties are logged: `statusCode`, `header`.  



MIT License

Copyright (c) 2016 Łukasz Sentkiewicz