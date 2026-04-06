function ComputerSidebar({
    humanColor,
    onResetAs,
    skillLevel,
    moveTime,
    onSkillLevelChange,
    onMoveTimeChange,
    lineRows,
    currentNodeId,
    totalVariations,
    onJumpToNode,
    onJumpToStart,
    onStepBackward,
    onStepForward,
    onJumpToLatest,
    canStepBackward,
    canStepForward,
    engineReady,
    engineBusy,
    engineInfo,
    status,
}) {
    return (
        <>
            <div className="card move-card">
                <h3>Play With Computer</h3>
                <div className="computer-controls">
                    <div className="field-label">You Play</div>
                    <div className="preset-row">
                        <button
                            type="button"
                            className={`btn btn-mode ${humanColor === "w" ? "is-active" : ""}`}
                            onClick={() => onResetAs("w")}
                        >
                            White
                        </button>
                        <button
                            type="button"
                            className={`btn btn-mode ${humanColor === "b" ? "is-active" : ""}`}
                            onClick={() => onResetAs("b")}
                        >
                            Black
                        </button>
                    </div>
                    <div className="field-label">Engine Skill</div>
                    <input
                        type="range"
                        min="0"
                        max="20"
                        value={skillLevel}
                        onChange={(e) => onSkillLevelChange(Number(e.target.value))}
                    />
                    <div className="kv">
                        <span>Skill Level</span>
                        <strong>{skillLevel}</strong>
                    </div>
                    <div className="field-label">Stockfish Time Limit</div>
                    <select value={moveTime} onChange={(e) => onMoveTimeChange(Number(e.target.value))}>
                        <option value={80}>80 ms</option>
                        <option value={160}>160 ms</option>
                        <option value={300}>300 ms</option>
                        <option value={700}>700 ms</option>
                        <option value={1200}>1200 ms</option>
                    </select>
                    <div className="kv">
                        <span>Time Limit</span>
                        <strong>{moveTime} ms</strong>
                    </div>
                    <div className="kv">
                        <span>Variations</span>
                        <strong>{totalVariations}</strong>
                    </div>
                    <div className="kv">
                        <span>Engine</span>
                        <strong>{engineReady ? (engineBusy ? "Thinking" : "Ready") : "Loading"}</strong>
                    </div>
                    {engineInfo ? (
                        <div className="kv">
                            <span>Eval</span>
                            <strong>{engineInfo}</strong>
                        </div>
                    ) : null}
                    <button type="button" className="btn btn-primary" onClick={() => onResetAs(humanColor)}>
                        New Game
                    </button>
                </div>
            </div>

            <div className="card move-card">
                <h3>History</h3>
                <div className="history-nav">
                    <button type="button" className="btn btn-quiet" onClick={onJumpToStart}>
                        {"|<"}
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={onStepBackward} disabled={!canStepBackward}>
                        {"<"}
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={onStepForward} disabled={!canStepForward}>
                        {">"}
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={onJumpToLatest}>
                        {">|"}
                    </button>
                </div>
                <div className="moves">
                    {lineRows.length === 0 ? <span className="muted">No moves yet.</span> : null}
                    {lineRows.map((row) => (
                        <div key={`line-${row.moveNumber}`} className="move-row move-row-variation">
                            <span>{row.moveNumber}.</span>
                            {["white", "black"].map((side) => {
                                const cell = row[side]
                                return (
                                    <div key={`${row.moveNumber}-${side}`} className="variation-cell">
                                        {cell?.options?.length ? (
                                            cell.options.map((option) => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    className={`move-cell-btn ${option.id === currentNodeId ? "is-active" : ""}`}
                                                    onClick={() => onJumpToNode(option.id)}
                                                >
                                                    <span className="move-cell">
                                                        <span className="move-notation">{option.san}</span>
                                                    </span>
                                                </button>
                                            ))
                                        ) : (
                                            <span className="move-cell-placeholder">-</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="card chat-card">
                <h3>Position</h3>
                <p className="muted computer-status-copy">{status}</p>
                <p className="muted">
                    Going back in history does not overwrite the line. Any move from an earlier node becomes a new variation automatically.
                </p>
            </div>
        </>
    )
}

export default ComputerSidebar
