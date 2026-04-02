import { useEffect, useState } from "react";

function ProfileModal({ open, me, saving, uploadingAvatar, error, onClose, onSave, onUploadAvatar }) {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [cropSource, setCropSource] = useState("");
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropBusy, setCropBusy] = useState(false);

  useEffect(() => {
    if (!open || !me) return;
    setDisplayName(me.displayName || "");
    setBio(me.bio || "");
    setAvatarUrl(me.avatarUrl || "");
    setCropSource("");
    setCropZoom(1);
    setCropX(0);
    setCropY(0);
    setCropBusy(false);
  }, [open, me]);

  if (!open) return null;

  const uploadFromFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      if (data) setCropSource(data);
    };
    reader.readAsDataURL(file);
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const buildCroppedDataUrl = () =>
    new Promise((resolve, reject) => {
      if (!cropSource) {
        reject(new Error("Missing crop source."));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const stage = 240;
        const outSize = 512;
        const baseScale = Math.max(stage / img.width, stage / img.height);
        const scale = baseScale * cropZoom;
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const maxOffsetX = Math.max(0, (drawW - stage) / 2);
        const maxOffsetY = Math.max(0, (drawH - stage) / 2);
        const offsetX = (clamp(cropX, -100, 100) / 100) * maxOffsetX;
        const offsetY = (clamp(cropY, -100, 100) / 100) * maxOffsetY;
        const drawX = stage / 2 - drawW / 2 + offsetX;
        const drawY = stage / 2 - drawH / 2 + offsetY;

        const canvas = document.createElement("canvas");
        canvas.width = outSize;
        canvas.height = outSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Cannot create canvas context."));
          return;
        }

        const ratio = outSize / stage;
        ctx.drawImage(img, drawX * ratio, drawY * ratio, drawW * ratio, drawH * ratio);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Cannot read image."));
      img.src = cropSource;
    });

  const cropAndUpload = async () => {
    if (!cropSource || cropBusy || uploadingAvatar) return;
    setCropBusy(true);
    try {
      const dataUrl = await buildCroppedDataUrl();
      await onUploadAvatar(dataUrl);
      setCropSource("");
    } finally {
      setCropBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    onSave({
      displayName: displayName.trim(),
      bio: bio.trim(),
      avatarUrl: avatarUrl.trim()
    });
  };

  return (
    <div className="board-settings-modal-backdrop" onClick={onClose}>
      <form className="action-confirm-modal profile-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Profile</h3>
        <p className="muted">Update your public profile.</p>
        <div className="profile-header">
          {avatarUrl ? <img className="profile-avatar" src={avatarUrl} alt="Avatar preview" /> : <div className="profile-avatar fallback">{(displayName || me.user || "?").slice(0, 1).toUpperCase()}</div>}
          <div>
            <div className="profile-username">@{me.user}</div>
            <div className="muted">Shown in invites and games.</div>
          </div>
        </div>
        <label>
          Display Name
          <input maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
        </label>
        <label>
          Avatar URL
          <input maxLength={500} value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
        </label>
        <div
          className={`avatar-drop-zone ${dragOver ? "is-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer?.files?.[0];
            if (file) uploadFromFile(file);
          }}
        >
          <div className="muted">Drag image here to upload avatar</div>
          <label className="btn btn-quiet upload-avatar-btn">
            {uploadingAvatar ? "Uploading..." : "Upload Picture"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => uploadFromFile(e.target.files?.[0])}
              hidden
              disabled={uploadingAvatar}
            />
          </label>
        </div>
        {cropSource ? (
          <div className="crop-editor">
            <div className="crop-stage">
              <img
                src={cropSource}
                alt="Crop preview"
                style={{
                  transform: `translate(${cropX}%, ${cropY}%) scale(${cropZoom})`
                }}
              />
            </div>
            <div className="crop-controls">
              <label>
                Zoom
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                />
              </label>
              <label>
                Horizontal
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={cropX}
                  onChange={(e) => setCropX(Number(e.target.value))}
                />
              </label>
              <label>
                Vertical
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={cropY}
                  onChange={(e) => setCropY(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="confirm-actions">
              <button type="button" className="btn btn-quiet" onClick={() => setCropSource("")} disabled={cropBusy || uploadingAvatar}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={cropAndUpload} disabled={cropBusy || uploadingAvatar}>
                {cropBusy || uploadingAvatar ? "Uploading..." : "Crop & Upload"}
              </button>
            </div>
          </div>
        ) : null}
        <label>
          Bio
          <textarea maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Short intro..." />
        </label>
        {error ? <div className="error-box">{String(error)}</div> : null}
        <div className="confirm-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Profile"}</button>
        </div>
      </form>
    </div>
  );
}

export default ProfileModal;
