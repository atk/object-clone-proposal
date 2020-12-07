if (typeof Object.clone !== "function") {
  const unclonable = /^\[object (?:Undefined|Null|Boolean|Number|String|Symbol|WeakMap)\]$/;

  const defaultMethods = new Map([
    [
      Date,
      function* (date) {
        yield new Date(date.valueOf());
      },
    ],
    [
      Set,
      function* (set, clone) {
        const ref = new Set();
        yield ref;
        set.forEach((value) => ref.add(clone(value)));
      },
    ],
    [
      Map,
      function* (map, clone) {
        const ref = new Map();
        yield ref;
        map.forEach((value, key) => ref.set(clone(key), clone(value)));
      },
    ],
    [
      TypedArray,
      function* (typedArray, clone) {
        const ref = new typedArray.constructor(typedArray.length);
        yield ref;
        ref.set(typedArray.map((value) => clone(value)));
      },
    ],
    [Function, false],
    [
      Promise,
      function* (promise) {
        yield new Promise((resolve, reject) => {
          promise.then(resolve).catch(reject);
        });
      },
    ],
    [
      RegExp,
      function* (regexp) {
        yield new RegExp(regexp);
      },
    ],
    [
      Object,
      function* (obj, clone) {
        const ref =
          obj instanceof TypedArray
            ? new obj.constructor(obj.length)
            : new obj.constructor();
        yield ref;
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            ref[key] = clone(obj[key]);
          }
        }
      },
    ],
  ]);

  if (this.Node) {
    defaultMethods.set(Node, false);
  }

  const getByInstance = (obj, methodMap) => {
    for (const constructor of methodMap.keys()) {
      if (obj instanceof constructor) return methodMap.get(constructor);
    }
  };

  const getCloneMethod = (obj, methodMap) =>
    methodMap.get(obj.constructor) ??
    defaultMethods.get(obj.constructor) ??
    getByInstance(obj, methodMap) ??
    getByInstance(obj, defaultMethods) ??
    defaultMethods.get(Object);

  const clone = (obj, map, methodMap) => {
    if (unclonable.test(Object.prototype.toString.call(obj))) return obj;
    if (map.has(obj)) return map.get(obj);
    const cloneMethod = getCloneMethod(obj, methodMap);
    if (!cloneMethod) return obj;
    const wrappedClone = (obj) => clone(obj, map, methodMap);
    wrappedClone.properties = (ref) => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          ref[key] = wrappedClone(obj[key]);
        }
      }
    };
    const cloneIterator = cloneMethod(obj, wrappedClone);
    const ref = cloneIterator.next().value;
    map.set(obj, ref);
    cloneIterator.next();
    return ref;
  };

  Object.clone = (obj, methodMap) =>
    clone(obj, new Map(), methodMap || new Map());
}
