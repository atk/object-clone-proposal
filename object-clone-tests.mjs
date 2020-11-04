#! /usr/bin/env -S node --experimental-modules

// suboptimal, but it should work in node.js w/o support for TypedArrays
// even though it emits a warning
if (typeof TypedArray === "undefined") {
  global.TypedArray = Buffer;
  global.Uint8Array = TypedArray;
}

import "./object-clone.js";

import { strict } from "assert";

const testObjectClone = () => {
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
  testClones(map, "map");

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
};

testObjectClone();
