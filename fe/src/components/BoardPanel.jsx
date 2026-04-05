import { useEffect, useMemo, useRef, useState } from "react";
import { toRowCol } from "../chess/logic";

function BoardPanel({
  theme,
  boardScale,
  topPlayer,
  bottomPlayer,
  orientedSquares,
  board,
  dragFrom,
  selected,
  legalTargets,
  status,
  resizeState,
  boardSettingsOpen,
  dragPos,
  dragPieceSize,
  onSquareClick,
  onPieceMouseDown,
  onToggleSettings,
  onStartResize,
  promotionPrompt,
  onPromotionPick,
  onPromotionCancel
}) {
  const mainRowRef = useRef(null);
  const [fitSize, setFitSize] = useState(420);

  useEffect(() => {
    const update = () => {
      const row = mainRowRef.current;
      if (!row) return;
      const rect = row.getBoundingClientRect();
      const availableWidth = Math.max(180, rect.width - 4);
      const availableHeight = Math.max(180, rect.height - 4);
      const base = Math.min(availableWidth, availableHeight);
      const normalized = Math.max(55, Math.min(100, Number(boardScale || 70)));
      const scale = normalized / 70; // 70 => full fit size, lower => shrink
      const sized = Math.min(base, base * scale);
      setFitSize(Math.max(180, Math.round(sized)));
    };

    update();
    const ro = new ResizeObserver(update);
    if (mainRowRef.current) ro.observe(mainRowRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [boardScale]);

  const promotionOverlay = useMemo(() => {
    if (!promotionPrompt || !Number.isInteger(promotionPrompt.to)) return null;
    const cell = orientedSquares.indexOf(Number(promotionPrompt.to));
    if (cell < 0 || fitSize <= 0) return null;
    const square = fitSize / 8;
    const row = Math.floor(cell / 8);
    const col = cell % 8;
    const panelWidth = 170;
    const panelHeight = 204;
    let left = col * square + square + 6;
    if (left + panelWidth > fitSize) left = col * square - panelWidth - 6;
    if (left < 2) left = 2;
    let top = row * square;
    if (top + panelHeight > fitSize) top = fitSize - panelHeight - 2;
    if (top < 2) top = 2;
    const color = String(promotionPrompt.color || "w") === "b" ? "b" : "w";
    return {
      left,
      top,
      color
    };
  }, [promotionPrompt, orientedSquares, fitSize]);

  return (
    <div className="board-panel-shell" style={{ "--board-fit-size": `${fitSize}px` }}>
      <div className="board-panel-tools">
        <button
          type="button"
          className={`board-settings-handle ${boardSettingsOpen ? "active" : ""}`}
          onClick={onToggleSettings}
          title="Board settings"
          aria-label="Board settings"
        >
          {"\u2699"}
        </button>
        <button
          type="button"
          className={`board-resize-handle ${resizeState ? "active" : ""}`}
          onMouseDown={onStartResize}
          title="Drag to resize board"
          aria-label="Drag to resize board"
        >
          {"\u2194"}
        </button>
      </div>
      <section
        className="board-panel"
        style={{
          "--light-square": theme.light,
          "--dark-square": theme.dark,
          "--board-fit-size": `${fitSize}px`
        }}
      >
        <div className="player-strip">
          {topPlayer.avatarUrl ? (
            <img className="player-avatar" src={topPlayer.avatarUrl} alt={topPlayer.label} />
          ) : (
            <span className="player-avatar fallback">{String(topPlayer.label || "?").slice(0, 1).toUpperCase()}</span>
          )}
          <span className="clock-name-inline">{topPlayer.label}</span>
          <span className="clock-pill">{topPlayer.clock}</span>
        </div>
        <div className="board-main-row" ref={mainRowRef}>
          <div className="board-resize-wrap" style={{ "--board-scale": boardScale, "--board-fit-size": `${fitSize}px` }}>
            <div className="board-wrap">
              <div className="board">
                {orientedSquares.map((index) => {
                  const [r, c] = toRowCol(index);
                  const dark = (r + c) % 2 === 1;
                  const piece = board[index];
                  const renderedPiece = dragFrom === index ? null : piece;
                  const isSelected = selected === index;
                  const isLegal = legalTargets.includes(index);
                  return (
                    <button
                      key={index}
                      data-square-index={index}
                      className={`square ${dark ? "dark" : "light"} ${isSelected ? "selected" : ""} ${isLegal ? "legal" : ""} ${isLegal && piece ? "capture" : ""}`}
                      onClick={() => onSquareClick(index)}
                    >
                      {renderedPiece ? (
                        <img
                          src={`/assets/pieces/${renderedPiece}.png`}
                          alt={renderedPiece}
                          draggable={false}
                          onMouseDown={(e) => onPieceMouseDown(e, index)}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            {dragFrom !== null && dragPos && board[dragFrom] ? (
              <img
                className="drag-ghost"
                src={`/assets/pieces/${board[dragFrom]}.png`}
                alt=""
                style={{
                  width: `${dragPieceSize}px`,
                  height: `${dragPieceSize}px`,
                  left: `${dragPos.x - dragPieceSize / 2}px`,
                  top: `${dragPos.y - dragPieceSize / 2}px`
                }}
              />
            ) : null}
            {promotionOverlay ? (
              <div
                className="promotion-panel"
                style={{ left: `${promotionOverlay.left}px`, top: `${promotionOverlay.top}px` }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="promotion-title">Promote To</div>
                <div className="promotion-grid">
                  {[
                    { id: "q", label: "Queen" },
                    { id: "r", label: "Rook" },
                    { id: "b", label: "Bishop" },
                    { id: "n", label: "Knight" }
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="promotion-option"
                      onClick={() => onPromotionPick(item.id)}
                      title={item.label}
                      aria-label={item.label}
                    >
                      <img src={`/assets/pieces/${promotionOverlay.color}${item.id}.png`} alt={item.label} draggable={false} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="promotion-cancel" onClick={onPromotionCancel}>
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="player-strip">
          {bottomPlayer.avatarUrl ? (
            <img className="player-avatar" src={bottomPlayer.avatarUrl} alt={bottomPlayer.label} />
          ) : (
            <span className="player-avatar fallback">{String(bottomPlayer.label || "?").slice(0, 1).toUpperCase()}</span>
          )}
          <span className="clock-name-inline">{bottomPlayer.label}</span>
          <span className="clock-pill">{bottomPlayer.clock}</span>
        </div>
      {status ? (
        <div className="status" style={{ "--board-scale": boardScale }}>
          <span>{status}</span>
        </div>
      ) : null}
      </section>
    </div>
  );
}

export default BoardPanel;
