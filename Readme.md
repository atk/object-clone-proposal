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

## Syntax

```javascript
const clone = Object.clone(object);
const extendedClone = Object.clone(
  object,
  new Map([[MyConstructor, (instance, map) => {
    const clone = instance.clone();
    map.set(instance, clone);
    return clone;
  }]])
);
```

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

### What will be cloned by default?

`Object.clone` will by default not clone literals that will be reinstantiated if their value changed and thus need not be cloned, like `undefined, null, boolean, number, string, function` as well as values that cannot be cloned for they would cease to work as clones like `Symbol` or have a lack of introspection like `WeakMap` or will usually be handled as unique reference like `Node`; those will be merely returned. The same principle applies to nested properties of these types. Everything else will be cloned recursively.

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

### How to extend what is cloned?

`Object.clone` supports an optional second argument, which should contain a `Map([[constructor, [createReference, cloneProperties]]])`, where

* `constructor` is the constructor of the type that should be cloned by the extension,
* `createReference` is a function that receives the object and returns a new reference of the constructor without the cloned properties and
* `cloneProperties` is a function that receives the object, the new reference and a wrapped clone function to clone all properties.

Both `createReference` and `cloneProperties` are optional and can be replaced with a falsy value. What happens then is that the default handling of objects will take over.

Here are a few simple examples:

```javascript
const myClassCloneMap = new Map([[
  MyClass,
  [
    null, // the default method of creating a new instance suits us here
    (instance, reference, clone) => { reference.dict = clone(instance.dict); }
  ]
]]);
const myClassClone = Object.clone(myClassInstance, myClassCloneMap);
```

Another example to extend `Object.clone` to clone DOM nodes and functions with properties would look like this:

```javascript
const clone = Object.clone(object, new Map([
  [Function, [
    (func) => new Function(`return ${func.toString()}`)()
    // default handling is fine for functions, so we can omit the second part
  ]],
  [Node, [
    (node) => node.cloneNode(true),
    (ref) => ref, // we do not want default handling here, so we overwrite it
  ]]
]));
```

Splitting the steps of creating the reference and cloning its properties is more failsafe (no way to create cyclic references by forgetting to set the reference in the map) and convenient (only overwrite the default methods if you feel the need to do so).

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

## Polyfill

```javascript
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
    [Promise, [(promise) => new Promise((resolve, reject) => promise.then(resolve).catch(reject))]],
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
```
