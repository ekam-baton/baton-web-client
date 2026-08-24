/**
 * Cryptographic utility using native Web Crypto API.
 * Ensures zero-trust client-side encryption.
 */

const PBKDF2_ITERATIONS = 600000;
const SALT_SIZE = 16; // 128-bit
const IV_SIZE = 12; // 96-bit for AES-GCM
const KEY_LENGTH = 256; 

function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Derives a 256-bit AES-GCM key from the plaintext Master Password.
 */
export async function deriveMasterKey(password, saltBase64) {
    const encoder = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const salt = saltBase64 ? base64ToBuffer(saltBase64) : window.crypto.getRandomValues(new Uint8Array(16)).buffer;

    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: KEY_LENGTH },
        false,
        ["encrypt", "decrypt"]
    );
}

export function generateSalt() {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    return bufferToBase64(salt.buffer);
}

/**
 * Encrypts a JSON payload using the derived AES-GCM Master Key.
 * Returns { ciphertextBase64, ivBase64 }
 */
export async function encryptPayload(key, dataObj) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(dataObj));
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        data
    );

    return {
        ciphertext: bufferToBase64(ciphertextBuffer),
        iv: bufferToBase64(iv)
    };
}

/**
 * Decrypts AES-GCM ciphertext using the derived Master Key.
 * Returns the parsed JSON object.
 */
export async function decryptPayload(key, ciphertextBase64, ivBase64) {
    const ciphertext = base64ToBuffer(ciphertextBase64);
    const iv = base64ToBuffer(ivBase64);

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: new Uint8Array(iv)
            },
            key,
            ciphertext
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedBuffer));
    } catch (e) {
        console.error("Decryption failed. The key or ciphertext is invalid.", e);
        return null;
    }
}
