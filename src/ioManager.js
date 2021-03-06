import DefaultResolver from './defaultResolver';
import { PAIR, PROCEDURE, SYMBOL, assert,
  PairValue, NativeProcedureValue, BooleanValue,
  SymbolValue } from 'r6rs';
import desugar from './returnDesugar';

export default class IOManager {
  constructor(machine, resolver = new DefaultResolver(), handler,
    errorHandler, idHandler
  ) {
    this.machine = machine;
    this.resolver = resolver;
    this.handler = handler;
    this.errorHandler = errorHandler;
    this.idHandler = idHandler;
    // The incrementing ID to be bound as listener's ID.
    this.listenerId = 0;
    // The listener list - A flat object structure that contains listeners
    // with their ID as key.
    this.listeners = {};
  }
  // Returns the Scheme-side adapter (library) suitable to load with
  // machine.loadLibrary(library);
  // However, since the machine supports library caching, it's not possible to
  // use scopes to reference IOManager anymore - injecting asyncIO value into
  // machine works.
  getLibrary(machine = this.machine) {
    machine.asyncIO = this;
    return [
      new NativeProcedureValue('io-on', (list, machine, frame) => {
        let listener = machine.asyncIO.listen(list, frame);
        return new SymbolValue(listener.id);
      }, ['name', 'options', 'callback'], undefined, 'async-io'),
      new NativeProcedureValue('io-once', (list, machine, frame) => {
        let listener = machine.asyncIO.once(list, frame);
        return new SymbolValue(listener.id);
      }, ['name', 'options', 'callback'], undefined, 'async-io'),
      new NativeProcedureValue('io-exec', (list, machine, frame) => {
        let listener = machine.asyncIO.once(list, frame);
        return new SymbolValue(listener.id);
      }, ['name', 'options', 'callback'], undefined, 'async-io'),
      new NativeProcedureValue('io-cancel', (list, machine) => {
        assert(list.car, SYMBOL);
        return new BooleanValue(machine.asyncIO.cancel(list.car.value));
      }, ['listener'], undefined, 'async-io')
    ];
  }
  addListener(listener) {
    this.listeners[listener.id] = listener;
  }
  listen(params, frame) {
    assert(params, PAIR);
    let eventName = params.car;
    let eventOptions = params.cdr && params.cdr.car;
    let callback = params.cdr && params.cdr.cdr && params.cdr.cdr.car;
    // eventOptions is processed by resolver itself; we don't have to assert it.
    // We'd have to assert callback's arguments too - but let's don't do that
    // for now.
    if (callback != null) assert(callback, PROCEDURE);
    // Try to resolve the eventName through resolver.
    let directive = this.resolver.resolve(eventName);
    if (directive === null) {
      // Missing directive; throw an error.
      throw new Error('Unknown IO directive ' + eventName.inspect());
    }
    // Just silently ignore it if it returns false.
    if (directive === false) return { id: -1 };
    if (typeof directive !== 'function') {
      throw new Error('Directive must be a function');
    }
    // Create an listener...
    let listener = {
      name: eventName.value,
      options: eventOptions, callback
    };
    let listenerId;
    if (this.idHandler) {
      listenerId = this.idHandler(frame, listener, params, eventName, callback);
    } else {
      listenerId = this.listenerId ++;
    }
    let cancel = directive(eventOptions,
      this.handleCallback.bind(this, listenerId), listenerId, this);
    listener.id = listenerId;
    listener.cancel = cancel;
    this.addListener(listener);
    return listener;
  }
  once(params, frame) {
    let listener = this.listen(params, frame);
    listener.once = true;
    return listener;
  }
  cancel(listenerId) {
    let listener = this.listeners[listenerId];
    if (listener == null) return false;
    // Directive may not support listener cancelling at all
    if (listener.cancel) listener.cancel();
    delete this.listeners[listenerId];
    return true;
  }
  // This is called when interpreter itself is being removed, etc..
  cancelAll() {
    for (let listenerId in this.listeners) {
      let listener = this.listeners[listenerId];
      if (listener == null) return;
      // Directive may not support listener cancelling at all
      if (listener.cancel) listener.cancel();
    }
    this.listeners = {};
  }
  handleCallback(listenerId, data, remove) {
    let listener = this.listeners[listenerId];
    // This can't happen! Still, try to ignore it.
    if (listener == null) return;
    if (this.handler != null) {
      return this.handler(listener, data, remove);
    }
    // Remove the listener if once is true, or remove is true.
    // Remove indicates that the listener won't call the callback again.
    if (listener.once || remove === true) {
      this.cancel(listener.id);
    }
    // Create AST, then run that through interpreter.
    // TODO: If an error happens inside this evaluation, Node process will be
    // turned off!!! This try-catch provides a way to process the error.
    let dataVal = desugar(data);
    if (dataVal) {
      dataVal = dataVal.map(v => new PairValue(new SymbolValue('quote'),
        new PairValue(v)));
    }
    if (listener.callback == null) return;
    let pair = new PairValue(listener.callback, dataVal);
    try {
      return this.machine.evaluate(pair, true);
    } catch (e) {
      if (typeof this.errorHandler === 'function') {
        return this.errorHandler(e);
      }
      // We're out of luck - user didn't specify error handler. Just give up...
      throw e;
    }
  }
}
