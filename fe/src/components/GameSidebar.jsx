import { useEffect, useRef } from "react";

function GameSidebar({
  game,
  notationEntries,
  moveNumber,
  maxPly,
  viewPly,
  drawing,
  resigning,
  outgoingDraw,
  incomingDraw,
  onOpenConfirm,
  onJumpToPly,
  chatMessages,
  me,
  userMap,
  chatInput,
  onChatInputChange,
  onSubmitChat,
  chatLoading
}) {
  const chatListRef = useRef(null);

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages.length]);

  if (!game) return null;

  return (
    <>
      <div className="card move-card">
        <h3>Move Record</h3>
        <div className="moves">
          {Array.from({ length: Math.ceil(notationEntries.length / 2) }, (_, rowIdx) => {
            const w = notationEntries[rowIdx * 2];
            const b = notationEntries[rowIdx * 2 + 1];
            const whitePly = rowIdx * 2 + 1;
            const blackPly = rowIdx * 2 + 2;
            return (
              <div key={`mrow-${rowIdx}`} className="move-row">
                <span>{rowIdx + 1}.</span>
                <button
                  type="button"
                  className={`move-cell-btn ${viewPly === whitePly ? "is-active" : ""}`}
                  onClick={() => onJumpToPly(whitePly)}
                  disabled={!w || whitePly > maxPly}
                >
                  <span className="move-cell">
                    <span className="move-piece-slot">
                      {w?.pieceCode && !(w?.notation || "").startsWith("O-O")
                        ? <img src={`/assets/pieces/${w.pieceCode}.png`} alt={w.pieceCode} className="move-piece" />
                        : null}
                    </span>
                    <span className="move-notation">{w?.notation || "-"}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className={`move-cell-btn ${viewPly === blackPly ? "is-active" : ""}`}
                  onClick={() => onJumpToPly(blackPly)}
                  disabled={!b || blackPly > maxPly}
                >
                  <span className="move-cell">
                    <span className="move-piece-slot">
                      {b?.pieceCode && !(b?.notation || "").startsWith("O-O")
                        ? <img src={`/assets/pieces/${b.pieceCode}.png`} alt={b.pieceCode} className="move-piece" />
                        : null}
                    </span>
                    <span className="move-notation">{b?.notation || ""}</span>
                  </span>
                </button>
              </div>
            );
          })}
          {!game.record ? <span className="muted">No moves yet.</span> : null}
        </div>
        <div className="kv"><span>Moves</span><strong>{Math.max(0, moveNumber + 1)}</strong></div>
        <div className="game-actions">
          <button className="btn btn-action-draw" onClick={() => onOpenConfirm("draw")} disabled={drawing || resigning || outgoingDraw}>
            {drawing ? "Processing..." : incomingDraw ? "Accept Draw" : outgoingDraw ? "Draw Offered" : "Offer Draw"}
          </button>
          <button className="btn btn-action-resign" onClick={() => onOpenConfirm("resign")} disabled={resigning || drawing}>
            {resigning ? <span className="spinner" /> : null}
            {resigning ? "Resigning..." : "Resign"}
          </button>
        </div>
      </div>

      <div className="card chat-card">
        <h3>In-Game Chat</h3>
        <div className="chat-list" ref={chatListRef}>
          {chatMessages.length === 0 ? <div className="muted">No messages yet.</div> : null}
          {chatMessages.map((item, idx) => {
            const mine = Number(item.userID) === Number(me.userID);
            const name = mine ? "You" : userMap[Number(item.userID)] || `Player ${item.userID}`;
            return (
              <div key={`${item.userID}-${idx}`} className={`chat-item ${mine ? "mine" : ""}`}>
                <div className="chat-meta">{name}</div>
                <div>{item.message}</div>
              </div>
            );
          })}
        </div>
        <form className="chat-form" onSubmit={onSubmitChat}>
          <input
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            placeholder="Type a message..."
          />
          <button className="btn btn-primary" type="submit" disabled={chatLoading || !chatInput.trim()}>
            Send
          </button>
        </form>
      </div>
    </>
  );
}

export default GameSidebar;
