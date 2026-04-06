import { useEffect, useMemo, useRef, useState } from "react"
import { Chess } from "chess.js"
import BoardPanel from "./BoardPanel"
import ComputerSidebar from "./ComputerSidebar"
import useMoveSound from "../hooks/useMoveSound"
import useStockfishEngine from "../hooks/useStockfishEngine"
import { indexToCoord } from "../chess/logic"

const START_FEN = new Chess().fen()

function coordToIndex(coord) {
    if (!coord || coord.length < 2) return -1
    const file = coord.charCodeAt(0) - 97
    const rank = Number(coord[1])
    if (file < 0 || file > 7 || rank < 1 || rank > 8) return -1
    return (8 - rank) * 8 + file
}

function chessToBoard(chess) {
    return chess
        .board()
        .flat()
        .map((piece) => (piece ? `${piece.color}${piece.type}` : null))
}

function buildInitialTree() {
    return {
        root: {
            id: "root",
            parentId: null,
            fen: START_FEN,
            san: null,
            uci: null,
            children: [],
        },
    }
}

function getPath(nodes, nodeId) {
    const path = []
    let current = nodes[nodeId]
    while (current) {
        path.push(current)
        current = current.parentId ? nodes[current.parentId] : null
    }
    return path.reverse()
}

function buildLineRows(nodes, currentNodeId) {
    const path = getPath(nodes, currentNodeId)
    const rows = []
    for (let ply = 1; ply < path.length; ply += 1) {
        const node = path[ply]
        const parent = nodes[node.parentId]
        if (!parent) continue
        const rowIndex = Math.floor((ply - 1) / 2)
        const moveNumber = Math.floor((ply + 1) / 2)
        const side = ply % 2 === 1 ? "white" : "black"
        if (!rows[rowIndex]) {
            rows[rowIndex] = {
                moveNumber,
                white: null,
                black: null,
            }
        }
        rows[rowIndex][side] = {
            activeId: node.id,
            options: parent.children.map((childId) => {
                const child = nodes[childId]
                return { id: child.id, san: child.san }
            }),
        }
    }
    return rows
}

function deepestChildId(nodes, nodeId) {
    let currentId = nodeId
    while (nodes[currentId]?.children?.length) {
        const children = nodes[currentId].children
        currentId = children[children.length - 1]
    }
    return currentId
}

function upsertChild(nodes, parentId, move, nextFen, nextIdRef) {
    const parent = nodes[parentId]
    const uci = `${move.from}${move.to}${move.promotion || ""}`
    const existingId = parent.children.find((childId) => nodes[childId]?.uci === uci)
    if (existingId) {
        return {
            nodes,
            currentNodeId: existingId,
        }
    }

    const id = `node-${nextIdRef.current}`
    nextIdRef.current += 1

    return {
        nodes: {
            ...nodes,
            [parentId]: {
                ...parent,
                children: [...parent.children, id],
            },
            [id]: {
                id,
                parentId,
                fen: nextFen,
                san: move.san,
                uci,
                children: [],
            },
        },
        currentNodeId: id,
    }
}

function appendMove(nodes, parentId, move, nextFen, nextIdRef) {
    return upsertChild(nodes, parentId, move, nextFen, nextIdRef)
}

function describeStatus(chess, humanColor, engineReady, engineBusy, engineError) {
    if (engineError) return engineError
    if (!engineReady) return "Loading Stockfish..."
    if (chess.isCheckmate()) {
        return chess.turn() === humanColor ? "Checkmate. Stockfish wins." : "Checkmate. You win."
    }
    if (chess.isDraw()) return "Game drawn."
    if (engineBusy) return "Stockfish is thinking..."
    return chess.turn() === humanColor ? "Your move." : "Stockfish to move."
}

function ComputerPlayPage({
    theme,
    boardScale,
    boardDirection,
    boardSettingsOpen,
    resizeState,
    startResize,
    setBoardSettingsOpen,
}) {
    const nextIdRef = useRef(1)
    const playMoveSound = useMoveSound()
    const [humanColor, setHumanColor] = useState("w")
    const [skillLevel, setSkillLevel] = useState(6)
    const [moveTime, setMoveTime] = useState(160)
    const { ready: engineReady, info: engineInfo, error: engineError, requestBestMove, stopSearch } = useStockfishEngine({ skillLevel })
    const [nodes, setNodes] = useState(() => buildInitialTree())
    const [currentNodeId, setCurrentNodeId] = useState("root")
    const [queuedEngineTurn, setQueuedEngineTurn] = useState(false)
    const [engineBusy, setEngineBusy] = useState(false)
    const [selected, setSelected] = useState(null)
    const [dragFrom, setDragFrom] = useState(null)
    const [dragPos, setDragPos] = useState(null)
    const [dragPieceSize, setDragPieceSize] = useState(44)
    const [promotionPrompt, setPromotionPrompt] = useState(null)

    const currentNode = nodes[currentNodeId]
    const currentChess = useMemo(() => new Chess(currentNode?.fen || START_FEN), [currentNode?.fen])
    const nodesRef = useRef(nodes)
    const currentNodeRef = useRef(currentNode)
    const searchTokenRef = useRef(0)
    const board = useMemo(() => chessToBoard(currentChess), [currentChess])
    const engineColor = humanColor === "w" ? "b" : "w"
    const boardPerspective = useMemo(() => {
        if (boardDirection === "white") return "white"
        if (boardDirection === "black") return "black"
        return humanColor === "b" ? "black" : "white"
    }, [boardDirection, humanColor])
    const orientedSquares = useMemo(() => {
        const squares = []
        if (boardPerspective === "white") {
            for (let i = 0; i < 64; i += 1) squares.push(i)
            return squares
        }
        for (let i = 63; i >= 0; i -= 1) squares.push(i)
        return squares
    }, [boardPerspective])

    const legalTargets = useMemo(() => {
        if (selected === null) return []
        const source = indexToCoord(selected)
        return currentChess
            .moves({ square: source, verbose: true })
            .map((move) => coordToIndex(move.to))
            .filter((index) => index >= 0)
    }, [currentChess, selected])

    const lineRows = useMemo(() => buildLineRows(nodes, currentNodeId), [nodes, currentNodeId])
    const totalVariations = useMemo(() => Math.max(0, Object.keys(nodes).length - 1), [nodes])
    const status = useMemo(
        () => describeStatus(currentChess, humanColor, engineReady, engineBusy, engineError),
        [currentChess, humanColor, engineReady, engineBusy, engineError]
    )

    useEffect(() => {
        nodesRef.current = nodes
        currentNodeRef.current = currentNode
    }, [nodes, currentNode])

    useEffect(() => {
        return () => {
            searchTokenRef.current += 1
            stopSearch()
        }
    }, [stopSearch])

    const topPlayer =
        boardPerspective === "white"
            ? { color: "black", label: humanColor === "b" ? "You" : "Stockfish", clock: "--:--", avatarUrl: "" }
            : { color: "white", label: humanColor === "w" ? "You" : "Stockfish", clock: "--:--", avatarUrl: "" }
    const bottomPlayer =
        boardPerspective === "white"
            ? { color: "white", label: humanColor === "w" ? "You" : "Stockfish", clock: "--:--", avatarUrl: "" }
            : { color: "black", label: humanColor === "b" ? "You" : "Stockfish", clock: "--:--", avatarUrl: "" }

    const resetGame = (nextHumanColor = humanColor) => {
        stopSearch()
        nextIdRef.current = 1
        setNodes(buildInitialTree())
        setCurrentNodeId("root")
        setHumanColor(nextHumanColor)
        setQueuedEngineTurn(nextHumanColor === "b")
        setEngineBusy(false)
        setSelected(null)
        setDragFrom(null)
        setDragPos(null)
        setPromotionPrompt(null)
    }

    const jumpToNode = (nodeId) => {
        stopSearch()
        setQueuedEngineTurn(false)
        setEngineBusy(false)
        setCurrentNodeId(nodeId)
        setSelected(null)
        setDragFrom(null)
        setDragPos(null)
        setPromotionPrompt(null)
        playMoveSound()
    }

    const parentId = currentNode?.parentId || null
    const canStepForward = Boolean(currentNode?.children?.length)

    useEffect(() => {
        const onKeyDown = (event) => {
            const target = event.target
            const tag = target?.tagName?.toLowerCase?.() || ""
            const isTyping = tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable
            if (isTyping) return

            if (event.key === "ArrowLeft" && parentId) {
                event.preventDefault()
                jumpToNode(parentId)
            } else if (event.key === "ArrowRight" && canStepForward) {
                event.preventDefault()
                jumpToNode(currentNode.children[currentNode.children.length - 1])
            } else if (event.key === "ArrowUp") {
                event.preventDefault()
                jumpToNode("root")
            } else if (event.key === "ArrowDown") {
                event.preventDefault()
                jumpToNode(deepestChildId(nodes, currentNodeId))
            }
        }

        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [canStepForward, currentNode?.children, currentNodeId, jumpToNode, nodes, parentId])

    const commitMove = (move) => {
        const chess = new Chess(currentNode.fen)
        const result = chess.move(move)
        if (!result) return false

        const outcome = appendMove(nodes, currentNodeId, result, chess.fen(), nextIdRef)
        setNodes(outcome.nodes)
        setCurrentNodeId(outcome.currentNodeId)
        setQueuedEngineTurn(result.color === humanColor)
        setSelected(null)
        setDragFrom(null)
        setDragPos(null)
        setPromotionPrompt(null)
        playMoveSound()
        return true
    }

    const submitMove = (from, to, promotionChoice) => {
        if (engineBusy || currentChess.turn() !== humanColor) return
        const fromCoord = indexToCoord(from)
        const toCoord = indexToCoord(to)
        const candidates = currentChess.moves({ square: fromCoord, verbose: true }).filter((move) => move.to === toCoord)
        if (!candidates.length) return

        const needsPromotion = candidates.some((move) => move.promotion)
        if (needsPromotion && !promotionChoice) {
            setPromotionPrompt({
                from,
                to,
                color: String(board[from]?.[0] || humanColor),
            })
            return
        }

        commitMove({
            from: fromCoord,
            to: toCoord,
            promotion: needsPromotion ? String(promotionChoice || "q").toLowerCase() : undefined,
        })
    }

    useEffect(() => {
        if (!engineReady || !queuedEngineTurn || engineBusy) return
        const activeNode = currentNodeRef.current
        const activeChess = new Chess(activeNode?.fen || START_FEN)
        if (activeChess.turn() !== engineColor) return
        if (activeChess.isGameOver()) return
        if (activeNode.children.length > 0) return

        const token = searchTokenRef.current + 1
        searchTokenRef.current = token
        const positionNodeId = activeNode.id
        setEngineBusy(true)

        requestBestMove({ fen: activeNode.fen, moveTime })
            .then((bestmove) => {
                if (searchTokenRef.current !== token || !bestmove || bestmove === "(none)") return
                const latestNodes = nodesRef.current
                const positionNode = latestNodes[positionNodeId]
                if (!positionNode) return
                const chess = new Chess(positionNode.fen)
                const nextMove = {
                    from: bestmove.slice(0, 2),
                    to: bestmove.slice(2, 4),
                    promotion: bestmove.length > 4 ? bestmove.slice(4, 5) : undefined,
                }
                const result = chess.move(nextMove)
                if (!result) return

                const outcome = appendMove(latestNodes, positionNodeId, result, chess.fen(), nextIdRef)
                setNodes(outcome.nodes)
                setCurrentNodeId(outcome.currentNodeId)
                setQueuedEngineTurn(false)
                playMoveSound()
            })
            .catch(() => {
                if (searchTokenRef.current === token) setQueuedEngineTurn(false)
            })
            .finally(() => {
                if (searchTokenRef.current === token) setEngineBusy(false)
            })
    }, [
        engineColor,
        engineReady,
        moveTime,
        playMoveSound,
        queuedEngineTurn,
        requestBestMove,
        engineBusy,
    ])

    const onSquareClick = (index) => {
        if (engineBusy || currentChess.turn() !== humanColor) return
        const piece = board[index]

        if (selected === null) {
            if (!piece || piece[0] !== humanColor) return
            setSelected(index)
            return
        }

        if (selected === index) {
            setSelected(null)
            return
        }

        if (piece && piece[0] === humanColor) {
            setSelected(index)
            return
        }

        if (!legalTargets.includes(index)) {
            setSelected(null)
            return
        }

        submitMove(selected, index)
    }

    const onDragStartSquare = (index) => {
        if (engineBusy || currentChess.turn() !== humanColor) return
        const piece = board[index]
        if (!piece || piece[0] !== humanColor) return
        setSelected(index)
        setDragFrom(index)
    }

    const onPieceMouseDown = (event, index) => {
        event.preventDefault()
        onDragStartSquare(index)
        const rect = event.currentTarget.getBoundingClientRect()
        setDragPieceSize(Math.max(24, Math.round(rect.width)))
        setDragPos({ x: event.clientX, y: event.clientY })
    }

    const onDropSquare = (index) => {
        if (dragFrom === null) return
        if (index !== dragFrom && legalTargets.includes(index)) {
            submitMove(dragFrom, index)
        }
        setDragFrom(null)
        setSelected(null)
        setDragPos(null)
    }

    useEffect(() => {
        if (dragFrom === null) return undefined
        const onMove = (event) => {
            setDragPos({ x: event.clientX, y: event.clientY })
        }
        const onUp = (event) => {
            const target = document.elementFromPoint(event.clientX, event.clientY)
            const squareEl = target?.closest?.("[data-square-index]")
            if (squareEl) {
                const idx = Number(squareEl.getAttribute("data-square-index"))
                if (Number.isInteger(idx)) onDropSquare(idx)
            } else {
                setDragFrom(null)
                setSelected(null)
                setDragPos(null)
            }
        }
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
        return () => {
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
        }
    }, [dragFrom, legalTargets])

    return (
        <main className="layout">
            <BoardPanel
                theme={theme}
                boardScale={boardScale}
                topPlayer={topPlayer}
                bottomPlayer={bottomPlayer}
                orientedSquares={orientedSquares}
                board={board}
                dragFrom={dragFrom}
                selected={selected}
                legalTargets={legalTargets}
                status={status}
                resizeState={resizeState}
                boardSettingsOpen={boardSettingsOpen}
                dragPos={dragPos}
                dragPieceSize={dragPieceSize}
                onSquareClick={onSquareClick}
                onPieceMouseDown={onPieceMouseDown}
                onToggleSettings={() => setBoardSettingsOpen((value) => !value)}
                onStartResize={startResize}
                promotionPrompt={promotionPrompt}
                onPromotionPick={(piece) => submitMove(promotionPrompt.from, promotionPrompt.to, piece)}
                onPromotionCancel={() => setPromotionPrompt(null)}
            />

            <aside className="side-panel side-panel--game">
                <ComputerSidebar
                    humanColor={humanColor}
                    onResetAs={resetGame}
                    skillLevel={skillLevel}
                    moveTime={moveTime}
                    onSkillLevelChange={setSkillLevel}
                    onMoveTimeChange={setMoveTime}
                    lineRows={lineRows}
                    currentNodeId={currentNodeId}
                    totalVariations={totalVariations}
                    onJumpToNode={jumpToNode}
                    onJumpToStart={() => jumpToNode("root")}
                    onStepBackward={() => parentId && jumpToNode(parentId)}
                    onStepForward={() => canStepForward && jumpToNode(currentNode.children[currentNode.children.length - 1])}
                    onJumpToLatest={() => jumpToNode(deepestChildId(nodes, currentNodeId))}
                    canStepBackward={Boolean(parentId)}
                    canStepForward={canStepForward}
                    engineReady={engineReady}
                    engineBusy={engineBusy}
                    engineInfo={engineInfo}
                    status={status}
                />
            </aside>
        </main>
    )
}

export default ComputerPlayPage
