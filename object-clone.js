if (typeof Object.clone !== "function") {
  const unclonable = /^\[object (?:Undefined|Null|Boolean|Number|BigInt|String|Symbol|Module|Weak(?:Set|Map)|(?:Shared)?ArrayBuffer|DataView)\]$/;

  function* handleTypedArrays(typedArray, clone) {
    const ref = new typedArray.constructor(typedArray.length);
    yield ref;
    ref.set(typedArray.map((value) => clone(value)));
  }

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
        map.forEach((value, key) => ref.set(key, clone(value)));
      },
    ],
    ...[
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
    ].map((constructor) => [constructor, handleTypedArrays]),
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
        const ref = new obj.constructor();
        yield ref;
        clone.properties();
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
    methodMap.get(Object) ??
    defaultMethods.get(Object);

  const clone = (obj, map, methodMap) => {
    if (unclonable.test(Object.prototype.toString.call(obj))) return obj;
    if (map.has(obj)) return map.get(obj);
    const cloneMethod = getCloneMethod(obj, methodMap);
    if (!cloneMethod) return obj;
    const ref = { current: undefined };
    const wrappedClone = (obj) => {
      if (ref.current) {
        return clone(obj, map, methodMap);
      }
    };
    wrappedClone.properties = () => {
      if (ref.current === undefined) {
        return;
      }
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          ref.current[key] = wrappedClone(obj[key]);
        }
      }
    };
    const cloneIterator = cloneMethod(obj, wrappedClone);
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
