# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-18

### Added

- `Cursor` interface (`{ buf, p }`) and `readFrom`, `tryReadFrom`, `writeTo` for reading and writing varints in place. They return a bare number and advance the cursor rather than allocating a subarray and a result object per call, which is 2.7-3.9x faster for parsers reading a run of varints. `tryReadFrom` returns `undefined` on a truncated varint, for incremental parsers where a short read is expected rather than an error. `writeTo` throws if the cursor's buffer is too small to hold the varint, rather than letting the out-of-range writes drop silently and advancing `p` past the end

### Fixed

- `read()` now rejects 8-byte varints above `MAX`. It previously assembled them with 32-bit shifts and returned a wrapped value, which could be negative — `[0xc0, 0, 0, 0, 0x80, 0, 0, 0]` returned `-2147483648`. `decode()` was already bounded (0.1.6); `read()` was missed

### Changed

- All entry points share one decode and one encode implementation

## [0.1.7] - 2026-06-06

### Added

- Property-based fuzz tests using fast-check covering round-trip, boundary, and corruption properties

### Changed

- Switched build tooling from tsup to tsdown
- Bumped dev dependencies

## [0.1.6] - 2026-03-09

### Fixed

- Bounds check in `read()` for truncated varints
- Integer overflow in `decode()` for 8-byte values exceeding MAX
- Length validation in `encode()` when explicit `len` is too small for value

## [0.1.5] - 2026-03-09

### Added

- Trusted publisher workflow for npm releases
- prettier for code formatting

### Changed

- Bumped all npm dependencies

## [0.1.4] - 2025-03-05

### Changed

- `encode` can take an optional length parameter
- `decode` and `encode` performance improved by inlining byte operations

## [0.1.3] - 2025-02-28

### Changed

- `decode` now takes a `Uint8Array` instead of a `ArrayBufferLike`

### Fixed

- Remove .github from npm package

## [0.1.2] - 2025-02-28

### Fixed

- Typo in readme

## [0.1.1] - 2025-02-28

### Fixed

- Build was broken as dist folder was ignored

## [0.1.0] - 2025-02-28

### Added

- Package created
- vitest tests taken from [quic-go/quicvarint implementation](https://github.com/quic-go/quic-go/blob/09bb613c6679ba130e950214a178ded510741578/quicvarint/varint.go)
- vitest benchmarks
- eslint
- cjs, esm, and types for the package
- README and LICENSE
