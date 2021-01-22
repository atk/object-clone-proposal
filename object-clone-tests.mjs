#! /usr/bin/env -S node --experimental-modules

import { strict } from "assert";

const testObjectClone = async () => {
  await import("./object-clone.js");

  console.log("Object.clone");
  console.log("  is a function");
  strict.strictEqual(
    typeof Object.clone,
    "function",
    "Object.clone is not a function"
  );

  const testReturn = (value, name) =>
    strict.strictEqual(
      Object.clone(value),
      value,
      `${name} could not be returned`
    );

  console.log("  returns `null`");
  testReturn(null, "null");

  console.log("  returns Booleans");
  testReturn(true, "true");
  testReturn(false, "false");

  console.log("  returns Numbers");
  testReturn(42, "Integer");
  testReturn(4 / 3, "Float");

  console.log("  returns BigInts");
  testReturn(
    BigInt("12941092850129012851029841982580921851285198271824218124"),
    "BigInt"
  );

  console.log("  returns Strings");
  testReturn("test", "String");

  console.log("  returns Functions");
  testReturn(() => null, "Function");

  console.log("  returns AsnycFunctions");
  testReturn(async () => true, "AsyncFunction");

  console.log("  returns GeneratorFunctions");
  testReturn(function* () {
    yield true;
  }, "GeneratorFunction");

  console.log("  returns AsyncGeneratorFunctions");
  testReturn(async function* () {
    yield Promise.resolve(true);
  }, "AsyncGeneratorFunction");

  console.log("  returns Symbols");
  testReturn(Symbol("test"), "Symbol");

  console.log("  returns WeakSets");
  testReturn(new WeakSet([{}, {}, {}]), "WeakSet");

  console.log("  returns WeakMaps");
  testReturn(
    new WeakMap([
      [{}, "test"],
      [{}, [1, 2, 3]],
    ]),
    "WeakMap"
  );

  console.log("  returns ArrayBuffer");
  testReturn(new ArrayBuffer(1), "ArrayBuffer");

  console.log("  returns SharedArrayBuffer");
  testReturn(new SharedArrayBuffer(1), "SharedArrayBuffer");

  console.log("  returns DataView");
  testReturn(new DataView(new ArrayBuffer(1)), "DataView");

  const testClones = (value, name, additionalTests) => {
    const clone = Object.clone(value);
    strict.notStrictEqual(clone, value, `${name} was not cloned`);
    strict.deepStrictEqual(clone, value, `${name} could not be cloned`);
    if (additionalTests) {
      additionalTests(clone, value, name);
    }
  };

  console.log("  clones Date instances");
  testClones(new Date(), "Date");

  console.log("  clones Arrays");
  testClones([1, 2, 3, 4], "simple Array");
  const repeatedReferenceArray = [{}];
  repeatedReferenceArray.push(repeatedReferenceArray[0]);
  testClones(repeatedReferenceArray, "repeated reference array", (clone) => {
    strict.strictEqual(
      clone[0],
      clone[1],
      "Repeated reference inside an array was wrongly cloned twice"
    );
  });
  const circularArray = [];
  circularArray.push(circularArray);
  testClones(circularArray, "circular Array");
  testClones([1, [2, [3, [4]]]], "nested Array");

  console.log("  clones TypedArrays");
  testClones(new Uint8Array([1, 2, 3, 4, 5, 6]), "Uint8Array");
  testClones(new Int32Array([1, 2, 3, 4, 5, 6]), "Int32Array");

  console.log("  clones Maps");
  const map = new Map();
  map.set(["key"], { value: null });
  map.set({ other: "key" }, "other value");
  testClones(map, "Map");

  console.log("  clones Sets");
  const set = new Set(["a", ["b"], { c: "d" }]);
  testClones(set, "Set");

  console.log("  clones RegExp");
  const regexp = /test\ntest/gi;
  testClones(regexp, "RegExp");

  console.log("  clones Objects");
  const simpleObject = { a: undefined, b: null, c: true, d: 42, e: "string" };
  testClones(simpleObject, "simple object");
  const nestedObject = { a: [{ b: "nested" }], c: {} };
  testClones(nestedObject, "nested object", (clone, value) => {
    strict.notStrictEqual(
      clone.a[0],
      value.a[0],
      "Object inside nested Object was not cloned"
    );
    strict.deepStrictEqual(
      clone.a[0],
      value.a[0],
      "Object inside nested Object could not be cloned"
    );
  });
  const circularObject = {};
  circularObject.circularReference = circularObject;
  testClones(circularObject, "circular Object");

  console.log("  clones instances");
  class Test {
    message() {
      return "test";
    }
    get [Symbol.clone]() {
      return function* () {
        yield new Test();
      };
    }
  }
  testClones(new Test(), "test Class");

  const testExtension = (value, methodMap, name, additionalTests) => {
    const clone = Object.clone(value, methodMap);
    strict.notStrictEqual(clone, value, `${name} was not cloned`);
    if (additionalTests) {
      additionalTests(clone, value, name);
    }
  };

  console.log("  clones functions if so extended");
  const cloneFunction = [
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
      for (const key in this) {
        ref[key] = clone(this[key]);
      }
    },
  ];
  function testFunc() {
    return "test";
  }
  testFunc.property = "test";
  testFunc.testObject = { a: [1, 2, 3] };
  testExtension(
    testFunc,
    new Map([cloneFunction]),
    "function (by extension)",
    (clone, value, name) => {
      strict.strictEqual(
        clone.property,
        value.property,
        `property of ${name} could not be cloned`
      );
      strict.notStrictEqual(
        clone.testObject,
        value.testObject,
        `object property of ${name} was not cloned`
      );
      strict.deepStrictEqual(
        clone.testObject,
        value.testObject,
        `object property of ${name} could not be cloned`
      );
    }
  );
};

testObjectClone().catch(console.error);
