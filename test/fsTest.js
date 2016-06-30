// Simple test of fs read.
import fs from 'fs';

import IOManager from '../src/ioManager';
import { Machine, assert, PairValue, StringValue, SymbolValue } from 'r6rs';

let machine = new Machine();
let ioManager = new IOManager(machine);
ioManager.resolver.add('fs-read', (params, callback) => {
  assert(params, 'string');
  fs.readFile(params.value, 'utf8', (err, data) => {
    if (err) {
      callback(new PairValue(
        new StringValue(err.message),
        new PairValue(new SymbolValue('quote'),
          new PairValue(new PairValue())
        )
      ), true);
    } else {
      callback(new PairValue(
        new PairValue(new SymbolValue('quote'),
          new PairValue(new PairValue())),
        new PairValue(new StringValue(data))
      ), true);
    }
  });
});
machine.loadLibrary(ioManager.getLibrary());

machine.evaluate(`
(io-exec "fs-read" "java.md" (lambda (err data)
  (if (null? err)
    (display data)
    (display err)
  )
))
`);
