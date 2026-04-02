function TopBar({ me, onOpenProfile, onRequestLogout }) {
  const name = me.displayName || me.user;
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/assets/logo.png" alt="Chess" />
        <span>{"k\u00f6nig"}</span>
      </div>
      <div className="me">
        <span className="avatar-wrap">
          {me.avatarUrl ? <img className="top-avatar" src={me.avatarUrl} alt="Avatar" /> : <span className="top-avatar fallback">{name.slice(0, 1).toUpperCase()}</span>}
        </span>
        Signed in as <strong>{name}</strong>
        <button className="btn btn-quiet top-icon-btn" onClick={onOpenProfile} title="Profile" aria-label="Profile">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.3 2h3.4l.5 2.1c.5.2 1 .4 1.4.8l2-.8 2.4 2.4-.8 2c.3.5.6.9.8 1.4l2.1.5v3.4l-2.1.5c-.2.5-.4 1-.8 1.4l.8 2-2.4 2.4-2-.8c-.5.3-.9.6-1.4.8l-.5 2.1h-3.4l-.5-2.1c-.5-.2-1-.4-1.4-.8l-2 .8-2.4-2.4.8-2c-.3-.5-.6-.9-.8-1.4L2 13.7v-3.4l2.1-.5c.2-.5.4-1 .8-1.4l-.8-2 2.4-2.4 2 .8c.5-.3.9-.6 1.4-.8L10.3 2Zm1.7 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
          </svg>
        </button>
        <button className="btn btn-quiet top-icon-btn" onClick={onRequestLogout} title="Log out" aria-label="Log out">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 3h5a3 3 0 0 1 3 3v3h-2V6a1 1 0 0 0-1-1h-5v14h5a1 1 0 0 0 1-1v-3h2v3a3 3 0 0 1-3 3h-5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7.6 8H12v2h5.6l-1.8 1.8 1.4 1.4L21.4 12l-4.2-4.2-1.4 1.4 1.8 1.8Z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
