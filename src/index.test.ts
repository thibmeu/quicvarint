import { describe, it, expect } from 'vitest';
import { MIN, MAX, decode, encode, length } from '.';

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

// Tests for parsing
describe('Parsing', () => {
  const tests = [
    { name: '1 byte', input: new Uint8Array([0b00011001]), expected: 25 },
    { name: '2 byte', input: new Uint8Array([0b01111011, 0xbd]), expected: 15293 },
    { name: '4 byte', input: new Uint8Array([0b10011101, 0x7f, 0x3e, 0x7d]), expected: 494878333 },
    { name: '8 byte', input: new Uint8Array([0b11000011, 0x21, 0x43, 0x21, 0x43, 0x21, 0x43, 0x21]), expected: 1126253345 },
  ];

  tests.forEach(({ name, input, expected }) => {
    it(`should correctly parse ${name}`, () => {
      const result = decode(input);
      console.log([...encode(expected)].map(s => s.toString(16)))
      expect(result.value).toBe(expected);
    });
  });
});

// Tests for encoding
describe('Varint Encoding', () => {
  const tests = [
    { name: '1 byte number', value: 37, expected: new Uint8Array([0x25]) },
    { name: 'maximum 1 byte number', value: 0x3f, expected: new Uint8Array([0b00111111]) },
    { name: 'minimum 2 byte number', value: 64, expected: new Uint8Array([0x40, 0x40]) },
    { name: '2 byte number', value: 15293, expected: new Uint8Array([0b01000000 ^ 0x3b, 0xbd]) },
    { name: 'maximum 2 byte number', value: 0x3fff, expected: new Uint8Array([0b01111111, 0xff]) },
    { name: 'minimum 4 byte number', value: 0x4000, expected: new Uint8Array([0b10000000, 0, 0x40, 0]) },
    { name: '4 byte number', value: 494878333, expected: new Uint8Array([0b10000000 ^ 0x1d, 0x7f, 0x3e, 0x7d]) },
    { name: 'maximum 4 byte number', value: 0x3fffffff, expected: new Uint8Array([0b10111111, 0xff, 0xff, 0xff]) },
    { name: 'minimum 8 byte number', value: 0x40000000, expected: new Uint8Array([0b11000000, 0, 0, 0, 0x40, 0, 0, 0]) },
    { name: '8 byte number', value: 1126253345, expected: new Uint8Array([0b11000011, 0x21, 0x43, 0x21, 0x43, 0x21, 0x43, 0x21]) },
  ];

  tests.forEach(({ name, value, expected }) => {
    it(`should correctly encode ${name}`, () => {
      expect(encode(value)).toEqual(expected);
    });
  });

  it('should throw when encoding a too large number', () => {
    expect(() => encode(MAX + 1)).toThrow();
  });
});

// Tests for length
describe('Length', () => {
  const tests = [
    { name: 'zero', input: 0, expected: 1 },
    { name: 'max 1 byte', input: 0x3f, expected: 1 },
    { name: 'min 2 bytes', input: 0x40, expected: 2 },
    { name: 'max 2 bytes', input: 0x3fff, expected: 2 },
    { name: 'min 4 bytes', input: 0x4000, expected: 4 },
    { name: 'max 4 bytes', input: 0x3fffffff, expected: 4 },
    { name: 'min 8 bytes', input: 0x40000000, expected: 8 },
    { name: 'max 8 bytes', input: MAX, expected: 8 },
  ];

  tests.forEach(({ name, input, expected }) => {
    it(`should return correct length for ${name}`, () => {
      expect(length(input)).toBe(expected);
    });
  });

  it('should throw on too large number', () => {
    expect(() => length(MAX + 1)).toThrow();
  });
});
