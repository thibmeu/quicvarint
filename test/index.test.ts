import { describe, it, expect } from 'vitest'
import { MIN, MAX, decode, encode, encodedLen, read } from '../src'
import vectors from './fixtures/vectors.json'

// Tests taken from https://github.com/inkandswitch/bijou/blob/main/bijou64/src/lib.rs#L1446-L1500

describe('Limits', () => {
    it('should have correct MIN and MAX values', () => {
        expect(MIN).toBe(0)
        expect(MAX).toBe(Number.MAX_SAFE_INTEGER)
    })
})

const hex_decode = (s: string): Uint8Array => {
    const matches = s.match(/.{1,2}/g)
    return Uint8Array.from(matches ?? [], (b) => parseInt(b, 16))
}

const tests = vectors.map((v) => ({
    ...v,
    bytes: hex_decode(v.bytes),
}))

describe('Parsing', () => {
    tests.forEach(({ name, bytes: input, value: expected, length }) => {
        it(`should correctly parse ${name}`, () => {
            const result = decode(input)
            expect(result.value).toBe(expected)
            expect(result.usize).toBe(length)
        })
    })
})

describe('Encoding', () => {
    tests.forEach(({ name, value: input, bytes: expected }) => {
        it(`should correctly encode ${name}`, () => {
            expect(encode(input)).toEqual(expected)
        })
    })

    it('should throw when encoding a number above MAX', () => {
        expect(() => encode(MAX + 1)).toThrow()
    })

    it('should throw when encoding a negative number', () => {
        expect(() => encode(-1)).toThrow()
    })

    it('should throw when encoding a non-integer', () => {
        expect(() => encode(1.5)).toThrow('Value must be a finite integer')
        expect(() => encode(248.9)).toThrow('Value must be a finite integer')
        expect(() => encode(NaN)).toThrow('Value must be a finite integer')
    })
})

describe('encodedLen', () => {
    tests.forEach(({ name, value: input, length: expected }) => {
        it(`should return correct length for ${name}`, () => {
            expect(encodedLen(input)).toBe(expected)
        })
    })

    it('should throw on too large number', () => {
        expect(() => encodedLen(MAX + 1)).toThrow()
    })

    it('should throw on negative number', () => {
        expect(() => encodedLen(-1)).toThrow()
    })

    it('should throw on non-integer', () => {
        expect(() => encodedLen(1.5)).toThrow('Value must be a finite integer')
        expect(() => encodedLen(NaN)).toThrow('Value must be a finite integer')
    })
})

describe('Read', () => {
    tests.forEach(({ name, bytes, value: expected, length: expectedLength }) => {
        it(`should correctly read ${name}`, () => {
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
            const result = read(view, 0)
            expect(result.value).toBe(expected)
            expect(result.usize).toBe(expectedLength)
        })
    })

    it('should read from non-zero offset', () => {
        // padding byte + tier-1 encoding of 300: [0xF8, 0x34]
        const data = new Uint8Array([0xff, 0xf8, 0x34])
        const view = new DataView(data.buffer)
        const result = read(view, 1)
        expect(result.value).toBe(300)
        expect(result.usize).toBe(2)
    })

    it('should throw on empty buffer', () => {
        const view = new DataView(new Uint8Array([]).buffer)
        expect(() => read(view, 0)).toThrow()
    })

    it('should throw on truncated tier-1 (tag 0xF8 with no payload)', () => {
        const view = new DataView(new Uint8Array([0xf8]).buffer)
        expect(() => read(view, 0)).toThrow()
    })

    it('should throw on truncated tier-2 (tag 0xF9 with only 1 payload byte)', () => {
        const view = new DataView(new Uint8Array([0xf9, 0x00]).buffer)
        expect(() => read(view, 0)).toThrow()
    })

    it('should throw on tag 0xFF (tier 8, exceeds safe integer range)', () => {
        const data = new Uint8Array([0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
        const view = new DataView(data.buffer)
        expect(() => read(view, 0)).toThrow()
    })
})

describe('Decode edge cases', () => {
    it('should throw on empty input', () => {
        expect(() => decode(new Uint8Array([]))).toThrow()
    })

    it('should throw on tag 0xFF (tier 8, exceeds safe integer range)', () => {
        const data = new Uint8Array([0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
        expect(() => decode(data)).toThrow()
    })

    it('should throw on tier-7 value exceeding MAX_SAFE_INTEGER', () => {
        // Encode a tier-7 value whose decoded result would exceed Number.MAX_SAFE_INTEGER
        // tag 0xFE + payload = (MAX_SAFE_INTEGER + 1) - OFFSETS[7] = 9007199254740992 - 282578800148984 = 8724620454592008
        // in 7 bytes big-endian: we just use all-0xFF which decodes way above MAX
        const data = new Uint8Array([0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
        expect(() => decode(data)).toThrow()
    })
})
