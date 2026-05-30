import { describe, bench } from 'vitest'
import { decode, encode, read } from '../src'

const tests = [
    { name: 'tier 0 (1B)', max: 247 },
    { name: 'tier 1 (2B)', max: 503 },
    { name: 'tier 2 (3B)', max: 66039 },
    { name: 'tier 3 (4B)', max: 16843255 },
    { name: 'tier 7 (8B)', max: 9007199254740991 },
]

const randomValues = (num: number, maxValue: number) => {
    const values: { v: number; b: Uint8Array }[] = []
    for (let i = 0; i < num; i++) {
        const v = Math.floor(Math.random() * maxValue)
        values.push({ v, b: encode(v) })
    }
    return values
}

describe('Benchmarking 1024 read', () => {
    tests.forEach(({ name, max }) => {
        const inputs = randomValues(1024, max).map((v) => new DataView(v.b.buffer))
        bench(name, () => {
            for (const input of inputs) {
                read(input, 0)
            }
        })
    })
})

describe('Benchmarking 1024 encode', () => {
    tests.forEach(({ name, max }) => {
        const inputs = randomValues(1024, max)
        bench(name, () => {
            for (const input of inputs) {
                encode(input.v)
            }
        })
    })
})

describe('Benchmarking 1024 decode', () => {
    tests.forEach(({ name, max }) => {
        const inputs = randomValues(1024, max)
        bench(name, () => {
            for (const input of inputs) {
                decode(input.b)
            }
        })
    })
})
