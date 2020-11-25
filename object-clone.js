if (typeof Object.clone !== "function") {
  const unclonable = /^\[object (?:Undefined|Null|Boolean|Number|String|Symbol|WeakMap)\]$/;

  const defaultMethods = new Map([
    [
      Date,
      function* (date) {
        const ref = new Date();
        yield ref;
        ref.setTime(date.getTime());
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
      Function,
      function* (func) {
        // do not clone functions by default
        yield func;
      },
    ],
    [
      Promise,
      function* (promise) {
        yield new Promise((resolve, reject) => {
          promise.then(resolve).catch(reject);
        });
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

  const clone = (obj, map, methodMap) => {
    if (
      unclonable.test(Object.prototype.toString.call(obj)) ||
      (typeof obj !== "object" && !methodMap.has(obj.constructor))
    ) {
      return obj;
    }

    if (map.has(obj)) return map.get(obj);

    if (methodMap.has(obj.constructor)) {
      const cloneGenerator = methodMap.get(obj.constructor)(obj, (obj) =>
        clone(obj, map, methodMap)
      );
      const ref = cloneGenerator.next().value;
      map.set(obj, ref);
      cloneGenerator.next();
      return ref;
    }

    const temp =
      obj instanceof TypedArray
        ? new obj.constructor(obj.length)
        : new obj.constructor();

    map.set(obj, temp);

    if (obj instanceof TypedArray) {
      temp.set(obj.map((value) => clone(value, map, methodMap)));
    } else if (obj instanceof Map) {
      obj.forEach((value, key) => temp.set(key, clone(value, map, methodMap)));
    } else if (obj instanceof Date) {
      temp.setTime(obj.getTime());
    } else {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          temp[key] = clone(obj[key], map, methodMap);
        }
      }
    }
    return temp;
  };
  Object.clone = (obj, methodMap) =>
    clone(obj, new Map(), methodMap || new Map());
}
