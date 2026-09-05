import { mix32, Mulberry32 } from './prng';
import { RobustSoliton } from './distribution';

export interface FountainPacket {
    packet_index: number;
    data: Uint8Array;
}

export class FountainEncoder {
    private blocks: Uint8Array[];
    private K: number;
    private blockSize: number;
    private seed: number;
    private distribution: RobustSoliton;
    private packetIndex: number = 0;

    constructor(fileData: Uint8Array, blockSize: number, seed: number) {
        this.blockSize = blockSize;
        this.K = Math.max(1, Math.ceil(fileData.length / blockSize));
        this.seed = seed >>> 0;
        this.blocks = [];
        
        for (let i = 0; i < this.K; i++) {
            const start = i * blockSize;
            const end = Math.min(start + blockSize, fileData.length);
            const block = new Uint8Array(blockSize); // zero-padded automatically
            block.set(fileData.slice(start, end));
            this.blocks.push(block);
        }

        this.distribution = new RobustSoliton(this.K);
    }

    getK(): number { return this.K; }
    getBlockSize(): number { return this.blockSize; }
    getSeed(): number { return this.seed; }

    static getNeighbors(seed: number, packetIndex: number, K: number, distribution: RobustSoliton): number[] {
        const pSeed = mix32(seed, packetIndex);
        const rng = new Mulberry32(pSeed);
        const randomFloat = rng.next();
        let d = distribution.sampleDegree(randomFloat);
        
        // Sample d distinct block indices from 0 to K-1
        const indices = new Set<number>();
        d = Math.min(d, K); 
        while (indices.size < d) {
            const idx = Math.floor(rng.next() * K);
            indices.add(idx);
        }
        return Array.from(indices);
    }

    nextPacket(): FountainPacket {
        const index = this.packetIndex++;
        const neighbors = FountainEncoder.getNeighbors(this.seed, index, this.K, this.distribution);
        
        const xorData = new Uint8Array(this.blockSize);
        for (const neighborIdx of neighbors) {
            const block = this.blocks[neighborIdx];
            for (let i = 0; i < this.blockSize; i++) {
                xorData[i] ^= block[i];
            }
        }

        return {
            packet_index: index,
            data: xorData
        };
    }
}
