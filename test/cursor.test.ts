import { describe, it, expect } from 'vitest'
import { test, fc } from '@fast-check/vitest'
import { MIN, MAX, decode, encode, length, read, readFrom, tryReadFrom, writeTo } from '../src'
import type { Cursor } from '../src'

const cursor = (buf: Uint8Array, p = 0): Cursor => ({ buf, p })

describe('readFrom', () => {
    it('advances the cursor by the encoded length', () => {
        const c = cursor(new Uint8Array([...encode(1), ...encode(1000), ...encode(1_000_000)]))
        expect(readFrom(c)).toBe(1)
        expect(c.p).toBe(1)
        expect(readFrom(c)).toBe(1000)
        expect(c.p).toBe(3)
        expect(readFrom(c)).toBe(1_000_000)
        expect(c.p).toBe(7)
    })

    it('reads from a non-zero starting position', () => {
        const c = cursor(new Uint8Array([0xff, 0xff, ...encode(42)]), 2)
        expect(readFrom(c)).toBe(42)
        expect(c.p).toBe(3)
    })

    it('throws when the buffer ends mid-varint', () => {
        expect(() => readFrom(cursor(new Uint8Array([0x40])))).toThrow()
        expect(() => readFrom(cursor(new Uint8Array([])))).toThrow()
    })
})

describe('tryReadFrom', () => {
    it('returns undefined and does not advance when truncated', () => {
        const c = cursor(new Uint8Array([0x80, 0x00])) // 4-byte varint, only 2 present
        expect(tryReadFrom(c)).toBeUndefined()
        expect(c.p).toBe(0)
    })

    it('returns undefined on an empty remainder', () => {
        const c = cursor(new Uint8Array([0x01]), 1)
        expect(tryReadFrom(c)).toBeUndefined()
        expect(c.p).toBe(1)
    })

    it('throws on values above MAX -- malformed, not incomplete', () => {
        const c = cursor(new Uint8Array([0xc0, 0, 0, 0, 0x80, 0, 0, 0]))
        expect(() => tryReadFrom(c)).toThrow()
    })
})

describe('writeTo', () => {
    it('writes sequentially and advances', () => {
        const buf = new Uint8Array(16)
        const c = cursor(buf)
        writeTo(c, 1)
        writeTo(c, 1000)
        writeTo(c, 1_000_000)
        expect(c.p).toBe(7)

        const r = cursor(buf)
        expect(readFrom(r)).toBe(1)
        expect(readFrom(r)).toBe(1000)
        expect(readFrom(r)).toBe(1_000_000)
    })

    it('honours an explicit padded length', () => {
        const buf = new Uint8Array(8)
        writeTo(cursor(buf), 4, 8)
        expect(readFrom(cursor(buf))).toBe(4)
    })

    it('rejects a length too small for the value', () => {
        expect(() => writeTo(cursor(new Uint8Array(8)), 16384, 2)).toThrow()
    })
})

describe('8-byte varints above MAX are rejected, never wrapped', () => {
    const cases: Array<[string, Uint8Array]> = [
        ['2^31 (MAX + 1)', new Uint8Array([0xc0, 0, 0, 0, 0x80, 0, 0, 0])],
        ['2^32', new Uint8Array([0xc0, 0, 0, 0x01, 0, 0, 0, 0])],
        ['2^40', new Uint8Array([0xc0, 0, 0x01, 0, 0, 0, 0, 0])],
        ['5e9', new Uint8Array([0xc0, 0, 0, 0x01, 0x2a, 0x05, 0xf2, 0x00])],
        [
            '2^62 - 1 (all value bits set)',
            new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
        ],
    ]

    for (const [name, bytes] of cases) {
        it(`decode rejects ${name}`, () => expect(() => decode(bytes)).toThrow())
        it(`read rejects ${name}`, () =>
            expect(() => read(new DataView(bytes.buffer), 0)).toThrow())
        it(`readFrom rejects ${name}`, () => expect(() => readFrom(cursor(bytes))).toThrow())
        it(`tryReadFrom rejects ${name}`, () => expect(() => tryReadFrom(cursor(bytes))).toThrow())
    }
})

const arbVarintBytes = fc
    .tuple(fc.constantFrom(0b00, 0b01, 0b10, 0b11), fc.uint8Array({ minLength: 8, maxLength: 8 }))
    .map(([prefix, body]) => {
        const bytes = Uint8Array.from(body)
        bytes[0] = ((bytes[0] as number) & 0x3f) | (prefix << 6)
        return bytes
    })

describe('Structure-aware decode properties', () => {
    test.prop([arbVarintBytes], { numRuns: 5000 })(
        'every entry point is in range or throws',
        (bytes) => {
            for (const call of [
                () => decode(bytes).value,
                () => read(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0).value,
                () => readFrom(cursor(bytes)),
                () => tryReadFrom(cursor(bytes)),
            ]) {
                let value: number | undefined
                try {
                    value = call()
                } catch {
                    continue // throwing is a valid outcome
                }
                if (value === undefined) continue
                expect(value).toBeGreaterThanOrEqual(MIN)
                expect(value).toBeLessThanOrEqual(MAX)
            }
        },
    )

    test.prop([arbVarintBytes], { numRuns: 5000 })(
        'all four entry points agree on the same bytes',
        (bytes) => {
            const results = [
                () => decode(bytes).value,
                () => read(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0).value,
                () => readFrom(cursor(bytes)),
                () => tryReadFrom(cursor(bytes)),
            ].map((call) => {
                try {
                    return { ok: true as const, value: call() }
                } catch {
                    return { ok: false as const, value: undefined }
                }
            })
            expect(new Set(results.map((r) => `${r.ok}:${r.value}`)).size).toBe(1)
        },
    )
})

describe('Cursor round-trip properties', () => {
    const arbValidInt = fc.integer({ min: MIN, max: MAX })

    test.prop([fc.array(arbValidInt, { minLength: 1, maxLength: 32 })])(
        'writeTo then readFrom recovers the sequence',
        (values) => {
            const buf = new Uint8Array(values.reduce((n, v) => n + length(v), 0))
            const w = cursor(buf)
            for (const v of values) writeTo(w, v)
            expect(w.p).toBe(buf.length)

            const r = cursor(buf)
            for (const v of values) expect(readFrom(r)).toBe(v)
            expect(r.p).toBe(buf.length)
        },
    )

    test.prop([arbValidInt])('readFrom matches decode, and advances by usize', (n) => {
        const bytes = encode(n)
        const c = cursor(bytes)
        expect(readFrom(c)).toBe(decode(bytes).value)
        expect(c.p).toBe(decode(bytes).usize)
    })

    test.prop([arbValidInt, fc.integer({ min: 0, max: 8 })])(
        'tryReadFrom returns undefined for every truncation, then succeeds when complete',
        (n, cut) => {
            const bytes = encode(n)
            const short = bytes.subarray(0, Math.max(0, bytes.length - (cut % 8) - 1))
            if (short.length < bytes.length) {
                const c = cursor(short)
                expect(tryReadFrom(c)).toBeUndefined()
                expect(c.p).toBe(0)
            }
            expect(tryReadFrom(cursor(bytes))).toBe(n)
        },
    )
})
