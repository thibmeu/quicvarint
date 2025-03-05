const MAX_VARINT_1 = 0x3f
const MAX_VARINT_2 = 0x3fff
const MAX_VARINT_4 = 0x3fffffff
const MAX_VARINT_8 = 0x7fffffff // not going above 31-1 bits

export const MIN = 0
export const MAX = MAX_VARINT_8

const PREFIX_MASK = 0b0011_1111

// implemented using https://www.rfc-editor.org/rfc/rfc9000.html#name-sample-variable-length-inte
export const read = (input: DataView, offset: number): { value: number; usize: number } => {
    // v = data.next_byte()
    const b = input.getUint8(offset);
    offset += 1;

    // prefix = v >> 6
    const prefix = b >> 6;
    // length = 1 << prefix
    const length = 1 << prefix;

    // v = v & 0x3f
    let v = b & PREFIX_MASK;

    // repeat length-1 times:
    for (let i = 0; i < length - 1; i += 1) {
        // v = (v << 8) + data.next_byte()
        v = (v << 8) + input.getUint8(offset);
        offset += 1;
    }
    // return v
    return { value: v, usize: length };
};

export const decode = (input: Uint8Array): { value: number; usize: number } => {
    if (input.length === 0) {
        throw new Error('There should be bytes in the array')
    }
    const prefix = input[0] >> 6
    switch (prefix) {
        case 0b00: {
            const value = input[0] & PREFIX_MASK
            return { value, usize: 1 }
        }
        case 0b01: {
            if (input.length < 2) {
                throw new Error('There should be 2 bytes or more in the array')
            }

            const value =
                ((input[0] & PREFIX_MASK) << 8) |
                input[1]
            return { value, usize: 2 }
        }
        case 0b10: {
            if (input.length < 4) {
                throw new Error('There should be 4 bytes or more in the array')
            }

            const value =
                ((input[0] & PREFIX_MASK) << 24) |
                (input[1] << 16) |
                (input[2] << 8) |
                input[3]
            return { value, usize: 4 }
        }
        case 0b11: {
            if (input.length < 8) {
                throw new Error('There should be 8 bytes or more in the array')
            }

            const value =
                (input[4] << 24) |
                (input[5] << 16) |
                (input[6] << 8) |
                input[7]
            return { value, usize: 8 }
        }
    }
    throw new Error('Invalid prefix')
};

export const encode = (n: number, len = length(n)): Uint8Array => {
    if (n > MAX) {
        throw new Error("Number is too big")
    }

    const bytes = new Uint8Array(len);
    const BYTE = 0b1111_1111
    switch (len) {
        case 1:
            bytes[0] = 0b0000_0000 | (n & PREFIX_MASK)
            break
        case 2:
            bytes[0] = 0b0100_0000 | (n >> 8 & PREFIX_MASK)
            bytes[1] = n & BYTE
            break
        case 4:
            bytes[0] = 0b1000_0000 | (n >> 24 & PREFIX_MASK)
            bytes[1] = n >> 16 & BYTE
            bytes[2] = n >> 8 & BYTE
            bytes[3] = n & BYTE
            break
        case 8:
            bytes[0] = 0b1100_0000
            // bytes[1] = 0 // only 32-bit integer
            // bytes[2] = 0
            // bytes[3] = 0
            bytes[4] = n >> 24 & BYTE
            bytes[5] = n >> 16 & BYTE
            bytes[6] = n >> 8 & BYTE
            bytes[7] = n & BYTE
            break
        default:
            throw new Error('Invalid length')
    }

    return bytes;
};

export const length = (n: number): number => {
    if (n < MIN) {
        throw new Error('Cannot encode negative numbers');
    }
    if (n > MAX) {
        throw new Error("Number is too big")
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
