import Joi from 'joi';
import decorate from '../src/decorator';

async function getUser(id) {
  if (id === 1) {
    return await new Promise((resolve) => {
      setTimeout(() => resolve({ id: 1, username: 'john' }), 100);
    });
  }
  throw new Error('User not found');
}

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


async function run() {
  await UserService.getUser(1); // returns { id: 1, username: 'john' }
  await UserService.getUser(222); // throws 'User not found'
}

run();
