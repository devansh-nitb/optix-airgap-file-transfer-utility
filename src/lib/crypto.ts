export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt as any,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function encryptFile(buffer: ArrayBuffer, password: string): Promise<{ ciphertext: ArrayBuffer, iv: Uint8Array, salt: Uint8Array }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv as any
        },
        key,
        buffer
    );
    
    return { ciphertext, iv, salt };
}

export async function decryptFile(ciphertext: ArrayBuffer, password: string, iv: Uint8Array, salt: Uint8Array): Promise<ArrayBuffer> {
    const key = await deriveKey(password, salt);
    
    return await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv as any
        },
        key,
        ciphertext
    );
}
