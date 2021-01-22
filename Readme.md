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
const clone = Object.clone(object, extensionMap)
```

## Prior art

There are multiple libraries to provide a similar functionality in ECMAScript:

* [lodash](https://lodash.com/docs/4.17.15#cloneDeep)'s `_.cloneDeep(object)`
* [underscore](https://github.com/mateusmaso/underscore.deepclone)'s `deepclone`
* [ramda](https://ramdajs.com/docs/#clone)'s `R.clone(object)`
* [jQuery](https://api.jquery.com/jquery.extend/)'s `$.extend(true, object)`
* [multiple packages on npmjs](https://www.npmjs.com/search?q=clone)
* [Espruino](https://www.espruino.com/Reference#l_Object_clone)'s `Object.clone(object)`

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

### Deep cloning as an unsolvable problem

We know the way native objects are instantiated and filled with data, because we control this process, but the same cannot be said about custom instances, because we have no introspection into the process of their instantiation. That means all we can provide for this use case is a framework that makes it as simple as possible to create clones of those custom instances.

A good example on how that is done best can be found in [Rust's Clone trait](https://doc.rust-lang.org/std/clone/trait.Clone.html), which can even be derived for instances that do allow for self-replication. Such a self-replication in JS would basically look like `new Array(array)`.

Unfortunately, JS does not have traits and thus must use a less sophisticated mechanism. Fortunately, we do have something rather similar that we can leverage here: `Symbol`. By using `Symbol.clone`, we can add a cloning interface, very similar to the iterable/iterator interface from [ES6 iterators](https://tc39.es/ecma262/#sec-iteration). The method could be attached either to the value itself or its prototype, which allows for very fine-grained control, and in addition could be overwritten by an optional secondary argument to the Object.clone call containing a Map with the constructors and methods to clone them (or `false` to stop them from being cloned).

```javascript
// directly attached
const myInstance = new MyClass();
myInstance[Symbol.clone] = method;
// attached to constructor's prototype
class MyClass {
  get [Symbol.clone]() { return method; }
}
// extension map
Object.clone(myInstance, new Map([[MyClass, method]]));
```

### What will be cloned by default?

`Object.clone` will by default not clone literals that will be newly instantiated if their value changed and thus need not be cloned, like `undefined, null, Boolean, Number, BigInt, String, Function, AsyncFunction, GeneratorFunction` and `AsyncGeneratorFunction` as well as values that cannot be cloned for they would cease to work as clones like `Symbol` or have a lack of introspection like `WASM Modules`, `WeakMap` and `WeakSet` or will usually be handled as unique reference like `Node` or the keys of a `Map`; those will be left unchanged. The same principle applies to nested properties of these types.

Also, everything with a [Symbol.clone] property (either own or prototypal) that contains a method to clone it (the format of that method will be explained later) will be cloned.

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

The same applies to singletons, which are instances of Function, too. In any case, the same behavior is also apparent in all tested libraries counted as prior art; if well documented, it should not cause issues.

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

To handle both of these cases, before cloning the properties recursively, we need to make sure that we save the references in a `Map([[object, reference]])` to be reused whenever they are cloned again. Obviously, a native solution can access the references directly. Unfortunately, a WeakMap will only accept Objects as keys, so we cannot use it.

#### Tortoise & Hare detection of repeated references

If memory is more of an issue than CPU, one could use a [tortoise and hare algorithm](https://en.wikipedia.org/wiki/Cycle_detection#Floyd's_Tortoise_and_Hare) to detect and store only the repeated references. Especially systems with extreme memory restrictions like [espruino](https://www.espruino.com/) with mere 48kb of RAM can benefit from a native implementation using such an approach, which luckily is [already the case](https://www.espruino.com/Reference#l_Object_clone), so a polyfill is not needed here.

### How to clone your own instances?

We have hopefully by now established two things: 1. instances are only cloned if either they or their constructor's prototype have a [Symbol.clone] method attached to them. 2. in order to escape the repeated references issue, we need a reference map of the cloned references, so the method needs to perform the following steps (not necessarily itself):

1. Create a reference without cloned properties, so we do not accidentally clone twice or get an infinite loop from cyclic references
2. Store the new reference in the internal map that is required to handle repeated and cyclic references
3. Clone all its properties with the updated reference map and add them to the new reference

There are multiple ways to solve this, so let's explore a few:

#### Naive implementation as simple function

A naive implementation of these steps looks like this:

```javascript
function cloneMethod(map, clone) {
  const reference = new this.constructor();
  map.set(this, reference);
  Object.keys(this).forEach((key) => {
    reference[key] = clone(this[key]);
  });
  return reference;
}
```

While this is without question the most simple approach, it has the serious drawback that it might be forgotten to fill the reference map, which breaks the detection of repeated or cyclic references and also is easy to get wrong. So let's see if there are better approaches.

#### Array with two separate functions

In order to externalize the addition of the reference to the map, one could split this function into an array of two functions:

```javascript
const cloneMethod = [
  () => new this.constructor(),
  (reference, clone) => 
    Object.keys(this).forEach((key) => {
      reference[key] = clone(this[key])
    })
]
```

This is more tidy than the single function and splitting the steps into separate functions secures the handling of cyclic references. Separating the scopes is less than ideal for performance and the handling feels a bit unwieldy. There must be a better way!

#### Generator function

What if we could still use only one function while making sure the map was filled externally? Let's try a generator function:

```javascript
const cloneMethod = function*(clone) {
  const reference = new this.constructor();
  yield reference
  Object.keys(this).forEach((key) => {
    reference[key] = clone(this[key])
  })
}
```

This approach seems by far the most elegant one, leveraging the ability of iterables to emit values from inside the scope while still being able to continue. If no reference is yielded, we can simply decide to keep the second part suspended and also make the clone method only work at all if a reference was yielded so it cannot be called before that to even further rule out accidental erroneous behavior. As a final thought, one could even make the Object.clone method emit an error if called from inside a clone method. In the current polyfill, such a failsafe is not yet implemented.

#### Example

For example, if you want to clone DOM Nodes and functions, but do not want to clone MyClass instances (that do have a method in their constructor), you can extend `Object.clone` like this:

```javascript
const clone = Object.clone(object, new Map([
  [
    Function,
    function* (clone) {
      let ref, error;
      try {
        ref = new Function(`return ${this.toString()}`)();
      } catch (e) {
        // do not clone native functions
        ref = this;
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
  [Node, function*() {
    yield this.cloneNode(true)
  }],
  [MyClass, false]
]));
```

### Security

It may be possible to abuse this method in order to spam the garbage collector and thus hog the runtime memory, but it is simple enough to do the same without Object.clone, so the security is not worse for this method. On the other hand, a native implementation could detect if the cloned object is actually used or either the clone or its origin are changed in order to avoid unnecessary allocations.

Also, one could make a case for an extension API that allowed for anyone to add/overwrite clone methods (see above: persistent modification). While that would certainly simplify the handling of exported class instances, it could lead to all sorts of unwanted behavior.

## Polyfill

```javascript
if (!Symbol.clone) {
  Symbol.clone = Symbol.for("Symbol.clone");
  Date.prototype[Symbol.clone] = function* () {
    yield new Date(this.valueOf());
  };
  Set.prototype[Symbol.clone] = function* (clone) {
    const ref = new Set();
    yield ref;
    this.forEach((value) => ref.add(clone(value)));
  };
  Map.prototype[Symbol.clone] = function* (clone) {
    const ref = new Map();
    yield ref;
    this.forEach((value, key) => ref.set(key, clone(value)));
  };
  [
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
  ].forEach((constructor) => {
    constructor.prototype[Symbol.clone] = function* (clone) {
      const ref = new this.constructor(this.length);
      yield ref;
      ref.set(this.map((value) => clone(value)));
    };
  });
  RegExp.prototype[Symbol.clone] = function* () {
    yield new RegExp(this);
  };
  Array.prototype[Symbol.clone] = function* (clone) {
    const ref = new this.constructor(this.length);
    yield ref;
    this.forEach((value, index) => {
      ref[index] = clone(value);
    });
  };
  Object.prototype[Symbol.clone] = function* (clone) {
    const ref = new this.constructor();
    yield ref;
    Object.entries(this).forEach(([key, value]) => {
      ref[key] = clone(value);
    });
  };
}
if (typeof Object.clone !== "function") {
  const unclonable = /^\[object (?:Undefined|Null|Boolean|Number|BigInt|String|Symbol|Module|Weak(?:Set|Map)|(?:Shared)?ArrayBuffer|DataView)\]$/;
  const clone = (obj, map, methodMap) => {
    if (unclonable.test(Object.prototype.toString.call(obj))) return obj;
    if (map.has(obj)) return map.get(obj);
    const cloneMethod =
      methodMap.get(obj.constructor) ??
      (Object.hasOwnProperty.call(obj, Symbol.clone) ||
        Object.hasOwnProperty.call(obj.constructor.prototype, Symbol.clone))
        ? obj[Symbol.clone]
        : null;
    if (!cloneMethod) return obj;
    const ref = { current: undefined };
    const wrappedClone = (obj) => {
      if (ref.current) {
        return clone(obj, map, methodMap);
      }
    };
    const cloneIterator = cloneMethod.call(obj, wrappedClone);
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
