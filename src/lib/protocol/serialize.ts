export const PROTOCOL_VERSION = 0x01;
export const PACKET_TYPE_INIT = 0x00;
export const PACKET_TYPE_DATA = 0x01;

export interface InitMetadata {
    transferId: number;
    totalFileSize: number;
    blockSize: number;
    kBlocks: number;
    fountainSeed: number;
    sha256: Uint8Array;
    filename: string;
    isEncrypted: boolean;
    iv?: Uint8Array;
    salt?: Uint8Array;
}

export interface DataPayload {
    transferId: number;
    packetIndex: number;
    data: Uint8Array;
}

export function serializeInitPacket(meta: InitMetadata): Uint8Array {
    const encoder = new TextEncoder();
    const filenameBytes = encoder.encode(meta.filename);
    const filenameLen = Math.min(filenameBytes.length, 255);
    
    const encSize = meta.isEncrypted ? 1 + 12 + 16 : 1;
    // Size = 1(v) + 1(type) + 4(tid) + 4(size) + 2(bs) + 3(k) + 4(seed) + 32(hash) + encSize + 1(flen) + flen
    // = 51 + encSize + 1 + flen = 52 + encSize + flen
    const buffer = new Uint8Array(52 + encSize + filenameLen);
    const view = new DataView(buffer.buffer);
    
    buffer[0] = PROTOCOL_VERSION;
    buffer[1] = PACKET_TYPE_INIT;
    view.setUint32(2, meta.transferId, false); // big-endian
    view.setUint32(6, meta.totalFileSize, false);
    view.setUint16(10, meta.blockSize, false);
    // kBlocks is 3 bytes (uint24)
    buffer[12] = (meta.kBlocks >>> 16) & 0xFF;
    buffer[13] = (meta.kBlocks >>> 8) & 0xFF;
    buffer[14] = meta.kBlocks & 0xFF;
    
    view.setUint32(15, meta.fountainSeed, false);
    buffer.set(meta.sha256, 19);
    
    let offset = 51;
    if (meta.isEncrypted && meta.iv && meta.salt) {
        buffer[offset++] = 1;
        buffer.set(meta.iv, offset);
        offset += 12;
        buffer.set(meta.salt, offset);
        offset += 16;
    } else {
        buffer[offset++] = 0;
    }
    
    buffer[offset++] = filenameLen;
    buffer.set(filenameBytes.slice(0, filenameLen), offset);
    
    return buffer;
}

export function serializeDataPacket(payload: DataPayload): Uint8Array {
    const buffer = new Uint8Array(10 + payload.data.length);
    const view = new DataView(buffer.buffer);
    
    buffer[0] = PROTOCOL_VERSION;
    buffer[1] = PACKET_TYPE_DATA;
    view.setUint32(2, payload.transferId, false);
    view.setUint32(6, payload.packetIndex, false);
    buffer.set(payload.data, 10);
    
    return buffer;
}

export function deserializePacket(buffer: Uint8Array): { type: 'INIT', meta: InitMetadata } | { type: 'DATA', payload: DataPayload } | null {
    if (buffer.length < 6) return null;
    if (buffer[0] !== PROTOCOL_VERSION) return null;
    
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const packetType = buffer[1];
    const transferId = view.getUint32(2, false);
    
    if (packetType === PACKET_TYPE_INIT) {
        if (buffer.length < 52) return null;
        const totalFileSize = view.getUint32(6, false);
        const blockSize = view.getUint16(10, false);
        const kBlocks = (buffer[12] << 16) | (buffer[13] << 8) | buffer[14];
        const fountainSeed = view.getUint32(15, false);
        const sha256 = new Uint8Array(buffer.buffer, buffer.byteOffset + 19, 32);
        
        let offset = 51;
        const isEncrypted = buffer[offset++] === 1;
        let iv: Uint8Array | undefined;
        let salt: Uint8Array | undefined;
        
        if (isEncrypted) {
            if (buffer.length < offset + 28) return null; // 12 + 16
            iv = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, 12);
            offset += 12;
            salt = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, 16);
            offset += 16;
        }
        
        const filenameLen = buffer[offset++];
        
        let filename = "";
        if (buffer.length >= offset + filenameLen) {
            const decoder = new TextDecoder();
            filename = decoder.decode(new Uint8Array(buffer.buffer, buffer.byteOffset + offset, filenameLen));
        }
        
        return {
            type: 'INIT',
            meta: { transferId, totalFileSize, blockSize, kBlocks, fountainSeed, sha256: new Uint8Array(sha256), filename, isEncrypted, iv, salt }
        };
    } else if (packetType === PACKET_TYPE_DATA) {
        if (buffer.length < 10) return null;
        const packetIndex = view.getUint32(6, false);
        const data = new Uint8Array(buffer.buffer, buffer.byteOffset + 10, buffer.length - 10);
        return {
            type: 'DATA',
            payload: { transferId, packetIndex, data: new Uint8Array(data) }
        };
    }
    
    return null;
}
