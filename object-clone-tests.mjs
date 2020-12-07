#! /usr/bin/env -S node --experimental-modules --no-deprecation

// suboptimal, but it should work in node.js w/o support for TypedArrays
if (typeof TypedArray === "undefined") {
  global.TypedArray = Buffer;
  global.Uint8Array = TypedArray;
}

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

  console.log("  returns booleans");
  testReturn(true, "true");
  testReturn(false, "false");

  console.log("  returns numbers");
  testReturn(42, "integer");
  testReturn(4 / 3, "float");

  console.log("  returns strings");
  testReturn("test", "string");

  console.log("  returns functions");
  testReturn(() => null, "function");

  console.log("  returns Symbols");
  testReturn(Symbol("test"), "symbol");

  const testClones = (value, name, additionalTests) => {
    const clone = Object.clone(value);
    strict.notStrictEqual(clone, value, `${name} was not cloned`);
    strict.deepStrictEqual(clone, value, `${name} could not be cloned`);
    if (additionalTests) {
      additionalTests(clone, value, name);
    }
  };

  console.log("  clones Date instances");
  testClones(new Date(), "date");

  console.log("  clones Arrays");
  testClones([1, 2, 3, 4], "simple array");
  const circularArray = [];
  circularArray.push(circularArray);
  testClones(circularArray, "circular array");
  testClones([1, [2, [3, [4]]]], "nested array");

  console.log("  clones TypedArrays");
  testClones(new Uint8Array([1, 2, 3, 4, 5, 6]), "Uint8Array");

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
      "object inside nested object was not cloned"
    );
    strict.deepStrictEqual(
      clone.a[0],
      value.a[0],
      "object inside nested object could not be cloned"
    );
  });
  const circularObject = {};
  circularObject.circularReference = circularObject;
  testClones(circularObject, "circular object");

  console.log("  clones instances");
  class Test {
    message() {
      return "test";
    }
  }
  testClones(new Test(), "test class");

  const testExtension = (value, methodMap, name, additionalTests) => {
    const clone = Object.clone(value, methodMap);
    strict.notStrictEqual(clone, value, `${name} was not cloned`);
    if (additionalTests) {
      additionalTests(clone, value, name);
    }
  };

  console.log("  clones functions if so extended");
  function testFunc() {
    return "test";
  }
  testFunc.property = "test";
  testFunc.testObject = { a: [1, 2, 3] };
  testExtension(
    testFunc,
    new Map([
      [
        Function,
        function* (func, clone) {
          const ref = new Function(`return ${func.toString()}`)();
          yield ref;
          for (const key in func) {
            ref[key] = clone(func[key]);
          }
        },
      ],
    ]),
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
