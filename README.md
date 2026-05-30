# bijou64

![License](https://img.shields.io/npm/l/bijou64.svg)
[![npm](https://img.shields.io/npm/v/bijou64.svg)][npm]

[npm]: https://www.npmjs.com/package/bijou64

Variable-Length Integer Encoding based on [bijou64](https://www.inkandswitch.com/tangents/bijou64/).

bijou64 encodes unsigned integers into 1–8 bytes using a tag-byte scheme with per-tier offsets,
achieving **structural canonicality** — each value has exactly one valid encoding.

## Encoding table

| Tag byte   | Additional bytes | Value range                           |
|------------|------------------|---------------------------------------|
| `0x00–0xF7`| 0                | 0 – 247                               |
| `0xF8`     | 1                | 248 – 503                             |
| `0xF9`     | 2                | 504 – 66,039                          |
| `0xFA`     | 3                | 66,040 – 16,843,255                   |
| `0xFB`     | 4                | 16,843,256 – 4,311,810,551            |
| `0xFC`     | 5                | 4,311,810,552 – 1,103,823,438,327     |
| `0xFD`     | 6                | 1,103,823,438,328 – 282,578,800,148,983 |
| `0xFE`     | 7                | 282,578,800,148,984 – `Number.MAX_SAFE_INTEGER` |

## Features

* Decode a bijou64 varint from a DataView or a Uint8Array
* Encode a bijou64 varint to a Uint8Array
* Supports integers between 0 and `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991)
* Structural canonicality: one encoding per value, no runtime canonicality check needed
* TypeScript types

## Usage

```typescript
import { encode, decode, encodedLen, MAX } from "bijou64"

// A number between 0 and MAX
const n = 1234

// Encode it to a Uint8Array
const encN = encode(n)

// Decode it
console.log(decode(encN))  // { value: 1234, usize: 3 }

// Get encoded byte length without allocating
console.log(encodedLen(n)) // 3
```

## Security Considerations

This software has not been audited. Please use at your sole discretion.

## License

This project is under the MIT license.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you shall be MIT licensed as above, without any additional terms or conditions.
