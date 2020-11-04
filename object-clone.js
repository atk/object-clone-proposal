if (typeof Object.clone !== "function") {
  const clone = (obj, map) => {
    if (obj === null || typeof obj !== "object" || obj instanceof WeakMap)
      return obj;

    if (map.has(obj)) return map.get(obj);

    const temp =
      obj instanceof TypedArray
        ? new obj.constructor(obj.length)
        : new obj.constructor();

    map.set(obj, temp);

    if (obj instanceof TypedArray) {
      temp.set(obj.map((value) => clone(value, map)));
    } else if (obj instanceof Map) {
      obj.forEach((value, key) => temp.set(key, clone(value, map)));
    } else if (obj instanceof Date) {
      temp.setTime(obj.getTime());
    } else {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          temp[key] = clone(obj[key], map);
        }
      }
    }
    return temp;
  };
  Object.clone = (obj) => clone(obj, new Map());
}
