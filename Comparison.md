# Comparison of prior art

| Constructor / Feature | lodash | underscore | ramda | jQuery | abused JSON | Object.clone |
|-----------------------|--------|------------|-------|--------|-------------|--------------|
| Undefined             |  ===   |    ===     |  ===  |  ===   | !!!¹ / ===  |     ===      |
| Null                  |  ===   |    ===     |  ===  |  ===   |     ===     |     ===      |
| Boolean               |  ===   |    ===     |  ===  |  ===   |     ===     |     ===      |
| Number                |  ===   |    ===     |  ===  |  ===   |     ===     |     ===      |
| String                |  ===   |    ===     |  ===  |  ===   |     ===     |     ===      |
| Function              |  XXX   |    XXX     |  ===  |  ===   |     !!!     |     ===      |
| Symbol                |  !!!   |    !!!     |  !!!  |  !!!   |     !!!     |     ===      |
| Array                 |  !==   |    !==     |  !==  |  !==   |     !==²    |     !==      |
| Object                |  !==   |    !==     |  !==  |  !==   |     !==²    |     !==      |
| Date                  |  !==   |    XXX     |  !==  |  ===   |     XXX³    |     !==      |
| RegExp                |  !==   |    XXX     |  !==  |  ===   |     XXX     |     !==      |
| TypedArray            |  !==   |    XXX     |  ===  |  ===   |     XXX     |     !==      |
| Set                   |  !==   |    XXX     |  ===  |  ===   |     XXX     |     !==      |
| Map/WeakMap           |  !==   |    XXX     |  ===  |  ===   |     XXX     |     !==      |
| Circular references   |  !==   |    !!!     |  !==  |  !!!   |     !!!     |     !==      |

---
¹ if the primary argument is `undefined`, `JSON.parse` will throw, since it is no valid JSON
² cloned properties will only work for the simple types supported by JSON
³ `Date` will yield a string representation that can be parsed

- `===`: same reference as incoming object
- `!==`: cloned reference with cloned properties
- `XXX`: wrong result
- `!!!`: error thrown

---

Versions tested:

* `lodash`: 4.17.20
* `underscore.deepclone`: 0.1.3
* `ramda`: 0.27.1
* `jQuery`: 3.5.1
* `JSON.stringify/.parse`: Chrome 87
