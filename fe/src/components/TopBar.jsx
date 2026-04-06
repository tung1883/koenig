function TopBar({ me, currentView, onNavigateHome, onNavigateComputer, onOpenProfile, onRequestLogout }) {
    const name = me.displayName || me.user

    return (
        <header className="topbar">
            <div className="brand">
                <img src="/assets/logo.png" alt="Chess" />
                <span>{"k\u00f6nig"}</span>
            </div>

            <div className="me">
                <div className="me-user">
                    <span className="avatar-wrap">
                        {me.avatarUrl ? <img className="top-avatar" src={me.avatarUrl} alt="Avatar" /> : <span className="top-avatar fallback">{name.slice(0, 1).toUpperCase()}</span>}
                    </span>
                    <strong>{name}</strong>
                </div>
                <div className="me-actions">
                    <div className="topbar-nav">
                        <button className="btn btn-quiet top-icon-btn nav-action-btn" onClick={onOpenProfile} title="Profile" aria-label="Profile">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
                            </svg>
                            <span>Profile</span>
                        </button>
                        <button
                            className={`btn btn-quiet top-icon-btn nav-action-btn ${currentView === "online" ? "is-active" : ""}`}
                            onClick={onNavigateHome}
                            title="Online play"
                            aria-label="Online play"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M4 6.5 12 3l8 3.5v11L12 21l-8-3.5Zm2 1.31v8.38l5 2.19V10ZM13 10v8.38l5-2.19V7.81Z" />
                            </svg>
                            <span>Online</span>
                        </button>
                        <button
                            className={`btn btn-quiet top-icon-btn nav-action-btn ${currentView === "computer" ? "is-active" : ""}`}
                            onClick={onNavigateComputer}
                            title="Play with computer"
                            aria-label="Play with computer"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M9 4h6v2h1a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-1v2h-2v-2h-2v2H9v-2H8a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h1Zm-1 5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1Zm1.75 1.25h1.5v1.5h-1.5Zm3 0h1.5v1.5h-1.5Z" />
                            </svg>
                            <span>Computer</span>
                        </button>
                    </div>
                    <button className="btn btn-quiet top-icon-btn nav-action-btn logout-action-btn" onClick={onRequestLogout} title="Log out" aria-label="Log out">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M10 3h5a3 3 0 0 1 3 3v3h-2V6a1 1 0 0 0-1-1h-5v14h5a1 1 0 0 0 1-1v-3h2v3a3 3 0 0 1-3 3h-5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7.6 8H12v2h5.6l-1.8 1.8 1.4 1.4L21.4 12l-4.2-4.2-1.4 1.4 1.8 1.8Z" />
                        </svg>
                        <span>Log out</span>
                    </button>
                </div>
            </div>
        </header>
    )
}

export default TopBar
