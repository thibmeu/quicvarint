// Per-tier offsets: OFFSETS[t] is the first value that requires t additional bytes.
// Tier 0 values (0–247) are encoded as the byte itself (no offset arithmetic needed).
const OFFSETS = [
    0,                   // tier 0 (unused in arithmetic)
    248,                 // tier 1: 248
    504,                 // tier 2: 248 + 256
    66040,               // tier 3: 504 + 256²
    16843256,            // tier 4: 66040 + 256³
    4311810552,          // tier 5: 16843256 + 256⁴
    1103823438328,       // tier 6: 4311810552 + 256⁵
    282578800148984,     // tier 7: 1103823438328 + 256⁶
]

// Per-tier exclusive upper bounds. BOUNDS[t] == OFFSETS[t+1] for tiers 0–6.
// Tier 7 is capped at Number.MAX_SAFE_INTEGER + 1 (no BigInt support).
const BOUNDS = [
    248,                          // tier 0: 0–247
    504,                          // tier 1: 248–503
    66040,                        // tier 2: 504–66039
    16843256,                     // tier 3: 66040–16843255
    4311810552,                   // tier 4: 16843256–4311810551
    1103823438328,                // tier 5: 4311810552–1103823438327
    282578800148984,              // tier 6: 1103823438328–282578800148983
    Number.MAX_SAFE_INTEGER + 1,  // tier 7: 282578800148984–MAX_SAFE_INTEGER
]

const TAG_THRESHOLD = 248

export const MIN = 0
export const MAX = Number.MAX_SAFE_INTEGER

export const read = (input: DataView, offset: number): { value: number; usize: number } => {
    const remaining = input.byteLength - offset
    if (remaining < 1) {
        throw new Error('Need at least 1 byte')
    }

    const tag = input.getUint8(offset)

    if (tag < TAG_THRESHOLD) {
        return { value: tag, usize: 1 }
    }

    const tier = tag - TAG_THRESHOLD + 1
    if (tier > 7) {
        throw new Error(`Cannot decode number greater than ${MAX}`)
    }
    const usize = tier + 1

    if (remaining < usize) {
        throw new Error(`Need ${usize} bytes but only ${remaining} available`)
    }

    let payload = 0
    for (let i = 1; i < usize; i++) {
        payload = payload * 256 + input.getUint8(offset + i)
    }

    const value = payload + OFFSETS[tier]
    if (value > MAX) {
        throw new Error(`Cannot decode number greater than ${MAX}`)
    }

    return { value, usize }
}

export const decode = (input: Uint8Array): { value: number; usize: number } => {
    if (input.length === 0) {
        throw new Error('Need at least 1 byte')
    }

    const tag = input[0]

    if (tag < TAG_THRESHOLD) {
        return { value: tag, usize: 1 }
    }

    const tier = tag - TAG_THRESHOLD + 1
    if (tier > 7) {
        throw new Error(`Cannot decode number greater than ${MAX}`)
    }
    const usize = tier + 1

    if (input.length < usize) {
        throw new Error(`Need ${usize} bytes but only ${input.length} available`)
    }

    let payload = 0
    for (let i = 1; i < usize; i++) {
        payload = payload * 256 + input[i]
    }

    const value = payload + OFFSETS[tier]
    if (value > MAX) {
        throw new Error(`Cannot decode number greater than ${MAX}`)
    }

    return { value, usize }
}

export const encodedLen = (n: number): number => {
    if (!Number.isInteger(n)) {
        throw new Error('Value must be a finite integer')
    }
    if (n < MIN) {
        throw new Error('Cannot encode negative numbers')
    }
    if (n > MAX) {
        throw new Error('Number is too big')
    }

    for (let tier = 0; tier < BOUNDS.length; tier++) {
        if (n < BOUNDS[tier]) {
            return tier + 1
        }
    }

    throw new Error('Number is too big')
}

export const encode = (n: number): Uint8Array => {
    if (!Number.isInteger(n)) {
        throw new Error('Value must be a finite integer')
    }
    if (n < MIN) {
        throw new Error('Cannot encode negative numbers')
    }
    if (n > MAX) {
        throw new Error('Number is too big')
    }

    // Tiers 0–4: payload fits in 32 bits, use bitwise extraction via >>>.
    // Tiers 5–7: payload exceeds 32 bits, fall back to arithmetic.
    if (n < BOUNDS[0]) {
        const b = new Uint8Array(1)
        b[0] = n
        return b
    }
    if (n < BOUNDS[1]) {
        const b = new Uint8Array(2)
        b[0] = 0xf8; b[1] = n - OFFSETS[1]
        return b
    }
    if (n < BOUNDS[2]) {
        const p = n - OFFSETS[2]
        const b = new Uint8Array(3)
        b[0] = 0xf9; b[1] = (p >>> 8) & 0xff; b[2] = p & 0xff
        return b
    }
    if (n < BOUNDS[3]) {
        const p = n - OFFSETS[3]
        const b = new Uint8Array(4)
        b[0] = 0xfa; b[1] = (p >>> 16) & 0xff; b[2] = (p >>> 8) & 0xff; b[3] = p & 0xff
        return b
    }
    if (n < BOUNDS[4]) {
        const p = n - OFFSETS[4]  // max 0xFFFFFFFF, safe for >>>
        const b = new Uint8Array(5)
        b[0] = 0xfb; b[1] = (p >>> 24) & 0xff; b[2] = (p >>> 16) & 0xff; b[3] = (p >>> 8) & 0xff; b[4] = p & 0xff
        return b
    }

    // Tiers 5–7: payload exceeds 32 bits, must use arithmetic division.
    let tier = 5
    while (n >= BOUNDS[tier]) tier++
    const len = tier + 1
    const bytes = new Uint8Array(len)
    bytes[0] = TAG_THRESHOLD + tier - 1
    let payload = n - OFFSETS[tier]
    for (let i = len - 1; i >= 1; i--) {
        bytes[i] = payload % 256
        payload = Math.floor(payload / 256)
    }
    return bytes
}
