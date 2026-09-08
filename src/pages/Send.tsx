import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FountainEncoder } from '../lib/fountain';
import { serializeInitPacket, serializeDataPacket, type InitMetadata } from '../lib/protocol/serialize';
import { renderQRToCanvas } from '../lib/qr/renderer';
import { encryptFile } from '../lib/crypto';

const BLOCK_SIZE = 500;       // smaller block → smaller payload → fits safely inside QR version
const QR_VERSION = 20;        // version 20 @ ECC=M fits up to ~666 bytes; 500 + 10 byte header = 510 ✓
const FRAME_INTERVAL_MS = 120;
const INIT_INTERVAL = 15;

async function computeSHA256(buffer: ArrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return new Uint8Array(hashBuffer);
}

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function estimateTime(fileSize: number) {
    const effectiveKbps = 5; // ~5 KB/s effective throughput per PRD
    const seconds = fileSize / (effectiveKbps * 1024);
    if (seconds < 60) return `~${Math.ceil(seconds)}s`;
    return `~${Math.ceil(seconds / 60)}min`;
}

export default function Send() {
    const [file, setFile] = useState<File | null>(null);
    const [fileBuffer, setFileBuffer] = useState<Uint8Array | null>(null);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [packetsTransmitted, setPacketsTransmitted] = useState(0);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [password, setPassword] = useState('');
    const [isPreparing, setIsPreparing] = useState(false);
    const [sendMode, setSendMode] = useState<'file' | 'text'>('file');
    const [textPayload, setTextPayload] = useState('');
    const [isFullScreen, setIsFullScreen] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const broadcastContainerRef = useRef<HTMLDivElement>(null);
    const isBroadcastingRef = useRef(false);  // ref so loop closure doesn't go stale
    const timerRef = useRef<number | null>(null);
    const loopTimerRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const encoderRef = useRef<FountainEncoder | null>(null);
    const initMetaRef = useRef<InitMetadata | null>(null);
    const frameCountRef = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            const arrayBuffer = await selectedFile.arrayBuffer();
            setFileBuffer(new Uint8Array(arrayBuffer));
        }
    };

    const renderFrame = useCallback(async () => {
        if (!canvasRef.current || !encoderRef.current || !initMetaRef.current) return;
        let payload: Uint8Array;
        if (frameCountRef.current % INIT_INTERVAL === 0) {
            payload = serializeInitPacket(initMetaRef.current);
        } else {
            const packet = encoderRef.current.nextPacket();
            payload = serializeDataPacket({
                transferId: initMetaRef.current.transferId,
                packetIndex: packet.packet_index,
                data: packet.data,
            });
        }
        await renderQRToCanvas(canvasRef.current, payload, QR_VERSION, 'M');
        frameCountRef.current++;
        setPacketsTransmitted(frameCountRef.current);
    }, []);

    const loop = useCallback(() => {
        if (!isBroadcastingRef.current) return;
        renderFrame().then(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setTimeElapsed(elapsed);
            if (isBroadcastingRef.current) {
                loopTimerRef.current = window.setTimeout(loop, FRAME_INTERVAL_MS);
            }
        });
    }, [renderFrame]);

    const startBroadcast = async () => {
        let baseBuffer: Uint8Array;
        let transferFilename = '';

        if (sendMode === 'text') {
            if (!textPayload.trim()) return;
            baseBuffer = new TextEncoder().encode(textPayload);
            transferFilename = '__optix_text_payload__.txt';
        } else {
            if (!file || !fileBuffer) return;
            baseBuffer = fileBuffer;
            transferFilename = file.name;
        }

        setIsPreparing(true);
        
        let bufferToEncode = baseBuffer;
        let isEncrypted = false;
        let iv: Uint8Array | undefined = undefined;
        let salt: Uint8Array | undefined = undefined;

        if (password) {
            try {
                const encrypted = await encryptFile(baseBuffer.buffer as ArrayBuffer, password);
                bufferToEncode = new Uint8Array(encrypted.ciphertext);
                iv = encrypted.iv;
                salt = encrypted.salt;
                isEncrypted = true;
            } catch (err) {
                console.error("Encryption failed", err);
                setIsPreparing(false);
                return;
            }
        }

        const hash = await computeSHA256(bufferToEncode.buffer as ArrayBuffer);
        
        const seed = (Math.random() * 0xFFFFFFFF) >>> 0;
        const transferId = (Math.random() * 0xFFFFFFFF) >>> 0;

        encoderRef.current = new FountainEncoder(bufferToEncode, BLOCK_SIZE, seed);
        initMetaRef.current = {
            transferId,
            totalFileSize: bufferToEncode.length,
            blockSize: BLOCK_SIZE,
            kBlocks: encoderRef.current.getK(),
            fountainSeed: seed,
            sha256: hash,
            filename: transferFilename,
            isEncrypted,
            iv,
            salt
        };

        frameCountRef.current = 0;
        startTimeRef.current = Date.now();
        setPacketsTransmitted(0);
        setTimeElapsed(0);

        setIsPreparing(false);
        isBroadcastingRef.current = true;
        setIsBroadcasting(true);

        loopTimerRef.current = window.setTimeout(loop, 0);
    };

    const stopBroadcast = () => {
        isBroadcastingRef.current = false;
        setIsBroadcasting(false);
        setIsFullScreen(false);
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        if (loopTimerRef.current !== null) clearTimeout(loopTimerRef.current);
        if (timerRef.current !== null) clearInterval(timerRef.current);
    };

    const enterFullScreen = async () => {
        setIsFullScreen(true);
        try {
            const elem = broadcastContainerRef.current || document.documentElement;
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if ((elem as any).webkitRequestFullscreen) {
                await (elem as any).webkitRequestFullscreen();
            }
        } catch (e) {
            console.warn('Native fullscreen request blocked or unsupported:', e);
        }
    };

    const exitFullScreen = async () => {
        setIsFullScreen(false);
        try {
            if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if ((document as any).webkitExitFullscreen) {
                    await (document as any).webkitExitFullscreen();
                }
            }
        } catch (e) {
            console.warn('Native exit fullscreen error:', e);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isNativeFs = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
            if (!isNativeFs) {
                setIsFullScreen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullScreen) {
                exitFullScreen();
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullScreen]);

    useEffect(() => {
        // Component unmount cleanup for the broadcast loop
        return () => {
            isBroadcastingRef.current = false;
            if (loopTimerRef.current !== null) clearTimeout(loopTimerRef.current);
            if (timerRef.current !== null) clearInterval(timerRef.current);
        };
    }, []);

    const kBlocks = file && fileBuffer ? Math.ceil(fileBuffer.length / BLOCK_SIZE) : 0;

    if (!isBroadcasting) {
        return (
            <div className="send-page fade-in">
                <div className="page-header">
                    <Link to="/" className="btn-back-pill">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        <span>Back</span>
                    </Link>
                    <h1 className="page-title mt-3">Send a File</h1>
                    <p className="page-subtitle">Broadcast your file as an animated QR stream.</p>
                </div>

                <div className="glass-card setup-panel flex flex-col items-center">
                    <div className="mode-tabs">
                        <button className={`mode-tab ${sendMode === 'file' ? 'active' : ''}`} onClick={() => setSendMode('file')}>File Upload</button>
                        <button className={`mode-tab ${sendMode === 'text' ? 'active' : ''}`} onClick={() => setSendMode('text')}>Text Message</button>
                    </div>

                    {sendMode === 'text' ? (
                        <div style={{ width: '100%' }}>
                            <textarea
                                className="text-input-area"
                                placeholder="Paste your text, secure passwords, or JSON configs here..."
                                value={textPayload}
                                onChange={(e) => setTextPayload(e.target.value)}
                            />
                        </div>
                    ) : !file ? (
                        <label htmlFor="fileInput" className="upload-box-container">
                            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M25.665 3.667H11a3.667 3.667 0 0 0-3.667 3.666v29.334A3.667 3.667 0 0 0 11 40.333h22a3.667 3.667 0 0 0 3.666-3.666v-22m-11-11 11 11m-11-11v11h11m-7.333 9.166H14.665m14.667 7.334H14.665M18.332 16.5h-3.667" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <p className="upload-title-text">Drag & drop your files here</p>
                            <p className="upload-subtitle-text">Or <span className="upload-click-highlight">click</span> to upload — up to 5 MB recommended</p>
                            <input
                                ref={fileInputRef}
                                id="fileInput"
                                type="file"
                                className="hidden-file-input"
                                onChange={handleFileChange}
                            />
                        </label>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 w-full" style={{ padding: '0.5rem', background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ background: 'var(--accent)', color: 'white', padding: '0.6rem', borderRadius: '8px' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                        <polyline points="13 2 13 9 20 9"></polyline>
                                    </svg>
                                </div>
                                <div className="flex-1" style={{ minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                                        {file.name}
                                    </p>
                                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                                <button 
                                    className="btn" 
                                    style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
                                    onClick={() => { setFile(null); setFileBuffer(null); }}
                                    title="Remove file"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </>
                    )}

                    {((sendMode === 'file' && file) || sendMode === 'text') && (
                        <>
                            {sendMode === 'file' && file && file.size > 5 * 1024 * 1024 && (
                                <div className="alert alert-warning mt-4">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                                    <span>Files over 5 MB may take 10–25 minutes to transfer. Consider splitting.</span>
                                </div>
                            )}
                            {sendMode === 'file' && file && file.size > 50 * 1024 * 1024 && (
                                <div className="alert alert-danger mt-4">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                    <span>File exceeds the 50 MB hard limit. Transfer is not practical over QR.</span>
                                </div>
                            )}

                            {sendMode === 'file' && file && fileBuffer && (
                                <div className="transfer-info">
                                    <div className="info-chip">
                                        <div className="info-chip-label">File Size</div>
                                        <div className="info-chip-value">{formatSize(file.size)}</div>
                                    </div>
                                    <div className="info-chip">
                                        <div className="info-chip-label">Blocks (K)</div>
                                        <div className="info-chip-value">{kBlocks}</div>
                                    </div>
                                    <div className="info-chip">
                                        <div className="info-chip-label">Est. Time</div>
                                        <div className="info-chip-value">{estimateTime(file.size)}</div>
                                    </div>
                                    <div className="info-chip">
                                        <div className="info-chip-label">Frame Rate</div>
                                        <div className="info-chip-value">~{Math.round(1000 / FRAME_INTERVAL_MS)} fps</div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4" style={{ width: '100%', textAlign: 'left' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '0.5rem' }}>
                                    Password Protection (Optional)
                                </label>
                                <input
                                    type="password"
                                    className="input-field"
                                    placeholder="Enter password to encrypt..."
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{ width: '100%', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                                />
                            </div>

                            <div className="mt-6" style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                                <button
                                    className="btn btn-primary btn-lg"
                                    style={{ flex: 1 }}
                                    onClick={startBroadcast}
                                    disabled={isPreparing || (sendMode === 'file' ? !fileBuffer : !textPayload.trim())}
                                >
                                    {isPreparing ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                                            <div className="status-dot-wrap">
                                                <span className="status-ping" style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}></span>
                                                <span className="status-dot" style={{ backgroundColor: '#ffffff' }}></span>
                                            </div>
                                            <span>{password ? 'Encrypting & Preparing...' : 'Preparing...'}</span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                            <span>Start Broadcasting</span>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={broadcastContainerRef}
            className={`send-page ${isFullScreen ? 'fullscreen-overlay' : 'fade-in'}`}
        >
            {isFullScreen ? (
                <div className="fullscreen-topbar">
                    <div className="fullscreen-meta">
                        <div className="live-badge">
                            <span className="live-dot"></span> Live Stream
                        </div>
                        <span className="fullscreen-filename">📤 {file?.name}</span>
                    </div>
                    <div className="fullscreen-actions">
                        <button className="btn btn-ghost btn-sm" onClick={exitFullScreen}>
                            ↙ Exit Fullscreen
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={stopBroadcast}>
                            ■ Stop
                        </button>
                    </div>
                </div>
            ) : (
                <div className="page-header">
                    <h1 className="page-title">Broadcasting</h1>
                    <p className="page-subtitle">{file?.name}</p>
                </div>
            )}

            <div className={isFullScreen ? 'fullscreen-body' : 'glass-card setup-panel'}>
                <div className="broadcast-view">
                    {!isFullScreen && (
                        <div className="broadcast-header">
                            <div className="broadcast-title">
                                <div className="live-badge">
                                    <span className="live-dot"></span> Live
                                </div>
                                QR Stream
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-ghost btn-sm" onClick={enterFullScreen}>
                                    ↗ Fullscreen
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={stopBroadcast}>
                                    ■ Stop
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`qr-display-wrap active ${isFullScreen ? 'fullscreen-qr-wrap' : ''}`}>
                        <canvas ref={canvasRef} className="qr-canvas" />
                    </div>

                    <div className="stats-grid">
                        <div className="stat-card glass-card">
                            <div className="stat-card-value">{packetsTransmitted}</div>
                            <div className="stat-card-label">Packets Sent</div>
                        </div>
                        <div className="stat-card glass-card">
                            <div className="stat-card-value">{timeElapsed}s</div>
                            <div className="stat-card-label">Elapsed</div>
                        </div>
                        <div className="stat-card glass-card">
                            <div className="stat-card-value">{kBlocks}</div>
                            <div className="stat-card-label">Total Blocks</div>
                        </div>
                    </div>

                    <p className="broadcast-hint">
                        {isFullScreen
                            ? "Point the receiver's camera at this screen. Press ESC or click Exit to leave fullscreen."
                            : "Hold this screen up to the receiver's camera. Keep broadcasting until they confirm receipt."}
                    </p>
                </div>
            </div>
        </div>
    );
}

