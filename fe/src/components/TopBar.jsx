function TopBar({ me, onOpenProfile, onRequestLogout }) {
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
                        {me.avatarUrl ? (
                            <img className="top-avatar" src={me.avatarUrl} alt="Avatar" />
                        ) : (
                            <span className="top-avatar fallback">{name.slice(0, 1).toUpperCase()}</span>
                        )}
                    </span>
                    <strong>{name}</strong>
                </div>
        <div className="me-actions">
          <button className="btn btn-quiet top-icon-btn nav-action-btn" onClick={onOpenProfile} title="Profile" aria-label="Profile">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
            </svg>
            <span>Profile</span>
          </button>
          <button className="btn btn-quiet top-icon-btn nav-action-btn" onClick={onRequestLogout} title="Log out" aria-label="Log out">
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
