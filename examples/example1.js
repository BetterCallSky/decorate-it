import Joi from 'joi';
import decorate from '../src/decorator';

function add(a, b) {
  return a + b;
}

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


CalcService.add(1, 3); // returns 4
CalcService.add('5', '6'); // returns 11, input parameters are converted to number types
CalcService.add('1', { foo: 'bar' }); // logs and throws an error
