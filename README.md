# r6rs-async-io
Asynchronous IO interface for r6rs.js

# Usage
Usage is pretty straightforward.

```js
import fs from 'fs';

import IOManager from 'r6rs-async-io';
import { Machine, assert } from 'r6rs';

let machine = new Machine();
let ioManager = new IOManager(machine);
ioManager.resolver.add('fs-read', (params, callback) => {
  assert(params, 'string');
  fs.readFile(params.value, 'utf8', (err, data) => {
    if (err) {
      callback([err.message, null], true);
    } else {
      callback([null, data], true);
    }
  });
});
ioManager.resolver.add('setInterval', (params, callback) => {
  assert(params, 'number');
  let timerId = setInterval(callback, params.value);
  return () => {
    clearInterval(timerId);
  };
});

machine.loadLibrary(ioManager.getLibrary());

machine.evaluate(`
(io-exec "fs-read" "java.md" (lambda (err data)
  (if (null? err)
    (display data)
    (display err)
  )
))
(io-listen "setInterval" 1000 (lambda ()
  (display "Hello!")
))
`);
```

## Usage in Scheme

- (io-exec name options callback) -> listener
- (io-once name options callback) -> listener
- (io-listen name options callback) -> listener
- (io-cancel listener) -> null
