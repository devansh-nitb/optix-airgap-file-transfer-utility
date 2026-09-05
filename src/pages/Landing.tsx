import React from 'react';
import { Link } from 'react-router-dom';
import { SendCardPreview, ReceiveCardPreview } from '../components/CardPreviews';

const Landing: React.FC = () => {
    return (
        <div className="hero-container fade-in">
            {/* Iconic Background Hero Dome SVG matching prebuiltui template */}
            <svg
                className="hero-glow-svg"
                width="1440"
                height="676"
                viewBox="0 0 1440 676"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect x="-92" y="-948" width="1624" height="1624" rx="812" fill="url(#hero-dome-grad)" />
                <defs>
                    <radialGradient
                        id="hero-dome-grad"
                        cx="0"
                        cy="0"
                        r="1"
                        gradientUnits="userSpaceOnUse"
                        gradientTransform="rotate(90 428 292)scale(812)"
                    >
                        <stop offset=".63" stopColor="var(--dome-center)" stopOpacity="0" />
                        <stop offset="1" stopColor="var(--dome-glow)" stopOpacity="var(--dome-opacity, 1)" />
                    </radialGradient>
                </defs>
            </svg>

            {/* Live Security Pill Badge */}
            <div className="hero-badge">
                <span className="pulse-dot-green"></span>
                <span>OPTIX Protocol • 100% Offline Air-Gap</span>
            </div>

            {/* Main Hero Headline */}
            <h1 className="hero-title">
                Transfer Files<br />
                <span className="gradient-text">Through Thin Air</span>
            </h1>

            {/* Hero Subtitle */}
            <p className="hero-subtitle">
                The world's standard for air-gapped file transfer. Broadcast and capture continuous 
                LT Fountain QR streams using only your screen and camera — zero Wi-Fi, Bluetooth, or cellular required.
            </p>

            {/* Interactive Animated Cards illustrating exact Send & Receive process */}
            <div className="feature-media-cards">
                {/* Send File Card with Live Animated Stream Preview */}
                <Link to="/send" className="feature-media-card">
                    <SendCardPreview />
                    <div className="feature-card-overlay">
                        <div className="feature-card-info">
                            <span className="feature-card-title">Send a File</span>
                            <span className="feature-card-sub">Broadcast via QR stream</span>
                        </div>
                        <span className="feature-card-btn">
                            Start Broadcasting →
                        </span>
                    </div>
                </Link>

                {/* Receive File Card with Live Animated Camera Viewfinder Scanner */}
                <Link to="/receive" className="feature-media-card">
                    <ReceiveCardPreview />
                    <div className="feature-card-overlay">
                        <div className="feature-card-info">
                            <span className="feature-card-title">Receive File</span>
                            <span className="feature-card-sub">Scan camera & reconstruct</span>
                        </div>
                        <span className="feature-card-btn">
                            Scan & Decode →
                        </span>
                    </div>
                </Link>
            </div>

            {/* Hero Protocol Stats Row */}
            <div className="hero-stats">
                <div className="hero-stat">
                    <span className="hero-stat-value">0</span>
                    <span className="hero-stat-label">Network Calls</span>
                </div>
                <div className="hero-stat">
                    <span className="hero-stat-value">SHA-256</span>
                    <span className="hero-stat-label">Integrity Check</span>
                </div>
                <div className="hero-stat">
                    <span className="hero-stat-value">LT</span>
                    <span className="hero-stat-label">Fountain Code</span>
                </div>
                <div className="hero-stat">
                    <span className="hero-stat-value">~10 FPS</span>
                    <span className="hero-stat-label">Frame Rate</span>
                </div>
            </div>
        </div>
    );
};

export default Landing;
