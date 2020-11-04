# ECMAScript proposal: Object.clone()

Stage 1 - early draft

With the spread operator `...`, it is fairly simple to make a shallow clone of an object.

However, in some cases you need to create a clone of all layers inside the object. It would be much more efficient to natively copy the referenced memory than to clone it manually.

## Syntax

    Object.clone(object)

## Considerations

Cloning an object has been a moving target for a while. With all the new additions to the language like TypedArray, (Weak)Map, Symbol, the requirements have changed fast. While this means any polyfill might have to be updated frequently, it also means a native implementation will be quite beneficial.

### What will be cloned?

Object.clone will not clone literals that are not handled by their references and need not be cloned, i.e. `undefined, null, boolean, number, string, function`¹ as well as values that cannot be cloned, like `Symbol` and `WeakMap`, which will be merely returned. Instead, those will be returned directly. The same principle applies to nested properties.

### Cyclical references

Another edge case for cloning objects are cyclical references. The obvious intention would be to replicate such a reference structure as a clone.

### JSON.parse/stringify

A much used shortcut for this task is `JSON.parse(JSON.stringify(object))`, which combines the drawbacks of less efficiency with poorer handling of cyclical references, functions and object instances. A native method could put an end to this abuse.

### Security

It may be possible to abuse this method in order to spam the garbage collector and thus hog the runtime's memory, but it is simple enough to do the same without Object.clone, so the security is not worse for this method. On the other hand, a native implementation could detect if the cloned object is actually used or either the clone or its origin are changed in order to avoid unneccessary allocations.

## Prior art

There are multiple libraries to provide a similar functionality in ECMAScript:

* [lodash](https://lodash.com/docs/4.17.15#cloneDeep)'s `_.cloneDeep(object)`
* [underscore](https://github.com/mateusmaso/underscore.deepclone)'s deepclone
* [ramda](https://ramdajs.com/docs/#clone)'s `R.clone(object)`
* [jQuery](https://api.jquery.com/jquery.extend/)'s `$.extend(true, object)`
* [multiple packages on npmjs](https://www.npmjs.com/search?q=clone)

Most other languages that handle references have similar functionality, i.e.

* Rust's clone trait
* Java's clone method
* Python's deepcopy

## Polyfill

```javascript
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
```

---
¹ though a `function` is handled by its reference, only its properties could be changed and not its code.