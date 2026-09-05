export class RobustSoliton {
    private K: number;
    private c: number;
    private delta: number;
    private cdf: number[];

    constructor(K: number, c: number = 0.1, delta: number = 0.05) {
        this.K = K;
        this.c = c;
        this.delta = delta;
        this.cdf = this.precomputeCDF();
    }

    private precomputeCDF(): number[] {
        const K = this.K;
        if (K === 1) return [0, 1];

        const R = this.c * Math.log(K / this.delta) * Math.sqrt(K);
        
        const rho = new Array(K + 1).fill(0);
        rho[1] = 1 / K;
        for (let i = 2; i <= K; i++) {
            rho[i] = 1 / (i * (i - 1));
        }

        const tau = new Array(K + 1).fill(0);
        const limit = Math.floor(K / R);
        for (let i = 1; i < limit && i <= K; i++) {
            tau[i] = R / (i * K);
        }
        if (limit >= 1 && limit <= K) {
             tau[limit] = (R * Math.log(R / this.delta)) / K;
        }
        
        const mu = new Array(K + 1).fill(0);
        let beta = 0;
        for (let i = 1; i <= K; i++) {
            mu[i] = rho[i] + tau[i];
            beta += mu[i];
        }

        const cdf = new Array(K + 1).fill(0);
        let sum = 0;
        for (let i = 1; i <= K; i++) {
            sum += mu[i] / beta;
            cdf[i] = sum;
        }
        
        // Ensure the last element is exactly 1 to avoid floating point issues
        cdf[K] = 1;

        return cdf;
    }

    sampleDegree(randomFloat: number): number {
        for (let i = 1; i <= this.K; i++) {
            if (randomFloat <= this.cdf[i]) {
                return i;
            }
        }
        return this.K; // Fallback
    }
}
