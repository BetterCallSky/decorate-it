import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

global.chai = chai;
global.expect = chai.expect;
global.sinon = sinon;
global.should = chai.should();
