import { describe, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { MIN, MAX, decode, encode, length, read } from '../src'

const VALID_LENGTHS = [1, 2, 4, 8] as const

const arbValidInt = fc.integer({ min: MIN, max: MAX })

const arbValidLengthForInt = arbValidInt.chain((n) => {
    const minLen = length(n)
    const validLens = (VALID_LENGTHS as readonly number[]).filter((l) => l >= minLen)
    return fc.constantFrom(...(validLens as [number, ...number[]])).map((l) => ({ n, len: l }))
})

describe('Round-trip properties', () => {
    test.prop([arbValidInt])('decode(encode(n)) === n', (n) => {
        const encoded = encode(n)
        const decoded = decode(encoded)
        expect(decoded.value).toBe(n)
    })

    test.prop([arbValidLengthForInt])('decode(encode(n, len)) === n for all valid lengths', ({ n, len }) => {
        const encoded = encode(n, len)
        const decoded = decode(encoded)
        expect(decoded.value).toBe(n)
        expect(decoded.usize).toBe(len)
    })

    test.prop([arbValidInt])('read and decode agree', (n) => {
        const encoded = encode(n)
        const decoded = decode(encoded)
        const view = new DataView(encoded.buffer)
        const readResult = read(view, 0)
        expect(readResult.value).toBe(decoded.value)
        expect(readResult.usize).toBe(decoded.usize)
    })

    test.prop([arbValidInt])('length(n) matches encode(n).length', (n) => {
        expect(encode(n).length).toBe(length(n))
    })

    test.prop([arbValidLengthForInt])('encode(n, len).length === len', ({ n, len }) => {
        expect(encode(n, len).length).toBe(len)
    })
})

describe('Boundary rejection', () => {
    test.prop([fc.integer({ min: MAX + 1, max: MAX + 10_000 })])('encode rejects values above MAX', (n) => {
        expect(() => encode(n)).toThrow()
    })

    test.prop([fc.integer({ min: -10_000, max: -1 })])('length rejects negative values', (n) => {
        expect(() => length(n)).toThrow()
    })
})

describe('Decode never silently corrupts', () => {
    test.prop([fc.uint8Array({ minLength: 1, maxLength: 8 })])('result is in range or throws', (bytes) => {
        try {
            const { value, usize } = decode(bytes)
            expect(value).toBeGreaterThanOrEqual(MIN)
            expect(value).toBeLessThanOrEqual(MAX)
            expect(VALID_LENGTHS).toContain(usize)
        } catch {
            // throwing is fine
        }
    })

    test.prop([
        fc.uint8Array({ minLength: 1, maxLength: 16 }).chain((bytes) =>
            fc.tuple(fc.constant(bytes), fc.integer({ min: 0, max: bytes.length - 1 })),
        ),
    ])('read result is in range or throws', ([bytes, offset]) => {
        const view = new DataView(bytes.buffer)
        try {
            const { value, usize } = read(view, offset)
            expect(value).toBeGreaterThanOrEqual(MIN)
            expect(value).toBeLessThanOrEqual(MAX)
            expect(VALID_LENGTHS).toContain(usize)
        } catch {
            // throwing is fine
        }
    })
})
