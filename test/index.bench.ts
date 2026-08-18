import { describe, bench } from 'vitest'
import { decode, encode, read, readFrom, tryReadFrom, writeTo } from '../src'

// Tests taken from https://github.com/quic-go/quic-go/blob/09bb613c6679ba130e950214a178ded510741578/quicvarint/varint_test.go
// There are no test vectors on RFC 9000
// This is to confirm the implementation is working as expected

const MAX_VARINT_1 = 0x3f
const MAX_VARINT_2 = 0x3fff
const MAX_VARINT_4 = 0x3fffffff
const MAX_VARINT_8 = 0x7fffffff

const tests = [
    { name: '1 byte', input: MAX_VARINT_1 },
    { name: '2 byte', input: MAX_VARINT_2 },
    { name: '4 byte', input: MAX_VARINT_4 },
    { name: '8 byte', input: MAX_VARINT_8 },
]

const randomValues = (num: number, maxValue: number) => {
    const values = new Array<{ v: number; b: Uint8Array }>()
    for (let i = 0; i < num; i++) {
        const v = Math.floor(Math.random() * maxValue)
        values.push({ v, b: encode(v) })
    }
    return values
}

describe('Benchmarking 1024 read', () => {
    tests.forEach(({ name, input }) => {
        const inputs = randomValues(1024, input).map((v) => new DataView(v.b.buffer))
        bench(name, () => {
            for (const input of inputs) {
                read(input, 0)
            }
        })
    })
})

describe('Benchmarking 1024 encode', () => {
    tests.forEach(({ name, input }) => {
        const inputs = randomValues(1024, input)
        bench(name, () => {
            for (const input of inputs) {
                encode(input.v)
            }
        })
    })
})

describe('Benchmarking 1024 decode', () => {
    tests.forEach(({ name, input }) => {
        const inputs = randomValues(1024, input)
        bench(name, () => {
            for (const input of inputs) {
                decode(input.b)
            }
        })
    })
})

describe('Benchmarking sequential parse of 1024 varints', () => {
    tests.forEach(({ name, input }) => {
        const values = randomValues(1024, input)
        const total = values.reduce((n, v) => n + v.b.length, 0)
        const buf = new Uint8Array(total)
        let off = 0
        for (const v of values) {
            buf.set(v.b, off)
            off += v.b.length
        }

        bench(`${name} - decode + subarray`, () => {
            let p = 0
            while (p < buf.length) {
                p += decode(buf.subarray(p)).usize
            }
        })

        bench(`${name} - readFrom cursor`, () => {
            const c = { buf, p: 0 }
            while (c.p < buf.length) {
                readFrom(c)
            }
        })

        bench(`${name} - tryReadFrom cursor`, () => {
            const c = { buf, p: 0 }
            while (c.p < buf.length) {
                tryReadFrom(c)
            }
        })
    })
})

describe('Benchmarking sequential write of 1024 varints', () => {
    tests.forEach(({ name, input }) => {
        const values = randomValues(1024, input).map((v) => v.v)
        const out = new Uint8Array(values.length * 8)

        bench(`${name} - encode + copy`, () => {
            let p = 0
            for (const v of values) {
                const b = encode(v)
                out.set(b, p)
                p += b.length
            }
        })

        bench(`${name} - writeTo cursor`, () => {
            const c = { buf: out, p: 0 }
            for (const v of values) {
                writeTo(c, v)
            }
        })
    })
})
