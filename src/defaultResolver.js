import Library from './library';

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
    return this.directives[keyword];
  }
}
