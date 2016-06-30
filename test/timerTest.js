// Simple test of setInterval implementation.
import IOManager from '../src/ioManager';
import { Machine, assert } from 'r6rs';

let machine = new Machine();
let ioManager = new IOManager(machine);
ioManager.resolver.add('setInterval', (params, callback) => {
  assert(params, 'number');
  let timerId = setInterval(callback, params.value);
  return () => {
    clearInterval(timerId);
  };
});
machine.loadLibrary(ioManager.getLibrary());

machine.evaluate(`
(let ((x 0) (y 0))
  (set! y (io-on "setInterval" 1000 (lambda ()
    (set! x (+ x 1))
    (display x)
    (if (>= x 10) (io-cancel y))
  )))
)
`);
