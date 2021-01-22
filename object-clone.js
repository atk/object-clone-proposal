if (!Symbol.clone) {
  Symbol.clone = Symbol.for("Symbol.clone");
  Date.prototype[Symbol.clone] = function* () {
    yield new Date(this.valueOf());
  };
  Set.prototype[Symbol.clone] = function* (clone) {
    const ref = new Set();
    yield ref;
    this.forEach((value) => ref.add(clone(value)));
  };
  Map.prototype[Symbol.clone] = function* (clone) {
    const ref = new Map();
    yield ref;
    this.forEach((value, key) => ref.set(key, clone(value)));
  };
  [
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    BigInt64Array,
    BigUint64Array,
  ].forEach((constructor) => {
    constructor.prototype[Symbol.clone] = function* (clone) {
      const ref = new this.constructor(this.length);
      yield ref;
      ref.set(this.map((value) => clone(value)));
    };
  });
  RegExp.prototype[Symbol.clone] = function* () {
    yield new RegExp(this);
  };
  Array.prototype[Symbol.clone] = function* (clone) {
    const ref = new this.constructor(this.length);
    yield ref;
    this.forEach((value, index) => {
      ref[index] = clone(value);
    });
  };
  Object.prototype[Symbol.clone] = function* (clone) {
    const ref = new this.constructor();
    yield ref;
    Object.entries(this).forEach(([key, value]) => {
      ref[key] = clone(value);
    });
  };
}
if (typeof Object.clone !== "function") {
  const unclonable = /^\[object (?:Undefined|Null|Boolean|Number|BigInt|String|Symbol|Module|Weak(?:Set|Map)|(?:Shared)?ArrayBuffer|DataView)\]$/;
  const clone = (obj, map, methodMap) => {
    if (unclonable.test(Object.prototype.toString.call(obj))) return obj;
    if (map.has(obj)) return map.get(obj);
    const cloneMethod =
      methodMap.get(obj.constructor) ??
      (Object.hasOwnProperty.call(obj, Symbol.clone) ||
        Object.hasOwnProperty.call(obj.constructor.prototype, Symbol.clone))
        ? obj[Symbol.clone]
        : null;
    if (!cloneMethod) return obj;
    const ref = { current: undefined };
    const wrappedClone = (obj) => {
      if (ref.current) {
        return clone(obj, map, methodMap);
      }
    };
    const cloneIterator = cloneMethod.call(obj, wrappedClone);
    ref.current = cloneIterator.next().value;
    map.set(obj, ref.current);
    if (ref.current) {
      cloneIterator.next();
    }
    return ref.current;
  };
  Object.clone = (obj, methodMap) =>
    clone(obj, new Map(), methodMap || new Map());
}
