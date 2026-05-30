import { describe, expect, it } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { MIN, MAX, decode, encode, encodedLen, read } from '../src'

const arbValidInt = fc.integer({ min: MIN, max: MAX })

describe('Round-trip properties', () => {
    test.prop([arbValidInt])('decode(encode(n)) === n', (n) => {
        const encoded = encode(n)
        const decoded = decode(encoded)
        expect(decoded.value).toBe(n)
    })

    test.prop([arbValidInt])('read and decode agree', (n) => {
        const encoded = encode(n)
        const decoded = decode(encoded)
        const view = new DataView(encoded.buffer)
        const readResult = read(view, 0)
        expect(readResult.value).toBe(decoded.value)
        expect(readResult.usize).toBe(decoded.usize)
    })

    test.prop([arbValidInt])('encodedLen(n) matches encode(n).length', (n) => {
        expect(encode(n).length).toBe(encodedLen(n))
    })
})

describe('Boundary rejection', () => {
    it('encode rejects MAX + 1', () => {
        expect(() => encode(MAX + 1)).toThrow()
    })

    test.prop([fc.integer({ min: -10_000, max: -1 })])('encode rejects negative values', (n) => {
        expect(() => encode(n)).toThrow()
    })

    test.prop([fc.integer({ min: -10_000, max: -1 })])('encodedLen rejects negative values', (n) => {
        expect(() => encodedLen(n)).toThrow()
    })

    test.prop([fc.float({ noNaN: false, noDefaultInfinity: false }).filter((n) => !Number.isInteger(n) || !isFinite(n))])(
        'encode rejects non-integers and non-finite values',
        (n) => {
            expect(() => encode(n)).toThrow()
        },
    )
})

describe('Decode never silently corrupts', () => {
    test.prop([fc.uint8Array({ minLength: 1, maxLength: 9 })])('result is in range or throws', (bytes) => {
        try {
            const { value, usize } = decode(bytes)
            expect(value).toBeGreaterThanOrEqual(MIN)
            expect(value).toBeLessThanOrEqual(MAX)
            expect(usize).toBeGreaterThanOrEqual(1)
            expect(usize).toBeLessThanOrEqual(8)
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
            expect(usize).toBeGreaterThanOrEqual(1)
            expect(usize).toBeLessThanOrEqual(8)
        } catch {
            // throwing is fine
        }
    })
})
