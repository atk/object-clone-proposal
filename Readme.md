# ECMAScript proposal: Object.clone()

Stage 0 - Strawperson

With the spread operator `...`, it is fairly simple to make a shallow clone of an object.

However, in some cases you need to create a clone of all layers inside the object. It would be much more efficient to natively copy the referenced memory than to clone it manually.

## Call for feedback

As long as there is no TC39 member who will champion this proposal, this is open for feedback, questions and improvements. Use [Issues](https://github.com/atk/object-clone-proposal/issues) and [PRs](https://github.com/atk/object-clone-proposal/pulls) as you see fit.

## Syntax

    const clone = Object.clone(object)

## Prior art

There are multiple libraries to provide a similar functionality in ECMAScript:

* [lodash](https://lodash.com/docs/4.17.15#cloneDeep)'s `_.cloneDeep(object)`
* [underscore](https://github.com/mateusmaso/underscore.deepclone)'s `deepclone`
* [ramda](https://ramdajs.com/docs/#clone)'s `R.clone(object)`
* [jQuery](https://api.jquery.com/jquery.extend/)'s `$.extend(true, object)`
* [multiple packages on npmjs](https://www.npmjs.com/search?q=clone)

Most other languages that handle references have similar functionality, i.e.

* Rust's clone trait
* Java's clone method
* Python's deepcopy

## Considerations

Cloning an object has been a moving target for a while. With all the new additions to the language like TypedArray, (Weak)Map, Symbol, the requirements have changed fast. While this means any polyfill might have to be updated frequently, it also means a native implementation will be quite beneficial.

### What will be cloned?

`Object.clone` will not clone literals that will be reinstantiated if their value changed and thus need not be cloned, like `undefined, null, boolean, number, string, function` as well as values that cannot be cloned for they would cease to work as clones like `Symbol` or have a lack of introspection like `WeakMap`; those will be merely returned. The same principle applies to nested properties of these types. Everything else will be cloned recursively.

`function` here is a bit of an exception, since it can have properties that can be changed:

```javascript
const f = () => 0
x.property = true
const x = Object.clone({ f });
x.f.property = false
console.log(f.property) // false
// if the function was cloned, property would only be changed in the clone
// and thus be true
```

A singleton will be the preferred pattern for such a use case and since it is not a function but an instance, this would be cloned. The same behavior is also apparent in all tested libraries counted as prior art; if well documented, it should not cause issues.

### Cyclical references

Another edge case for cloning objects are cyclical references, which can easily lead to uncaught range errors. If unhandled, the result would look like this:

```javascript
const x = []
x.push(x)
Object.clone(x)
// Uncaught RangeError: Maximum call stack size exceeded
```

The obvious solution would be to instead replicate such a reference structure as a clone, which can be easily done for a polyfill by storing cloned references in a `Map` before the recursion and use the references from there before cloning again. Obviously, a native solution can utilize the memory structure of the engine.

### JSON.parse/stringify

A much used shortcut for this task is `JSON.parse(JSON.stringify(object))`, which combines the drawbacks of less efficiency with poorer handling of cyclical references, functions and object instances. A native method could put an end to this abuse.

### Security

It may be possible to abuse this method in order to spam the garbage collector and thus hog the runtime's memory, but it is simple enough to do the same without Object.clone, so the security is not worse for this method. On the other hand, a native implementation could detect if the cloned object is actually used or either the clone or its origin are changed in order to avoid unneccessary allocations.

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
