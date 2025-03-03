const MAX_VARINT_1 = 0x3f
const MAX_VARINT_2 = 0x3fff
const MAX_VARINT_4 = 0x3fffffff
const MAX_VARINT_8 = 0x7fffffff // not going above 31-1 bits

export const MIN = 0
export const MAX = MAX_VARINT_8

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
    let v = b & 0b00111111;

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
    return read(new DataView(input.buffer), 0)
};

export const encodeWithLength = (n: number, len: number): Uint8Array => {
    if (n > MAX) {
        throw new Error("Number is too big")
    }

    let prefix
    switch (len) {
        case 1:
            prefix = 0b00
            break
        case 2:
            prefix = 0b01
            break
        case 4:
            prefix = 0b10
            break
        case 8:
            prefix = 0b11
            break
        default:
            throw new Error('Invalid length')
    }

    // First byte contains the prefix in the 2-MSB and part of n
    const bytes = new Uint8Array(len);
    bytes[0] = (prefix << 6) | ((n >> ((len - 1) * 8)) & 0b00111111);

    for (let i = 1; i < bytes.length; i++) {
        // we could use bytes.set([value], i), but there are clear performance penalties
        // eslint-disable-next-line security/detect-object-injection
        bytes[i] = (n >> ((len - 1 - i) * 8)) & 0xff;
    }

    return bytes;
};

export const encode = (n: number): Uint8Array => {
    return encodeWithLength(n, length(n))
}

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
