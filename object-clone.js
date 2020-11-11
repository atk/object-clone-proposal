if (typeof Object.clone !== "function") {
  const unclonable = /^\[object (?:Undefined|Null|Boolean|Number|String|Symbol|WeakMap)\]$/;

  const defaultCreateReference = (obj) =>
    obj instanceof TypedArray
      ? new obj.constructor(obj.length)
      : new obj.constructor();

  const defaultCloneProperties = (obj, ref, clone) => {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        ref[key] = clone(obj[key]);
      }
    }
  };

  const defaultMethods = new Map([
    [Date, [() => new Date(), (date, ref) => ref.setTime(date.getTime())]],
    [
      Map,
      [
        () => new Map(),
        (map, ref, clone) =>
          map.forEach((value, key) => ref.set(clone(key), clone(value))),
      ],
    ],
    // do not clone functions by default
    [Function, null],
    // empty array: use default methods
    [Object, []],
  ]);

  // do not clone HTML nodes by default
  if (this.Node) {
    defaultMethods.set([Node, [(node) => node, (node) => node]]);
  }

  const getByInstance = (obj, methodMap) => {
    for (const constructor of methodMap.keys()) {
      if (obj instanceof constructor) return methodMap.get(constructor);
    }
  };

  const getCloneMethod = (obj, methodMap) =>
    methodMap.has(obj.constructor)
      ? methodMap.get(obj.constructor)
      : defaultMethods.has(obj.constructor)
      ? defaultMethods.get(obj.constructor)
      : getByInstance(obj, methodMap) || getByInstance(obj, defaultMethods);

  const clone = (obj, map, methodMap) => {
    if (unclonable.test(Object.prototype.toString.call(obj))) return obj;
    if (map.has(obj)) return map.get(obj);
    const cloneMethod = getCloneMethod(obj, methodMap);
    if (!cloneMethod) return obj;
    const ref = (cloneMethod[0] || defaultCreateReference)(obj);
    map.set(obj, ref);
    (cloneMethod[1] || defaultCloneProperties)(obj, ref, (obj) =>
      clone(obj, map, methodMap)
    );
    return ref;
  };
  Object.clone = (obj, methodMap) =>
    clone(obj, new Map(), methodMap || new Map());
}
