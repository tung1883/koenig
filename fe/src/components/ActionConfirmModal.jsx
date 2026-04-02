function ActionConfirmModal({ action, incomingDraw, onClose, onConfirm }) {
  if (!action) return null;

  return (
    <div className="board-settings-modal-backdrop" onClick={onClose}>
      <div className="action-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{action === "resign" ? "Confirm Resign" : incomingDraw ? "Accept Draw" : "Offer Draw"}</h3>
        <p className="muted">
          {action === "resign"
            ? "Are you sure you want to resign this game?"
            : incomingDraw
              ? "Are you sure you want to accept this draw?"
              : "Are you sure you want to offer a draw?"}
        </p>
        <div className="confirm-actions">
          <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button className={`btn ${action === "resign" ? "btn-action-resign" : "btn-action-draw"}`} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default ActionConfirmModal;
