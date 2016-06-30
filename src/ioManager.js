import DefaultResolver from './defaultResolver';
import { PAIR, STRING, PROCEDURE, assert, PairValue } from 'r6rs';

export default class IOManager {
  constructor(machine, resolver = new DefaultResolver(), handler) {
    this.machine = machine;
    this.resolver = resolver;
    this.handler = handler;
    // The incrementing ID to be bound as listener's ID.
    this.listenerId = 0;
    // The listener list - A flat object structure that contains listeners
    // with their ID as key.
    this.listeners = {};
  }
  addListener(listener) {
    this.listeners[listener.id] = listener;
  }
  listen(params) {
    assert(params, PAIR);
    let eventName = params.car;
    let eventOptions = params.cdr.car;
    let callback = params.cdr.cdr.car;
    // Only allow string for now.
    assert(eventName, STRING);
    // eventOptions is processed by resolver itself; we don't have to assert it.
    // We'd have to assert callback's arguments too - but let's don't do that
    // for now.
    assert(callback, PROCEDURE);
    // Try to resolve the eventName through resolver.
    let directive = this.resolver.resolve(eventName.value);
    if (directive === null) {
      // Missing directive; throw an error.
      throw new Error('Unknown IO directive ' + eventName.value);
    }
    // Just silently ignore it if it returns false.
    if (directive === false) return -1;
    if (typeof directive !== 'function') {
      throw new Error('Directive must be a function');
    }
    // Create an listener...
    let listenerId = this.listenerId ++;
    let cancel = directive(eventOptions,
      this.handleCallback.bind(this, listenerId), listenerId);
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
    if (listener == null) return;
    // Directive may not support listener cancelling at all
    if (listener.cancel) listener.cancel();
    delete this.listeners[listenerId];
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
  handleCallback(listenerId, data) {
    let listener = this.listeners[listenerId];
    // This can't happen! Still, try to ignore it.
    if (listener == null) return;
    if (this.handler != null) {
      return this.handler(listener, data);
    }
    // Remove the listener if once is true.
    if (listener.once) {
      this.cancel(listener.id);
    }
    // Create AST, then run that through interpreter.
    let pair = new PairValue(listener.callback, data);
    return this.machine.evaluate(pair, true);
  }
}
