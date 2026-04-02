function BoardSettingsModal({
  open,
  boardScale,
  boardDirection,
  boardTheme,
  themes,
  onClose,
  onBoardScaleChange,
  onBoardDirectionChange,
  onBoardThemeChange
}) {
  if (!open) return null;

  return (
    <div className="board-settings-modal-backdrop" onClick={onClose}>
      <div className="board-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="board-settings-header">
          <h3>Board Settings</h3>
          <button
            type="button"
            className="btn btn-quiet board-settings-close"
            onClick={onClose}
            aria-label="Close board settings"
          >
            X
          </button>
        </div>
        <div className="settings-row">
          <span className="field-label">Board Size</span>
          <div className="board-size-inline">
            <input
              type="range"
              min="55"
              max="95"
              value={Math.round(boardScale)}
              onChange={(e) => onBoardScaleChange(Math.max(55, Math.min(95, Number(e.target.value))))}
            />
            <span>{Math.round(boardScale)}%</span>
          </div>
        </div>
        <div className="settings-row">
          <span className="field-label">Direction</span>
          <div className="segmented">
            <button
              type="button"
              className={`btn btn-quiet ${boardDirection === "auto" ? "is-active" : ""}`}
              onClick={() => onBoardDirectionChange("auto")}
            >
              Auto
            </button>
            <button
              type="button"
              className={`btn btn-quiet ${boardDirection === "white" ? "is-active" : ""}`}
              onClick={() => onBoardDirectionChange("white")}
            >
              White
            </button>
            <button
              type="button"
              className={`btn btn-quiet ${boardDirection === "black" ? "is-active" : ""}`}
              onClick={() => onBoardDirectionChange("black")}
            >
              Black
            </button>
          </div>
        </div>
        <div className="settings-row">
          <span className="field-label">Theme</span>
          <div className="segmented">
            {Object.entries(themes).map(([id, item]) => (
              <button
                key={id}
                type="button"
                className={`btn btn-quiet ${boardTheme === id ? "is-active" : ""}`}
                onClick={() => onBoardThemeChange(id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BoardSettingsModal;
