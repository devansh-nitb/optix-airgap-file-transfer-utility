import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeProvider';

export const Header: React.FC = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();

    const navItems = [
        { label: 'Home', path: '/' },
        { label: 'Send File', path: '/send' },
        { label: 'Receive File', path: '/receive' },
    ];

    return (
        <header className="app-header-nav">
            <nav className="nav-bar">
                {/* Brand Logo with 3D Cube Icon */}
                <Link to="/" className="nav-logo">
                    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.375 8.16L11 11.874L17.625 8.16M4.375 28.336V20.781L-2 16.9M24.375 16.9L17.625 20.781V28.336M-2.744 12.671L11 20.971L24.744 12.671M11 32.5V16.9M24.375 23.475V14.326C24.374 13.749 24.221 13.183 23.932 12.684C23.642 12.185 23.226 11.771 22.725 11.483L12.625 4.908C12.123 4.62 11.554 4.468 10.975 4.468C10.396 4.468 9.827 4.62 9.325 4.908L-0.775 11.483C-1.276 11.771 -1.692 12.185 -1.982 12.684C-2.271 13.183 -2.424 13.749 -2.425 14.326V23.475C-2.424 24.052 -2.271 24.618 -1.982 25.117C-1.692 25.616 -1.276 26.03 -0.775 26.318L9.325 32.893C9.827 33.181 10.396 33.333 10.975 33.333C11.554 33.333 12.123 33.181 12.625 32.893L22.725 26.318C23.226 26.03 23.642 25.616 23.932 25.117C24.221 24.618 24.374 24.052 24.375 23.475Z" 
                            stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                            transform="scale(0.8) translate(5, 2)"
                        />
                    </svg>
                    <span className="logo-text">OPTIX</span>
                </Link>

                {/* Desktop Nav Items Pill Container */}
                <div className="nav-items-pill hidden-mobile">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.label}
                                to={item.path}
                                className={`nav-item-link ${isActive ? 'active' : ''}`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Header Right Actions */}
                <div className="nav-actions hidden-mobile">
                    <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Theme">
                        {theme === 'light' ? (
                            <><span style={{display:'flex', alignItems:'center'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg></span> <span className="theme-label">Dark</span></>
                        ) : (
                            <><span style={{display:'flex', alignItems:'center'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg></span> <span className="theme-label">Light</span></>
                        )}
                    </button>

                </div>

                {/* Mobile Menu Toggle */}
                <div className="mobile-actions">
                    <button className="theme-toggle-btn icon-only" onClick={toggleTheme}>
                        {theme === 'light' ? 
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg> 
                            : 
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                        }
                    </button>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="mobile-menu-btn"
                        aria-label="Toggle menu"
                    >
                        <span className={`hamburger-bar ${menuOpen ? 'open-bar-1' : ''}`}></span>
                        <span className={`hamburger-bar ${menuOpen ? 'open-bar-2' : ''}`}></span>
                        <span className={`hamburger-bar ${menuOpen ? 'open-bar-3' : ''}`}></span>
                    </button>
                </div>
            </nav>

            {/* Mobile Navigation Drawer */}
            {menuOpen && (
                <div className="mobile-drawer fade-in">
                    <div className="mobile-drawer-links">
                        {navItems.map((item) => (
                            <Link
                                key={item.label}
                                to={item.path}
                                onClick={() => setMenuOpen(false)}
                                className={`mobile-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
