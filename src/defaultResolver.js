import Library from './library';
import { SYMBOL, STRING } from 'r6rs';

export default class DefaultResolver {
  constructor(directives = {}) {
    // An object containing IO directives (actions).
    this.directives = directives;
  }
  addLibrary(directives) {
    if (directives instanceof Library) {
      this.addLibrary(directives.data);
      return;
    }
    for (let key in directives) {
      this.directives[key] = directives[key];
    }
  }
  add(name, directive) {
    this.directives[name] = directive;
  }
  resolve(keyword) {
    if (keyword == null || (keyword.type !== STRING &&
      keyword.type !== SYMBOL
    )) {
      throw new Error('Event name must be string or symbol');
    }
    return this.directives[keyword.value];
  }
}
