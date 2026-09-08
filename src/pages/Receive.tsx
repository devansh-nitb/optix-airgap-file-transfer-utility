import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import jsQR from 'jsqr';
import { FountainDecoder } from '../lib/fountain';
import { deserializePacket, type InitMetadata } from '../lib/protocol/serialize';
import { decryptFile } from '../lib/crypto';

async function computeSHA256(buffer: ArrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(hashBuffer);
}

function arraysEqual(a: Uint8Array, b: Uint8Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

type ReceiveState = 'idle' | 'scanning' | 'awaiting_password' | 'complete' | 'error';

export default function Receive() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const decoderRef = useRef<FountainDecoder | null>(null);
    const seenIndicesRef = useRef<Set<number>>(new Set());
    const isRunningRef = useRef(false);

    const [state, setState] = useState<ReceiveState>('idle');
    const [meta, setMeta] = useState<InitMetadata | null>(null);
    const [progress, setProgress] = useState(0);
    const [framesScanned, setFramesScanned] = useState(0);
    const [packetsAccepted, setPacketsAccepted] = useState(0);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [encryptedBuffer, setEncryptedBuffer] = useState<ArrayBuffer | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);

    const metaRef = useRef<InitMetadata | null>(null);

    const stopScan = () => {
        isRunningRef.current = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    };

    useEffect(() => () => stopScan(), []);

    const tick = () => {
        if (!isRunningRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });
                setFramesScanned(f => f + 1);
                if (code) {
                    // Draw bounding box
                    ctx.beginPath();
                    ctx.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y);
                    ctx.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y);
                    ctx.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y);
                    ctx.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y);
                    ctx.closePath();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#10b981';
                    ctx.stroke();
                    processPacket(new Uint8Array(code.binaryData));
                }
            }
        }
        rafRef.current = requestAnimationFrame(tick);
    };

    const processPacket = async (data: Uint8Array) => {
        const parsed = deserializePacket(data);
        if (!parsed) return;

        if (parsed.type === 'INIT') {
            if (!metaRef.current) {
                metaRef.current = parsed.meta;
                setMeta(parsed.meta);
                setFileName(parsed.meta.filename || 'received_file');
                decoderRef.current = new FountainDecoder(
                    parsed.meta.kBlocks,
                    parsed.meta.blockSize,
                    parsed.meta.fountainSeed
                );
            }
        } else if (parsed.type === 'DATA') {
            const m = metaRef.current;
            if (!m || !decoderRef.current) return;
            if (parsed.payload.transferId !== m.transferId) return;
            if (seenIndicesRef.current.has(parsed.payload.packetIndex)) return;
            seenIndicesRef.current.add(parsed.payload.packetIndex);
            const accepted = seenIndicesRef.current.size;
            setPacketsAccepted(accepted);

            decoderRef.current.receivePacket({
                packet_index: parsed.payload.packetIndex,
                data: parsed.payload.data,
            });

            // Fountain codes decode in an "avalanche" at the very end.
            // To give users a smooth progress bar, we base it on packets received vs required blocks.
            setProgress(Math.min(accepted / m.kBlocks, 0.99));

            if (decoderRef.current.isComplete()) {
                isRunningRef.current = false;
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                await finishTransfer(m);
            }
        }
    };

    const processDecryptedData = (buffer: ArrayBuffer, m: InitMetadata) => {
        if (m.filename === '__optix_text_payload__.txt') {
            const text = new TextDecoder().decode(buffer);
            setTextContent(text);
            setState('complete');
        } else {
            const blob = new Blob([buffer]);
            const url = URL.createObjectURL(blob);
            setFileUrl(url);
            setState('complete');
        }
    };

    const finishTransfer = async (m: InitMetadata) => {
        if (!decoderRef.current) return;
        try {
            const fileData = decoderRef.current.getReconstructedData(m.totalFileSize);
            const computedHash = await computeSHA256(fileData.buffer as ArrayBuffer);
            if (!arraysEqual(computedHash, m.sha256)) {
                setState('error');
                setErrorMsg('SHA-256 mismatch — the reconstructed file is corrupted. Try scanning again.');
                return;
            }
            if (m.isEncrypted) {
                setEncryptedBuffer(fileData.buffer as ArrayBuffer);
                setState('awaiting_password');
            } else {
                processDecryptedData(fileData.buffer as ArrayBuffer, m);
            }
        } catch (err) {
            setState('error');
            setErrorMsg('Error during file reconstruction. Please retry.');
            console.error(err);
        }
    };

    const handleDecrypt = async (e: React.FormEvent) => {
        e.preventDefault();
        const m = metaRef.current;
        if (!m || !encryptedBuffer || !password || !m.iv || !m.salt) return;
        
        setIsDecrypting(true);
        setErrorMsg(null);
        try {
            const decrypted = await decryptFile(encryptedBuffer, password, m.iv, m.salt);
            processDecryptedData(decrypted, m);
        } catch (err) {
            setErrorMsg('Incorrect password or corrupted data. Decryption failed.');
            console.error(err);
        } finally {
            setIsDecrypting(false);
        }
    };

    const startScan = async () => {
        setErrorMsg(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                await videoRef.current.play();
            }
            setState('scanning');
            isRunningRef.current = true;
            rafRef.current = requestAnimationFrame(tick);
        } catch {
            setErrorMsg('Camera access was denied. Please allow camera permissions and try again.');
            setState('error');
        }
    };

    const clearAndRetry = () => {
        stopScan();
        metaRef.current = null;
        decoderRef.current = null;
        seenIndicesRef.current.clear();
        setMeta(null);
        setFileUrl(null);
        setFileName('');
        setErrorMsg(null);
        setProgress(0);
        setFramesScanned(0);
        setPacketsAccepted(0);
        setEncryptedBuffer(null);
        setTextContent(null);
        setPassword('');
        setIsDecrypting(false);
        setState('idle');
    };

    const pct = Math.round(progress * 100);

    return (
        <div className="receive-page fade-in">
            <div className="page-header">
                <Link to="/" className="btn-back-pill">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    <span>Back</span>
                </Link>
                <h1 className="page-title mt-3">Receive a File</h1>
                <p className="page-subtitle">Point your camera at the sender's QR stream.</p>
            </div>
            <div className="glass-card scan-panel">
                {state === 'complete' && (fileUrl || textContent !== null) ? (
                    <div className="success-state fade-in">
                        <div className="success-icon-wrap">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#fff'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </div>
                        <div className="success-title">Transfer Complete!</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            SHA-256 verified. Your payload is intact.
                        </p>
                        
                        {textContent !== null ? (
                            <>
                                <div className="success-filename">Secure Text Payload</div>
                                <div className="text-display-box">
                                    {textContent}
                                </div>
                                <div className="success-actions" style={{ flexDirection: 'row', gap: '0.75rem', width: '100%' }}>
                                    <button
                                        className="btn btn-success btn-lg"
                                        style={{ flex: 1 }}
                                        onClick={() => navigator.clipboard.writeText(textContent)}
                                    >
                                        Copy Text
                                    </button>
                                    <button
                                        className="btn btn-lg"
                                        style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                                        onClick={clearAndRetry}
                                    >
                                        Burn & Close
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="success-filename">{fileName || 'downloaded_file'}</div>
                                <div className="success-actions">
                                    <a
                                        href={fileUrl!}
                                        download={fileName || 'downloaded_file'}
                                        className="btn btn-success btn-lg"
                                    >
                                        <span style={{display:'flex', alignItems:'center', gap:'0.4rem'}}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            Download File
                                        </span>
                                    </a>
                                    <button className="btn btn-ghost" onClick={clearAndRetry}>
                                        Scan Another
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ) : state === 'awaiting_password' ? (
                    <div className="success-state fade-in">
                        <div className="success-icon-wrap" style={{ background: 'var(--accent)' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#fff'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        </div>
                        <div className="success-title">Encrypted File Received</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            The payload was successfully decoded, but the file is encrypted. Enter the password to decrypt it.
                        </p>
                        
                        <form onSubmit={handleDecrypt} style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem', margin: '0 auto' }}>
                            <input
                                type="password"
                                className="input-field"
                                placeholder="Enter decryption password..."
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(0, 0, 0, 0.25)', color: '#ffffff', textAlign: 'center', outline: 'none' }}
                                autoFocus
                            />
                            {errorMsg && (
                                <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                    {errorMsg}
                                </div>
                            )}
                            <button type="submit" className="btn btn-primary btn-lg" disabled={!password || isDecrypting}>
                                {isDecrypting ? 'Decrypting...' : 'Decrypt File'}
                            </button>
                        </form>
                    </div>
                ) : (
                    <>
                        {/* Camera Area */}
                        <div className="camera-wrapper">
                            <video ref={videoRef} className="hidden-video" muted playsInline />
                            {state === 'scanning' ? (
                                <>
                                    <canvas ref={canvasRef} className="scan-canvas" />
                                    <div className="scan-viewfinder">
                                        <div className="viewfinder-corner tl"></div>
                                        <div className="viewfinder-corner tr"></div>
                                        <div className="viewfinder-corner bl"></div>
                                        <div className="viewfinder-corner br"></div>
                                        <div className="scan-line-container">
                                            <div className="scan-line-mover">
                                                <div className="scan-line"></div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="camera-idle-card">
                                    <div className="camera-icon-ring">
                                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                                            <circle cx="12" cy="13" r="3"/>
                                        </svg>
                                    </div>
                                    <h3 className="camera-idle-title">Ready to Scan</h3>
                                    <p className="camera-idle-sub">Point your camera at the sender's animated QR stream</p>
                                    <button className="btn-start-scan-pill" onClick={startScan}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                            <circle cx="12" cy="13" r="4"/>
                                        </svg>
                                        <span>Start Camera Scanner</span>
                                    </button>
                                    <p className="camera-permission-hint">Camera access required • 100% Client-Side</p>
                                </div>
                            )}
                        </div>

                        {/* Errors */}
                        {errorMsg && (
                            <div className="alert alert-danger mt-4">
                                <span style={{display: 'flex'}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>
                                <div>
                                    <div>{errorMsg}</div>
                                    <button className="btn btn-ghost btn-sm mt-2" onClick={clearAndRetry}>
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Progress */}
                        {state === 'scanning' && (
                            <div className="progress-section">
                                {meta ? (
                                    <>
                                        <div className="progress-header">
                                            <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                {pct < 100 ? 'Receiving…' : 'Decoding…'}
                                            </div>
                                            <div className="progress-pct">{pct}%</div>
                                        </div>
                                        <div className="progress-track">
                                            <div
                                                className="progress-fill"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <div className="scan-stats-row">
                                            <span>Blocks: {decoderRef.current?.getDecodedCount() ?? 0} / {meta.kBlocks}</span>
                                            <span>Accepted: {packetsAccepted}</span>
                                            <span>Scanned: {framesScanned}</span>
                                        </div>
                                        {meta.filename && (
                                            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center'}}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                    {meta.filename}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="status-pill">
                                        <div className="status-dot-wrap">
                                            <span className="status-ping"></span>
                                            <span className="status-dot"></span>
                                        </div>
                                        <span>Waiting for signal<span className="waiting-dots"></span></span>
                                    </div>
                                )}
                            </div>
                        )}

                        {state === 'scanning' && (
                            <div className="mt-4" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn btn-ghost btn-sm" onClick={clearAndRetry}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
