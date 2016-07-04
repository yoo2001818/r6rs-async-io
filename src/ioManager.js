import DefaultResolver from './defaultResolver';
import { PAIR, STRING, PROCEDURE, NUMBER, SYMBOL, assert,
  PairValue, NativeProcedureValue, NumberValue, BooleanValue,
  SymbolValue } from 'r6rs';
import desugar from './returnDesugar';

export default class IOManager {
  constructor(machine, resolver = new DefaultResolver(), handler,
    errorHandler
  ) {
    this.machine = machine;
    this.resolver = resolver;
    this.handler = handler;
    this.errorHandler = errorHandler;
    // The incrementing ID to be bound as listener's ID.
    this.listenerId = 0;
    // The listener list - A flat object structure that contains listeners
    // with their ID as key.
    this.listeners = {};
  }
  // Returns the Scheme-side adapter (library) suitable to load with
  // machine.loadLibrary(library);
  getLibrary() {
    return [
      new NativeProcedureValue('io-on', list => {
        let listener = this.listen(list);
        return new NumberValue(listener.id);
      }, ['name', 'options', 'callback']),
      new NativeProcedureValue('io-once', list => {
        let listener = this.once(list);
        return new NumberValue(listener.id);
      }, ['name', 'options', 'callback']),
      new NativeProcedureValue('io-exec', list => {
        let listener = this.once(list);
        return new NumberValue(listener.id);
      }, ['name', 'options', 'callback']),
      new NativeProcedureValue('io-cancel', list => {
        assert(list.car, NUMBER);
        return new BooleanValue(this.cancel(list.car.value));
      }, ['listener'])
    ];
  }
  addListener(listener) {
    this.listeners[listener.id] = listener;
  }
  listen(params) {
    assert(params, PAIR);
    let eventName = params.car;
    let eventOptions = params.cdr && params.cdr.car;
    let callback = params.cdr && params.cdr.cdr && params.cdr.cdr.car;
    if (eventName == null || (eventName.type !== STRING &&
      eventName.type !== SYMBOL
    )) {
      throw new Error('Event name must be string or symbol');
    }
    // eventOptions is processed by resolver itself; we don't have to assert it.
    // We'd have to assert callback's arguments too - but let's don't do that
    // for now.
    if (callback != null) assert(callback, PROCEDURE);
    // Try to resolve the eventName through resolver.
    let directive = this.resolver.resolve(eventName.value);
    if (directive === null) {
      // Missing directive; throw an error.
      throw new Error('Unknown IO directive ' + eventName.value);
    }
    // Just silently ignore it if it returns false.
    if (directive === false) return { id: -1 };
    if (typeof directive !== 'function') {
      throw new Error('Directive must be a function');
    }
    // Create an listener...
    let listenerId = this.listenerId ++;
    let cancel = directive(eventOptions,
      this.handleCallback.bind(this, listenerId), listenerId, this);
    let listener = {
      id: listenerId, cancel, name: eventName.value,
      options: eventOptions, callback
    };
    this.addListener(listener);
    return listener;
  }
  once(params) {
    let listener = this.listen(params);
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
      return this.handler(listener, data);
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
