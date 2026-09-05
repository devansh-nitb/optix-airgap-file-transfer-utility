import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-main-grid">
                    {/* Brand Column */}
                    <div className="footer-brand-col">
                        <Link to="/" className="footer-brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
                            <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M4.375 8.16L11 11.874L17.625 8.16M4.375 28.336V20.781L-2 16.9M24.375 16.9L17.625 20.781V28.336M-2.744 12.671L11 20.971L24.744 12.671M11 32.5V16.9M24.375 23.475V14.326C24.374 13.749 24.221 13.183 23.932 12.684C23.642 12.185 23.226 11.771 22.725 11.483L12.625 4.908C12.123 4.62 11.554 4.468 10.975 4.468C10.396 4.468 9.827 4.62 9.325 4.908L-0.775 11.483C-1.276 11.771 -1.692 12.185 -1.982 12.684C-2.271 13.183 -2.424 13.749 -2.425 14.326V23.475C-2.424 24.052 -2.271 24.618 -1.982 25.117C-1.692 25.616 -1.276 26.03 -0.775 26.318L9.325 32.893C9.827 33.181 10.396 33.333 10.975 33.333C11.554 33.333 12.123 33.181 12.625 32.893L22.725 26.318C23.226 26.03 23.642 25.616 23.932 25.117C24.221 24.618 24.374 24.052 24.375 23.475Z"
                                    stroke="var(--accent)"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    transform="scale(0.8) translate(5, 2)"
                                />
                            </svg>
                            <span className="logo-text">OPTIX</span>
                        </Link>
                        <div className="footer-brand-divider"></div>
                        <p className="footer-brand-desc">
                            OPTIX is a zero-trust, 100% client-side web application for transferring files securely between air-gapped offline devices using animated QR streams and LT Fountain codes.
                        </p>
                    </div>

                    {/* Links Column 1 */}
                    <div className="footer-links-col">
                        <h3 className="footer-col-title">Navigation</h3>
                        <div className="footer-link-group">
                            <Link to="/" className="footer-link">Home</Link>
                            <Link to="/send" className="footer-link">Send File</Link>
                            <Link to="/receive" className="footer-link">Receive File</Link>
                        </div>
                    </div>

                    {/* Links Column 2 */}
                    <div className="footer-links-col">
                        <h3 className="footer-col-title">Protocol</h3>
                        <div className="footer-link-group">
                            <span className="footer-link">LT Fountain Code</span>
                            <span className="footer-link">Robust Soliton PRNG</span>
                            <span className="footer-link">SHA-256 Checksum</span>
                            <span className="footer-link">QR Version 20 @ ECC M</span>
                        </div>
                    </div>

                    {/* Subscribe / Security Column */}
                    <div className="footer-subscribe-col">
                        <h3 className="footer-col-title">Zero-Trust Air Gap</h3>
                        <p className="footer-brand-desc" style={{ marginTop: 0 }}>100% offline, browser-local processing with zero server calls or network requests.</p>

                    </div>
                </div>

                <div className="footer-middle-divider"></div>

                <div className="footer-bottom-bar">
                    <p className="footer-copy">© 2026 OPTIX Protocol • All rights reserved.</p>
                    <div className="footer-legal-links">
                        <span className="footer-legal-link">Zero Network Policy</span>
                        <div className="footer-legal-sep"></div>
                        <span className="footer-legal-link">MIT License</span>
                    </div>
                </div>

                {/* Giant Bottom Watermark */}
                <div className="footer-watermark-wrap">
                    <h1 className="footer-watermark">OPTIX</h1>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

