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

The main use case is the creation of an object equal in value to the original, but without shared references that would let modifications to the original cause changes in the clone, like in this example:

```javascript
const example = { deep: { inside: 'value' } };
const shallow = { ...example };
const clone = Object.clone(example);
example.deep.inside = 'other value';
console.log([shallow.deep.inside, clone.deep.inside]);
// ['other value', 'value']
```

- convenient way of forcing a complete re-render for MVC frameworks
- creating clones without shared references of state for an undo history
- making a clone without a proxy of an object with a proxy
- getting a completely unfrozen clone of a deeply frozen object

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

* Rust's `clone` trait
* Java's `clone` method
* Python's `deepcopy`

While others require an external library in order to do so - of varying quality and functionality.

## Considerations

Cloning an object has been a moving target for a while. With all the new additions to the language like TypedArray, Set, Map, Symbol, the requirements have changed fast. While this means any external solution or polyfill might have to be updated with those changes, it also means a native implementation will be quite beneficial.

### JSON.parse/stringify

A much used shortcut for this task is `JSON.parse(JSON.stringify(object))`, which combines the drawbacks of less efficiency with poorer handling of repeated and cyclical references, functions and object instances. A native method could put an end to this abuse.

### What will be cloned by default?

`Object.clone` will by default not clone literals that will be newly instantiated if their value changed and thus need not be cloned, like `undefined, null, Boolean, Number, BigInt, String, Function, AsyncFunction, GeneratorFunction` and `AsyncGeneratorFunction` as well as values that cannot be cloned for they would cease to work as clones like `Symbol` or have a lack of introspection like `WASM Modules`, `WeakMap` and `WeakSet` or will usually be handled as unique reference like `Node`; those will be merely returned. The same principle applies to nested properties of these types. Everything else will be cloned recursively.

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

### Repeated and cyclic references

Consider the following case:

```javascript
const x = [{}]
x.push(x[0])
const y = Object.clone(x)
x[0] === x[1] // true
y[0] === y[1] // should be true, too
```

If the reference to an object is present twice, we should only have one clone. With a naive approach that just cloned every property, we would get multiple clones of the same object.

Another edge case for cloning objects are cyclic references, which can easily lead to uncaught range errors. If unhandled, the result would look like this:

```javascript
const x = []
x.push(x)
Object.clone(x)
// Uncaught RangeError: Maximum call stack size exceeded
```

To handle both of these cases, before cloning the properties recursively, we need to make sure that we save the references in a `Map([[object, reference]])` to be reused whenever they are cloned again. Obviously, a native solution can access the references directly.

### How to modify what is cloned?

There are use cases that are not fulfilled by the default handling of `Object.clone`, so there should be a way to support them, too, similar to the second argument of `JSON.stringify(value, replacer, space)` or `JSON.parse(json, reviver)`. While one could use a similar approach, this would mean whatever handler was used had to handle almost everything itself, which would basically render `Object.clone` useless in such cases.

A better approach is sure to only modify the behavior for those constructors that one actually wants to modify. A `Map([[constructor, cloneMethod]])` instantly springs to mind, which allows to extend or overwrite each of the types that are cloned separately. Since we need to fill our reference map, each call of this function should cover the following steps (not necessarily by itself):

1. Create a reference without cloned properties, so we do not accidentally clone twice or get an infinite loop from cyclic references
2. Store the new reference in the internal map that is required to handle repeated and cyclic references
3. Clone all its properties with the updated reference map and add them to the reference

#### Naive implementation as simple function

A naive implementation of these steps looks like this:

```javascript
function cloneMethod(object, map, clone) {
  const reference = new object.constructor();
  map.set(object, reference);
  Object.keys(object).forEach((key) => {
    reference[key] = clone(object[key]);
  });
  return reference;
}
```

While this is without question the most simple approach, it has the serious drawback that it might be forgotten to fill the reference map, which breaks the detection of repeated or cyclic references. So let's see if there are better approaches.

#### Array with two separate functions

In order to externalize the addition of the reference to the map, one could split this function into an array of two functions:

```javascript
const cloneMethod = [
  (object) => new object.constructor(),
  (reference, object, clone) => 
    Object.keys(object).forEach((key) => {
      reference[key] = clone(object[key])
    })
]
```

This is more tidy than the single function and splitting the steps into separate functions secures the handling of cyclic references. Separating the scopes is less than ideal for performance and the handling feels a bit unwieldy. There must be a better way!

#### Generator function

What if we could still use only one function while making sure the map was filled externally? Let's try a generator function:

```javascript
const cloneMethod = function*(object, clone) {
  const reference = new object.constructor();
  yield reference
  Object.keys(object).forEach((key) => {
    reference[key] = clone(object[key])
  })
}
```

This approach seems by far the most elegant one, leveraging the ability of iterables to emit values from inside the scope while still being able to continue. If no reference is yielded, we can simply decide to keep the second part suspended and also make the clone method only work at all if a reference was yielded so it cannot be called before that to even further rule out accidental erroneous behavior. As a final thought, one could even make the Object.clone method emit an error if called from inside a clone method. In the current polyfill, such a failsafe is not yet implemented.

#### Example

For example, if you want to clone DOM Nodes and functions, but do not want to clone MyClass instances, you can extend `Object.clone` like this:

```javascript
const clone = Object.clone(object, new Map([
  [
    Function,
    function* (func, clone) {
      let ref, error;
      try {
        ref = new Function(`return ${func.toString()}`)();
      } catch (e) {
        // do not clone native functions
        ref = func;
        error = e;
      }
      yield ref;
      if (error) {
        return;
      }
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

#### Persistent modification

The thought of being able to persistently modify the handling of certain types. Unfortunately, since the method might be called from external libraries, this could easily lead to unintended behavior as overwriting native prototypes and therefore, such a possibility was dismissed after short consideration.

#### Best practices for library authors

Libraries and frameworks might want their own types to be handled consistently by `Object.clone`. The best practice is to export an array that can be destructured into the initial array for `methodMap`, preferably as a separate entity or even package inside your library to avoid it being unnecessarily linked into your user's project.

```javascript
export const cloneMethods = [
  [Type1, function* () { ... }],
  [Type2, function* () { ... }],
];
```

This allows for consistent handling for all external libraries that apply these best practices.

### Security

It may be possible to abuse this method in order to spam the garbage collector and thus hog the runtime memory, but it is simple enough to do the same without Object.clone, so the security is not worse for this method. On the other hand, a native implementation could detect if the cloned object is actually used or either the clone or its origin are changed in order to avoid unnecessary allocations.

Also, one could make a case for an extension API that allowed for anyone to add/overwrite clone methods. While that would certainly simplify the handling of 


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
```
