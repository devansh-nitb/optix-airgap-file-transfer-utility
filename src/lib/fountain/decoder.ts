import { FountainEncoder } from './encoder';
import type { FountainPacket } from './encoder';
import { RobustSoliton } from './distribution';

export class FountainDecoder {
    private K: number;
    private blockSize: number;
    private seed: number;
    private distribution: RobustSoliton;
    private decoded: (Uint8Array | null)[];
    private decodedCount: number = 0;
    private buffer: { remainingIndices: Set<number>, data: Uint8Array }[] = [];
    private packetsReceived: number = 0;

    constructor(K: number, blockSize: number, seed: number) {
        this.K = K;
        this.blockSize = blockSize;
        this.seed = seed;
        this.distribution = new RobustSoliton(K);
        this.decoded = new Array(K).fill(null);
    }

    isComplete(): boolean {
        return this.decodedCount === this.K;
    }
    
    getDecodedCount(): number {
        return this.decodedCount;
    }

    receivePacket(packet: FountainPacket) {
        if (this.isComplete()) return;
        this.packetsReceived++;

        const neighbors = FountainEncoder.getNeighbors(this.seed, packet.packet_index, this.K, this.distribution);
        
        let remainingIndices = new Set(neighbors);
        let xorData = new Uint8Array(packet.data);

        // Process against already decoded blocks
        for (const idx of Array.from(remainingIndices)) {
            if (this.decoded[idx] !== null) {
                const decodedBlock = this.decoded[idx]!;
                for (let i = 0; i < this.blockSize; i++) {
                    xorData[i] ^= decodedBlock[i];
                }
                remainingIndices.delete(idx);
            }
        }

        if (remainingIndices.size === 0) {
            return; // Redundant packet
        }

        this.buffer.push({ remainingIndices, data: xorData });
        this.peel();
        
        // Prune fully resolved from buffer every 10 packets to save memory/iteration time
        if (this.packetsReceived % 10 === 0) {
            this.buffer = this.buffer.filter(p => p.remainingIndices.size > 0);
        }

        // GF(2) fallback if stalled
        // trigger if we have K * 1.5 packets and no progress, or just check periodically
        if (this.packetsReceived > this.K && this.packetsReceived % 10 === 0 && !this.isComplete()) {
            this.runGF2();
        }
    }

    private peel() {
        let ripple: number[] = [];

        for (const p of this.buffer) {
            if (p.remainingIndices.size === 1) {
                const idx = Array.from(p.remainingIndices)[0];
                if (this.decoded[idx] === null) {
                    this.decoded[idx] = new Uint8Array(p.data);
                    this.decodedCount++;
                    ripple.push(idx);
                }
            }
        }

        while (ripple.length > 0) {
            const newlyDecodedIdx = ripple.pop()!;
            const decodedBlock = this.decoded[newlyDecodedIdx]!;

            for (const p of this.buffer) {
                if (p.remainingIndices.has(newlyDecodedIdx)) {
                    for (let i = 0; i < this.blockSize; i++) {
                        p.data[i] ^= decodedBlock[i];
                    }
                    p.remainingIndices.delete(newlyDecodedIdx);

                    if (p.remainingIndices.size === 1) {
                        const idx = Array.from(p.remainingIndices)[0];
                        if (this.decoded[idx] === null) {
                            this.decoded[idx] = new Uint8Array(p.data);
                            this.decodedCount++;
                            ripple.push(idx);
                        }
                    }
                }
            }
        }
    }

    private runGF2() {
        const unknownIndices = [];
        for (let i = 0; i < this.K; i++) {
            if (this.decoded[i] === null) {
                unknownIndices.push(i);
            }
        }
        
        if (unknownIndices.length === 0) return;

        const activePackets = this.buffer.filter(p => p.remainingIndices.size > 0);
        if (activePackets.length < unknownIndices.length) return; 
        
        const M: number[][] = [];
        const payloadBytes: Uint8Array[] = [];
        
        for (const p of activePackets) {
            const row = new Array(unknownIndices.length).fill(0);
            for (let c = 0; c < unknownIndices.length; c++) {
                if (p.remainingIndices.has(unknownIndices[c])) {
                    row[c] = 1;
                }
            }
            M.push(row);
            payloadBytes.push(new Uint8Array(p.data));
        }

        const rows = M.length;
        const cols = unknownIndices.length;
        let r = 0;
        
        for (let c = 0; c < cols && r < rows; c++) {
            let pivotRow = r;
            while (pivotRow < rows && M[pivotRow][c] === 0) {
                pivotRow++;
            }
            if (pivotRow === rows) continue; 
            
            if (pivotRow !== r) {
                const temp = M[r]; M[r] = M[pivotRow]; M[pivotRow] = temp;
                const tempP = payloadBytes[r]; payloadBytes[r] = payloadBytes[pivotRow]; payloadBytes[pivotRow] = tempP;
            }
            
            for (let i = r + 1; i < rows; i++) {
                if (M[i][c] === 1) {
                    for (let j = c; j < cols; j++) {
                        M[i][j] ^= M[r][j];
                    }
                    for (let b = 0; b < this.blockSize; b++) {
                        payloadBytes[i][b] ^= payloadBytes[r][b];
                    }
                }
            }
            r++;
        }
        
        if (r < cols) return; 
        
        for (let i = cols - 1; i >= 0; i--) {
            for (let j = i - 1; j >= 0; j--) {
                if (M[j][i] === 1) {
                    M[j][i] = 0;
                    for (let b = 0; b < this.blockSize; b++) {
                        payloadBytes[j][b] ^= payloadBytes[i][b];
                    }
                }
            }
            const idx = unknownIndices[i];
            if (this.decoded[idx] === null) {
                this.decoded[idx] = payloadBytes[i];
                this.decodedCount++;
            }
        }
        
        this.buffer = [];
    }

    getReconstructedData(totalSize: number): Uint8Array {
        if (!this.isComplete()) throw new Error("Not complete");
        const out = new Uint8Array(totalSize);
        let offset = 0;
        for (let i = 0; i < this.K; i++) {
            const block = this.decoded[i]!;
            const len = Math.min(this.blockSize, totalSize - offset);
            out.set(block.slice(0, len), offset);
            offset += len;
        }
        return out;
    }
}
