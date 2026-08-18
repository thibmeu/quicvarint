const MAX_VARINT_1 = 0x3f
const MAX_VARINT_2 = 0x3fff
const MAX_VARINT_4 = 0x3fffffff
const MAX_VARINT_8 = 0x7fffffff // not going above 31-1 bits

export const MIN = 0
export const MAX = MAX_VARINT_8

const PREFIX_MASK = 0b0011_1111

export interface Cursor {
    buf: Uint8Array
    p: number
}

const assemble8 = (
    b0: number,
    b1: number,
    b2: number,
    b3: number,
    b4: number,
    b5: number,
    b6: number,
    b7: number,
): number => {
    if ((b0 & PREFIX_MASK) !== 0 || b1 !== 0 || b2 !== 0 || b3 !== 0 || b4 > 0x7f) {
        throw new Error(`Cannot decode number greater than ${MAX}`)
    }
    return (b4 << 24) | (b5 << 16) | (b6 << 8) | b7
}

const encodedLength = (firstByte: number): number => 1 << (firstByte >> 6)

const decodeAt = (buf: Uint8Array, off: number): number => {
    const b0 = buf[off] as number
    let value: number
    switch (b0 >> 6) {
        case 0b00:
            value = b0 & PREFIX_MASK
            break
        case 0b01:
            value = ((b0 & PREFIX_MASK) << 8) | (buf[off + 1] as number)
            break
        case 0b10:
            value =
                ((b0 & PREFIX_MASK) << 24) |
                ((buf[off + 1] as number) << 16) |
                ((buf[off + 2] as number) << 8) |
                (buf[off + 3] as number)
            break
        default:
            value = assemble8(
                b0,
                buf[off + 1] as number,
                buf[off + 2] as number,
                buf[off + 3] as number,
                buf[off + 4] as number,
                buf[off + 5] as number,
                buf[off + 6] as number,
                buf[off + 7] as number,
            )
    }
    return value
}

const encodeAt = (buf: Uint8Array, off: number, n: number, len: number): void => {
    const BYTE = 0b1111_1111
    switch (len) {
        case 1:
            buf[off] = 0b0000_0000 | (n & PREFIX_MASK)
            return
        case 2:
            buf[off] = 0b0100_0000 | ((n >> 8) & PREFIX_MASK)
            buf[off + 1] = n & BYTE
            return
        case 4:
            buf[off] = 0b1000_0000 | ((n >> 24) & PREFIX_MASK)
            buf[off + 1] = (n >> 16) & BYTE
            buf[off + 2] = (n >> 8) & BYTE
            buf[off + 3] = n & BYTE
            return
        case 8:
            buf[off] = 0b1100_0000
            buf[off + 1] = 0
            buf[off + 2] = 0
            buf[off + 3] = 0
            buf[off + 4] = (n >> 24) & BYTE
            buf[off + 5] = (n >> 16) & BYTE
            buf[off + 6] = (n >> 8) & BYTE
            buf[off + 7] = n & BYTE
            return
        default:
            throw new Error('Invalid length')
    }
}

export const length = (n: number): number => {
    if (n < MIN) {
        throw new Error('Cannot encode negative numbers')
    }
    if (n > MAX) {
        throw new Error('Number is too big')
    }

    if (n > MAX_VARINT_4) {
        return 8
    }
    if (n > MAX_VARINT_2) {
        return 4
    }
    if (n > MAX_VARINT_1) {
        return 2
    }
    return 1
}

export const decode = (input: Uint8Array): { value: number; usize: number } => {
    const b0 = input[0]
    if (b0 === undefined) {
        throw new Error('There should be bytes in the array')
    }
    const usize = encodedLength(b0)
    if (input.length < usize) {
        throw new Error(`There should be ${usize} bytes or more in the array`)
    }
    return { value: decodeAt(input, 0), usize }
}

// implemented using https://www.rfc-editor.org/rfc/rfc9000.html#name-sample-variable-length-inte
export const read = (input: DataView, offset: number): { value: number; usize: number } => {
    const remaining = input.byteLength - offset
    if (remaining < 1) {
        throw new Error('Need at least 1 byte')
    }
    const usize = encodedLength(input.getUint8(offset))
    if (remaining < usize) {
        throw new Error(`Need ${usize} bytes but only ${remaining} available`)
    }

    const b0 = input.getUint8(offset)
    let value: number
    switch (b0 >> 6) {
        case 0b00:
            value = b0 & PREFIX_MASK
            break
        case 0b01:
            value = ((b0 & PREFIX_MASK) << 8) | input.getUint8(offset + 1)
            break
        case 0b10:
            value =
                ((b0 & PREFIX_MASK) << 24) |
                (input.getUint8(offset + 1) << 16) |
                (input.getUint8(offset + 2) << 8) |
                input.getUint8(offset + 3)
            break
        default:
            value = assemble8(
                b0,
                input.getUint8(offset + 1),
                input.getUint8(offset + 2),
                input.getUint8(offset + 3),
                input.getUint8(offset + 4),
                input.getUint8(offset + 5),
                input.getUint8(offset + 6),
                input.getUint8(offset + 7),
            )
    }
    return { value, usize }
}

export const encode = (n: number, len?: number): Uint8Array => {
    const minLen = length(n)
    if (len === undefined) {
        len = minLen
    } else if (len < minLen) {
        throw new Error(`Length ${len} insufficient for value ${n}, need at least ${minLen}`)
    }

    const bytes = new Uint8Array(len)
    encodeAt(bytes, 0, n, len)
    return bytes
}

export const readFrom = (c: Cursor): number => {
    const { buf, p } = c
    const b0 = buf[p]
    if (b0 === undefined) {
        throw new Error('There should be bytes in the array')
    }
    const usize = encodedLength(b0)
    if (buf.length - p < usize) {
        throw new Error(`There should be ${usize} bytes or more in the array`)
    }
    const value = decodeAt(buf, p)
    c.p = p + usize
    return value
}

export const tryReadFrom = (c: Cursor): number | undefined => {
    const { buf, p } = c
    const b0 = buf[p]
    if (b0 === undefined) {
        return undefined
    }
    const usize = encodedLength(b0)
    if (buf.length - p < usize) {
        return undefined
    }
    const value = decodeAt(buf, p)
    c.p = p + usize
    return value
}

export const writeTo = (c: Cursor, n: number, len?: number): void => {
    const minLen = length(n)
    if (len === undefined) {
        len = minLen
    } else if (len < minLen) {
        throw new Error(`Length ${len} insufficient for value ${n}, need at least ${minLen}`)
    }
    if (c.buf.length - c.p < len) {
        throw new Error(`Need ${len} bytes but only ${c.buf.length - c.p} available`)
    }
    encodeAt(c.buf, c.p, n, len)
    c.p += len
}
