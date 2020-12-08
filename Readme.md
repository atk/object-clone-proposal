# Object.clone()

## Status

Champion(s): TBD
Author: Alex Lohr
Stage: 0 - Strawperson

## Motivation

With the spread operator `...`, it is simple to make a shallow clone of an object. In some cases, the requirement arises to create a deep clone of the object. It would be much more efficient to natively copy the referenced memory than to clone it manually. A native method would also help circumvent the issues of a naive implementation.

## Call for feedback

As long as there is no TC39 member who will champion this proposal, this is completely open for feedback, questions and improvements. Use [Issues](https://github.com/atk/object-clone-proposal/issues) and [PRs](https://github.com/atk/object-clone-proposal/pulls) as you see fit.

## Use cases

- convenient way of forcing complete rerender for MVC framworks like react
- creating immutable clones of state for an undo history
- making in immutable clone of a proxied object

## Syntax

```javascript
const clone = Object.clone(object);
const extendedClone = Object.clone(object, extensionMap);
```

## Prior art

There are multiple libraries to provide a similar functionality in ECMAScript:

* [lodash](https://lodash.com/docs/4.17.15#cloneDeep)'s `_.cloneDeep(object)`
* [underscore](https://github.com/mateusmaso/underscore.deepclone)'s `deepclone`
* [ramda](https://ramdajs.com/docs/#clone)'s `R.clone(object)`
* [jQuery](https://api.jquery.com/jquery.extend/)'s `$.extend(true, object)`
* [multiple packages on npmjs](https://www.npmjs.com/search?q=clone)

The functionality of these methods [differs somewhat](./Comparison.md) which can easily lead to confusion or even errors.

Also, some other languages that handle references have similar functionality, i.e.

* Rust's clone trait
* Java's clone method
* Python's deepcopy

While others require an external library in order to do so - of varying quality and functionality.

## Considerations

Cloning an object has been a moving target for a while. With all the new additions to the language like TypedArray, Set, Map, Symbol, the requirements have changed fast. While this means any external solution or polyfill might have to be updated with those changes, it also means a native implementation will be quite beneficial.

### What will be cloned by default?

`Object.clone` will by default not clone literals that will be reinstantiated if their value changed and thus need not be cloned, like `undefined, null, Boolean, Number, BigInt, String, Function, AsyncFunction, GeneratorFunction` and `AsyncGeneratorFunction` as well as values that cannot be cloned for they would cease to work as clones like `Symbol` or have a lack of introspection like `WASM Modules`, `WeakMap` and `WeakSet` or will usually be handled as unique reference like `Node`; those will be merely returned. The same principle applies to nested properties of these types. Everything else will be cloned recursively.

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

Another interesting question is if the keys of a `Map` or even the values of a `Set` should be cloned. Since the key is used as a reference, it should not be cloned; the value, however, is used as a property and thus should be cloned. A similar approach should be taken with (Shared)ArrayBuffer, which itself is a reference to a TypedArray, and to DataView - cloning those could break too many things.

Lastly, objects handled by [proxies](https://tc39.es/ecma262/#sec-proxy-constructor) will nevertheless be cloned without special handling, so it could be used to create a clone without the proxy attached.

### Cyclic references

Another edge case for cloning objects are cyclic references, which can easily lead to uncaught range errors. If unhandled, the result would look like this:

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


### How to extend what is cloned?

`Object.clone` supports an optional second argument `extensionMap`, which should contain a `Map([[constructor, cloneMethod]])`, allowing to extend the types that are cloned manually. During a call of `cloneMethod` 3 steps need to be performed:

1. Create a reference without cloned properties
2. Store reference in the internal map that is required to handle cyclic references
3. Clone all the properties and add them to the reference

There are 3 solutions suggested:

1. Function with exposed reference map
2. Array with two separate functions
3. Generator function

#### Function with exposed reference map

```javascript
const cloneMethod = (object, map, clone) => {
  // create a reference (without cloned data)
  const reference = object.cloneRef();
  // store reference in the map
  map.set(object, reference);
  // fill reference with cloned data.
  // Use clone here instead of Object.clone
  object.keys().forEach((key) => {
    reference[key] = clone(object[key]);
  });
  return reference;
}
```

While this is the most simple approach, it has the drawback that the exposed map might not be filled and thus breaks the detection of cyclic references. It also looks less tidy than the other approaches.


#### Array with two separate functions

```javascript
const cloneMethod = [
  (object) => new object.constructor(),
  (reference, object, clone) => 
    object.keys().forEach((key) => {
      reference[key] = clone(object[key])
    })
]
```

This is more tidy than the single function and splitting the steps into separate functions secures the handling of cyclic references. It is still not as elegant as one could wish for and seperating the scopes is not ideal for performance.

#### Generator function

```
const cloneMethod = function*(object, clone) {
  const reference = new object.constructor();
  yield reference
  object.keys().forEach((key) => {
    reference[key] = clone(object[key])
  })
}
```

This approach is both elegant and performant and thus considered the preferred way of handling extensions.

#### Example

For example, if you want to clone DOM Nodes and functions, but do not want to clone MyClass instances, you can extend `Object.clone` like this:

```javascript
const clone = Object.clone(object, new Map([
  [
    Function,
    function* (func, clone) {
      let ref;
      try {
        ref = new Function(`return ${func.toString()}`)();
      } catch (e) {
        // do not clone native functions
        ref = func;
      }
      yield ref;
      for (const key in func) {
        ref[key] = clone(func[key]);
      }
    },
  ],
  [Node, function*(node) {
    yield node.cloneNode(true)
  }],
  [MyClass, false]
]));
```

## Polyfill

```javascript
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
        clone.properties(ref);
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
```
