import Joi from 'joi';
import decorate from '../src/decorator';

function hashPassword(password) { // eslint-disable-line no-unused-vars
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


SecurityService.hashPassword('secret-password');
