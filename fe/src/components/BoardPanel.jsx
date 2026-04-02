import { useEffect, useRef, useState } from "react";
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
  onStartResize
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
