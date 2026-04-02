function ResultModal({ result, onClose }) {
  if (!result) return null;

  return (
    <div className="board-settings-modal-backdrop" onClick={onClose}>
      <div className="action-confirm-modal game-result-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`result-chip ${result.tone || "draw"}`}>
          {result.tone === "win" ? "Victory" : result.tone === "loss" ? "Defeat" : "Draw"}
        </div>
        <h3>{result.title}</h3>
        <p className="result-detail">{result.detail}</p>
        <div className="confirm-actions">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default ResultModal;
