if (typeof Object.clone !== "function") {
  const unclonable = /^\[object (?:Undefined|Null|Boolean|Number|String|Symbol|WeakMap)\]$/;
  const clone = (obj, map, methodMap) => {
    if (
      unclonable.test(Object.prototype.toString.call(obj)) ||
      (typeof obj !== "object" && !methodMap.has(obj.constructor))
    ) {
      return obj;
    }

    if (map.has(obj)) return map.get(obj);

    if (methodMap.has(obj.constructor)) {
      return methodMap.get(obj.constructor)(obj, map, (obj) =>
        clone(obj, map, methodMap)
      );
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
