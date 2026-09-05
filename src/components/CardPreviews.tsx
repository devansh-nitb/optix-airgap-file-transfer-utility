import React, { useEffect, useRef } from 'react';

// Send Card Live Animated Preview Component
export const SendCardPreview: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    const size = 110;
                    ctx.clearRect(0, 0, size, size);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, size, size);
                    ctx.fillStyle = '#0f0f1a';
                    const cellSize = 5.5;
                    const cols = Math.floor(size / cellSize);
                    for (let r = 0; r < cols; r++) {
                        for (let c = 0; c < cols; c++) {
                            const isTL = r < 4 && c < 4;
                            const isTR = r < 4 && c >= cols - 4;
                            const isBL = r >= cols - 4 && c < 4;
                            if (isTL || isTR || isBL) {
                                const relR = isBL ? r - (cols - 4) : r;
                                const relC = isTR ? c - (cols - 4) : c;
                                if (relR === 0 || relR === 3 || relC === 0 || relC === 3 || (relR >= 1 && relR <= 2 && relC >= 1 && relC <= 2)) {
                                    ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                                }
                            } else if (Math.random() > 0.48) {
                                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                            }
                        }
                    }
                }
            }
        }, 130);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="card-animated-preview send-preview-bg">
            <div className="preview-qr-wrap">
                <canvas ref={canvasRef} width={110} height={110} className="mini-qr-canvas" />
                <div className="stream-waves">
                    <span className="wave wave-1"></span>
                    <span className="wave wave-2"></span>
                </div>
            </div>
        </div>
    );
};

// Receive Card Live Animated Preview Component
export const ReceiveCardPreview: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    const size = 110;
                    ctx.clearRect(0, 0, size, size);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, size, size);
                    ctx.fillStyle = '#1e1b4b';
                    const cellSize = 5.5;
                    const cols = Math.floor(size / cellSize);
                    for (let r = 0; r < cols; r++) {
                        for (let c = 0; c < cols; c++) {
                            const isTL = r < 4 && c < 4;
                            const isTR = r < 4 && c >= cols - 4;
                            const isBL = r >= cols - 4 && c < 4;
                            if (isTL || isTR || isBL) {
                                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                            } else if (Math.random() > 0.52) {
                                ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
                            }
                        }
                    }
                }
            }
        }, 280);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="card-animated-preview receive-preview-bg">
            <div className="preview-scanner-wrap">
                <div className="scanner-target">
                    <canvas ref={canvasRef} width={110} height={110} className="mini-qr-canvas dim" />
                    <div className="viewfinder-corner-sm tl"></div>
                    <div className="viewfinder-corner-sm tr"></div>
                    <div className="viewfinder-corner-sm bl"></div>
                    <div className="viewfinder-corner-sm br"></div>
                    <div className="laser-beam"></div>
                </div>
            </div>
        </div>
    );
};
