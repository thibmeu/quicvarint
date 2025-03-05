import { describe, it, expect } from 'vitest';
import { MIN, MAX, decode, encode, length } from '../src';
import vectors from './fixtures/vectors.json';

// Tests taken from https://github.com/quic-go/quic-go/blob/09bb613c6679ba130e950214a178ded510741578/quicvarint/varint_test.go
// There are no test vectors on RFC 9000
// This is to confirm the implementation is working as expected

// Tests for limits
describe('Limits', () => {
  it('should have correct MIN and MAX values', () => {
    expect(MIN).toBe(0);
    expect(MAX).toBe((1 << 30) - 1 + (1 << 30));
  });
});

const hex_decode = (s: string) =>
  Uint8Array.from(s.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));

const tests = vectors.map(v => ({
  ...v,
  bytes: hex_decode(v.bytes)
}))

// Tests for parsing
describe('Parsing', () => {
  tests.forEach(({ name, bytes: input, value: expected, length }) => {
    it(`should correctly parse ${name}`, () => {
      const result = decode(input);
      expect(result.value).toBe(expected);
      expect(result.usize).toBe(length);
    });
  });
});

// Tests for encoding
describe('Varint Encoding', () => {
  tests.forEach(({ name, value: input, bytes: expected, minimal_encoding, length }) => {
    it(`should correctly encode ${name}`, () => {
      if (minimal_encoding) {
        expect(encode(input)).toEqual(expected);
      }
      console.log(input, length, expected, encode(input, length))
      expect(encode(input, length)).toEqual(expected);
    });
  });

  it('should throw when encoding a too large number', () => {
    expect(() => encode(MAX + 1)).toThrow();
  });
});

// Tests for length
describe('Length', () => {
  tests.filter(t => t.minimal_encoding).forEach(({ name, value: input, length: expected }) => {
    it(`should return correct length for ${name}`, () => {
      expect(length(input)).toBe(expected);
    });
  });

  it('should throw on too large number', () => {
    expect(() => length(MAX + 1)).toThrow();
  });
});
