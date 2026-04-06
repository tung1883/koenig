import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import AuthCard from "./components/AuthCard"
import ActionConfirmModal from "./components/ActionConfirmModal"
import BoardPanel from "./components/BoardPanel"
import ComputerPlayPage from "./components/ComputerPlayPage"
import BoardSettingsModal from "./components/BoardSettingsModal"
import GameSidebar from "./components/GameSidebar"
import InviteHub from "./components/InviteHub"
import ProfileModal from "./components/ProfileModal"
import ResultModal from "./components/ResultModal"
import TopBar from "./components/TopBar"
import { useLocation, useNavigate } from "react-router-dom"
import useAuthSession from "./hooks/useAuthSession"
import useBoardSettings from "./hooks/useBoardSettings"
import useGameRealtime from "./hooks/useGameRealtime"
import useMoveSound from "./hooks/useMoveSound"
import useTicker from "./hooks/useTicker"
import useUsersData from "./hooks/useUsersData"
import { activeGameApi, usersApi } from "./api"
import {
    BOARD_THEMES,
    applyMove,
    buildNotationEntries,
    computeClocks,
    getInitialBoard,
    getLegalMoves,
    needsPromotionChoice,
    parseGameResult,
    parseRecord,
    sameSide,
} from "./chess/logic"

function App() {
    const location = useLocation()
    const navigate = useNavigate()
    const isComputerPage = location.pathname === "/play/computer"
    const { me, setMe, bootstrappingAuth, logout, clearSession } = useAuthSession()
    const { users, userMap, refreshUsers } = useUsersData(me)
    const [game, setGame] = useState(null)
    const [board, setBoard] = useState(getInitialBoard())
    const [selected, setSelected] = useState(null)
    const [dragFrom, setDragFrom] = useState(null)
    const [dragPos, setDragPos] = useState(null)
    const [dragPieceSize, setDragPieceSize] = useState(44)
    const [status, setStatus] = useState("")
    const [pending, setPending] = useState(false)
    const [resigning, setResigning] = useState(false)
    const [drawing, setDrawing] = useState(false)
    const [drawOffer, setDrawOffer] = useState(0)
    const [confirmAction, setConfirmAction] = useState(null)
    const {
        boardScale,
        setBoardScale,
        boardTheme,
        setBoardTheme,
        boardDirection,
        setBoardDirection,
        boardSettingsOpen,
        setBoardSettingsOpen,
        resizeState,
        startResize,
    } = useBoardSettings()
    const [localMoves, setLocalMoves] = useState([])
    const [moveNumber, setMoveNumber] = useState(-1)
    const tickNow = useTicker(250)
    const [chatInput, setChatInput] = useState("")
    const [chatLoading, setChatLoading] = useState(false)
    const [chatMessages, setChatMessages] = useState([])
    const [viewPly, setViewPly] = useState(0)
    const [timeoutSubmitting, setTimeoutSubmitting] = useState(false)
    const [resultModal, setResultModal] = useState(null)
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const [profileSaving, setProfileSaving] = useState(false)
    const [avatarUploading, setAvatarUploading] = useState(false)
    const [profileError, setProfileError] = useState("")
    const [promotionPrompt, setPromotionPrompt] = useState(null)
    const prevRecordLenRef = useRef(0)
    const prevGameIdRef = useRef(null)
    const timeoutSentRef = useRef("")
    const playMoveSound = useMoveSound()

    useEffect(() => {
        if (location.pathname === "/" || location.pathname === "/play/computer") return
        navigate("/", { replace: true })
    }, [location.pathname, navigate])

    useEffect(() => {
        if (!me || isComputerPage) return
        activeGameApi
            .getActiveGame()
            .then((res) => {
                if (res?.game && !res.game.result) {
                    setGame(res.game)
                } else {
                    if (res?.game?.result) {
                        openResultModal(res.game.result, res.game)
                    }
                    setGame(null)
                    setStatus("")
                }
            })
            .catch((error) => {
                if (error?.response?.status === 403) {
                    clearSession()
                    setMe(null)
                    setGame(null)
                    return
                }
            })
    }, [me, clearSession, isComputerPage, setMe])

    useEffect(() => {
        if (!game) {
            setMoveNumber(-1)
            setChatMessages([])
            return
        }
        setMoveNumber(Number(game.move_number ?? -1))
    }, [game])

    useEffect(() => {
        if (!game || !me) {
            setDrawOffer(0)
            return
        }
    }, [game?.gameID, me?.userID])

    const isWhite = useMemo(() => {
        if (!game || !me) return true
        return Number(game.wp) === Number(me.userID)
    }, [game, me])
    const recordMoves = useMemo(() => parseRecord(game?.record), [game?.record])
    const activeMoves = game ? recordMoves : localMoves
    const notationEntries = useMemo(() => buildNotationEntries(recordMoves), [recordMoves])

    useEffect(() => {
        if (!game) return
        const gameChanged = prevGameIdRef.current !== game.gameID
        const prevLen = prevRecordLenRef.current
        const nextLen = recordMoves.length
        if (gameChanged) {
            setViewPly(nextLen)
        } else if (viewPly === prevLen) {
            setViewPly(nextLen)
        }
        prevGameIdRef.current = game.gameID
        prevRecordLenRef.current = nextLen
    }, [game?.gameID, recordMoves.length, viewPly])

    useEffect(() => {
        if (game) return
        setViewPly(localMoves.length)
    }, [game, localMoves.length])

    useEffect(() => {
        const limit = activeMoves.length
        const clamped = Math.max(0, Math.min(limit, viewPly))
        let next = getInitialBoard()
        for (let i = 0; i < clamped; i += 1) {
            const [from, to, promotion] = activeMoves[i]
            next = applyMove(next, from, to, activeMoves.slice(0, i), promotion)
        }
        setBoard(next)
    }, [game?.gameID, activeMoves, viewPly])

    useEffect(() => {
        const onKeyDown = (e) => {
            const target = e.target
            const tag = target?.tagName?.toLowerCase?.() || ""
            const isTyping = tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable
            if (isTyping) return
            const maxPly = activeMoves.length
            if (e.key === "ArrowLeft") {
                e.preventDefault()
                setViewPly((prev) => {
                    const next = Math.max(0, prev - 1)
                    if (next !== prev) playMoveSound()
                    return next
                })
            } else if (e.key === "ArrowRight") {
                e.preventDefault()
                setViewPly((prev) => {
                    const next = Math.min(maxPly, prev + 1)
                    if (next !== prev) playMoveSound()
                    return next
                })
            } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setViewPly((prev) => {
                    const next = 0
                    if (next !== prev) playMoveSound()
                    return next
                })
            } else if (e.key === "ArrowDown") {
                e.preventDefault()
                setViewPly((prev) => {
                    const next = maxPly
                    if (next !== prev) playMoveSound()
                    return next
                })
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [game?.gameID, activeMoves.length])

    const legalTargets = useMemo(() => {
        const source = dragFrom !== null ? dragFrom : selected
        if (source === null) return []
        const currentHistory = activeMoves.slice(0, viewPly)
        return getLegalMoves(board, source, currentHistory)
    }, [board, selected, dragFrom, activeMoves, viewPly])

    const boardPerspective = useMemo(() => {
        if (boardDirection === "white") return "white"
        if (boardDirection === "black") return "black"
        return game && me && Number(game.bp) === Number(me.userID) ? "black" : "white"
    }, [boardDirection, game, me])

    const orientedSquares = useMemo(() => {
        const arr = []
        if (boardPerspective === "white") {
            for (let i = 0; i < 64; i += 1) arr.push(i)
            return arr
        }
        for (let i = 63; i >= 0; i -= 1) arr.push(i)
        return arr
    }, [boardPerspective])

    const myTurn = game && me && Number(game.turn) === Number(me.userID)
    const sandboxMode = !game
    const sandboxTurn = viewPly % 2 === 0 ? "w" : "b"
    const currentTurnColor = sandboxMode ? sandboxTurn : isWhite ? "w" : "b"
    const iAmWhite = game && me && Number(game.wp) === Number(me.userID)
    const iAmBlack = game && me && Number(game.bp) === Number(me.userID)
    const incomingDraw = (iAmWhite && drawOffer === 2) || (iAmBlack && drawOffer === 1)
    const outgoingDraw = (iAmWhite && drawOffer === 1) || (iAmBlack && drawOffer === 2)
    const theme = BOARD_THEMES[boardTheme] || BOARD_THEMES.classic
    const myName = me?.displayName || me?.user
    const whiteLabel = game ? (Number(game.wp) === Number(me.userID) ? `${myName} (You)` : userMap[Number(game.wp)] || `Player ${game.wp}`) : "White"
    const blackLabel = game ? (Number(game.bp) === Number(me.userID) ? `${myName} (You)` : userMap[Number(game.bp)] || `Player ${game.bp}`) : "Black"
    const clocks = computeClocks(game, tickNow)
    const userById = useMemo(() => {
        const map = {}
        ;(users || []).forEach((u) => {
            map[Number(u.userID)] = u
        })
        return map
    }, [users])
    const whiteAvatar = game ? (Number(game.wp) === Number(me.userID) ? me.avatarUrl || "" : userById[Number(game.wp)]?.avatarUrl || "") : ""
    const blackAvatar = game ? (Number(game.bp) === Number(me.userID) ? me.avatarUrl || "" : userById[Number(game.bp)]?.avatarUrl || "") : ""
    const topPlayer =
        boardPerspective === "white"
            ? { color: "black", label: blackLabel, clock: clocks.black, avatarUrl: blackAvatar }
            : { color: "white", label: whiteLabel, clock: clocks.white, avatarUrl: whiteAvatar }
    const bottomPlayer =
        boardPerspective === "white"
            ? { color: "white", label: whiteLabel, clock: clocks.white, avatarUrl: whiteAvatar }
            : { color: "black", label: blackLabel, clock: clocks.black, avatarUrl: blackAvatar }

    const openResultModal = useCallback((resultRaw, snapshot = game) => {
        const { winner, method } = parseGameResult(resultRaw)
        const methodLabel =
            {
                0: "checkmate",
                1: "time",
                2: "stalemate",
                3: "resignation",
                4: "draw agreement",
            }[method] || "game result"

        if (method === 4) {
            setResultModal({
                tone: "draw",
                title: "Draw",
                detail: "Game ended by draw agreement.",
            })
            return
        }

        const whiteWins = winner === 1
        const winnerId = whiteWins ? Number(snapshot?.wp) : Number(snapshot?.bp)
        const winnerColor = whiteWins ? "White" : "Black"
        const winnerName = winnerId === Number(me?.userID) ? "You" : userMap[winnerId] || winnerColor
        const title = winnerId === Number(me?.userID) ? "You Won" : "You Lost"
        setResultModal({
            tone: winnerId === Number(me?.userID) ? "win" : "loss",
            title,
            detail: `${winnerName} won by ${methodLabel}.`,
        })
    }, [game, me?.userID, userMap])

    const socketRef = useGameRealtime({
        me: isComputerPage ? null : me,
        game: isComputerPage ? null : game,
        setGame,
        setStatus,
        setDrawOffer,
        setChatMessages,
        openResultModal,
        playMoveSound,
    })

    const emitSocketAck = useCallback((event, payload) => {
        return new Promise((resolve, reject) => {
            const socket = socketRef.current
            if (!socket) {
                reject(new Error("Realtime connection unavailable."))
                return
            }
            if (typeof socket.timeout === "function") {
                socket.timeout(6000).emit(event, payload, (err, response) => {
                    if (err) {
                        reject(new Error("Realtime request timed out. Please reconnect."))
                        return
                    }
                    if (response?.ok) resolve(response)
                    else reject(new Error(response?.error || "Request rejected"))
                })
                return
            }
            let settled = false
            const timeoutId = setTimeout(() => {
                if (settled) return
                settled = true
                reject(new Error("Realtime request timed out. Please reconnect."))
            }, 6000)
            socket.emit(event, payload, (response) => {
                if (settled) return
                settled = true
                clearTimeout(timeoutId)
                if (response?.ok) resolve(response)
                else reject(new Error(response?.error || "Request rejected"))
            })
        })
    }, [socketRef])

    useEffect(() => {
        if (!game?.gameID) return
        const panel = document.querySelector(".board-panel")
        if (!panel) return
        requestAnimationFrame(() => {
            panel.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "center",
            })
        })
    }, [game?.gameID])

    useEffect(() => {
        if (!game || game.result || timeoutSubmitting) return
        const currentTurn = Number(game.turn)
        const whiteToMove = currentTurn === Number(game.wp)
        const blackToMove = currentTurn === Number(game.bp)
        const timedOut = (whiteToMove && clocks.whiteMs <= 0) || (blackToMove && clocks.blackMs <= 0)
        if (!timedOut) return

        const marker = `${game.gameID}:${Number(game.move_number ?? -1)}:${currentTurn}`
        if (timeoutSentRef.current === marker) return
        timeoutSentRef.current = marker

        const winner = whiteToMove ? 0 : 1
        const result = `${winner},1`
        setTimeoutSubmitting(true)
        emitSocketAck("game:result:submit", {
            gameID: Number(game.gameID),
            result,
        })
            .then(() => {
                openResultModal(result, game)
                setGame(null)
            })
            .catch(() => {
                // Another client/server may have finalized already.
            })
            .finally(() => setTimeoutSubmitting(false))
    }, [game?.gameID, game?.turn, game?.move_number, game?.result, clocks.whiteMs, clocks.blackMs, timeoutSubmitting, emitSocketAck])

    const submitMove = async (from, to, promotionChoice) => {
        const mustChoosePromotion = needsPromotionChoice(board, from, to)
        if (mustChoosePromotion && !promotionChoice) {
            setPromotionPrompt({
                from,
                to,
                color: String(board[from]?.[0] || "w"),
            })
            return
        }
        const promotion = mustChoosePromotion ? String(promotionChoice || "q").toLowerCase() : undefined
        const currentHistory = activeMoves.slice(0, viewPly)
        if (sandboxMode) {
            setLocalMoves((prev) => {
                const base = viewPly < prev.length ? prev.slice(0, viewPly) : prev
                const next = [...base, [from, to, promotion]]
                setViewPly(next.length)
                return next
            })
            setBoard((prev) => applyMove(prev, from, to, currentHistory, promotion))
            setMoveNumber((prev) => prev + 1)
            playMoveSound()
            setPromotionPrompt(null)
            return
        }
        if (viewPly !== activeMoves.length) {
            setStatus("Return to latest position with Right Arrow before making moves.")
            return
        }
        if (!game || !me || pending || resigning || game.result) return
        setPending(true)
        const prevBoard = board
        const prevGame = game
        const prevMoveNum = moveNumber
        try {
            const now = Date.now()
            const elapsed = Math.max(1, now - Number(game.started_time || now))

            setBoard((prev) => applyMove(prev, from, to, currentHistory, promotion))
            setMoveNumber((prev) => prev + 1)
            setGame((prev) => {
                if (!prev) return prev
                const moveToken = promotion ? `${from},${to},${promotion}` : `${from},${to}`
                return {
                    ...prev,
                    turn: Number(prev.turn) === Number(prev.wp) ? prev.bp : prev.wp,
                    record: prev.record ? `${prev.record} ${moveToken}` : moveToken,
                    timer: prev.timer ? `${prev.timer} ${elapsed}` : `${elapsed}`,
                    started_time: now,
                    i1: from,
                    i2: to,
                }
            })
            playMoveSound()
            setPromotionPrompt(null)

            await emitSocketAck("game:move:submit", {
                gameID: Number(game.gameID),
                i1: Number(from),
                i2: Number(to),
                promotion,
            })
        } catch (error) {
            setBoard(prevBoard)
            setGame(prevGame)
            setMoveNumber(prevMoveNum)
            setStatus(error?.message || "Move rejected")
        } finally {
            setPending(false)
        }
    }

    const onSquareClick = (index) => {
        if (!me || (game && game.result)) return
        const piece = board[index]

        if (selected === null) {
            if (!piece) return
            const mine = piece[0] === currentTurnColor
            if (!mine || (!sandboxMode && !myTurn)) return
            setSelected(index)
            return
        }

        if (selected === index) {
            setSelected(null)
            return
        }

        if (piece && sameSide(board[selected], piece)) {
            setSelected(index)
            return
        }

        if (!legalTargets.includes(index)) {
            setSelected(null)
            return
        }

        submitMove(selected, index)
        setSelected(null)
    }

    const onDragStartSquare = (index) => {
        if (!me || (game && game.result) || pending || resigning) return
        const piece = board[index]
        if (!piece) return
        const mine = piece[0] === currentTurnColor
        if (!mine) return
        if (!sandboxMode && !myTurn) return
        setSelected(index)
        setDragFrom(index)
    }

    const onPieceMouseDown = (e, index) => {
        e.preventDefault()
        onDragStartSquare(index)
        const rect = e.currentTarget.getBoundingClientRect()
        setDragPieceSize(Math.max(24, Math.round(rect.width)))
        setDragPos({ x: e.clientX, y: e.clientY })
    }

    const onDropSquare = (index) => {
        if (dragFrom === null) return
        if (index === dragFrom) {
            setDragFrom(null)
            return
        }
        if (legalTargets.includes(index)) {
            submitMove(dragFrom, index)
        }
        setDragFrom(null)
        setSelected(null)
        setDragPos(null)
    }

    useEffect(() => {
        if (dragFrom === null) return undefined
        const onMove = (e) => {
            setDragPos({ x: e.clientX, y: e.clientY })
        }
        const onUp = (e) => {
            const target = document.elementFromPoint(e.clientX, e.clientY)
            const squareEl = target?.closest?.("[data-square-index]")
            if (squareEl) {
                const idx = Number(squareEl.getAttribute("data-square-index"))
                if (Number.isInteger(idx)) onDropSquare(idx)
                else {
                    setDragFrom(null)
                    setSelected(null)
                    setDragPos(null)
                }
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
    }, [dragFrom, legalTargets, viewPly, activeMoves.length, game, me, pending, resigning, sandboxMode, myTurn])

    const resign = async () => {
        if (!game || !me || game.result || resigning || pending) return
        setResigning(true)
        try {
            const winner = isWhite ? 0 : 1
            const result = `${winner},3`
            await emitSocketAck("game:result:submit", {
                gameID: Number(game.gameID),
                result,
            })
            openResultModal(result, game)
            setGame(null)
        } catch (error) {
            setGame((prev) => (prev ? { ...prev, result: null } : prev))
            setStatus("Cannot resign now.")
        } finally {
            setResigning(false)
        }
    }

    const requestOrAcceptDraw = async () => {
        if (!game || !me || game.result || drawing || pending) return
        setDrawing(true)
        try {
            const isWhiteSide = Number(game.wp) === Number(me.userID)
            const offeringDraw = isWhiteSide ? 1 : 2
            await emitSocketAck("game:draw:submit", {
                gameID: Number(game.gameID),
                offeringDraw,
            })
            setStatus(incomingDraw ? "Draw accepted." : "Draw offered.")
            if (incomingDraw) {
                openResultModal("0,4", game)
                setGame(null)
            }
        } catch (error) {
            setStatus(error?.message || "Cannot update draw offer.")
        } finally {
            setDrawing(false)
        }
    }

    const openConfirm = (kind) => {
        if (!game || !me || pending || resigning || drawing || game.result) return
        setConfirmAction(kind)
    }

    const handleConfirmAction = async () => {
        if (confirmAction === "resign") {
            await resign()
        } else if (confirmAction === "draw") {
            await requestOrAcceptDraw()
        }
        setConfirmAction(null)
    }

    const submitChat = async (e) => {
        e.preventDefault()
        if (!game || !chatInput.trim() || chatLoading) return
        setChatLoading(true)
        try {
            const text = chatInput.trim()
            await emitSocketAck("message:send", {
                gameID: Number(game.gameID),
                message: text,
            })
            setChatInput("")
        } catch (error) {
            setStatus("Failed to send chat message.")
        } finally {
            setChatLoading(false)
        }
    }

    const jumpToPly = (ply) => {
        const clamped = Math.max(0, Math.min(activeMoves.length, Number(ply) || 0))
        setViewPly((prev) => {
            if (prev !== clamped) playMoveSound()
            return clamped
        })
    }

    const openProfile = async () => {
        setProfileError("")
        setProfileOpen(true)
        try {
            const latest = await usersApi.getMyProfile()
            if (latest?.userID) {
                setMe((prev) => ({ ...(prev || {}), ...latest }))
            }
        } catch (error) {
            // modal still opens with local state
        }
    }

    const saveProfile = async (payload) => {
        setProfileError("")
        setProfileSaving(true)
        try {
            const updated = await usersApi.updateMyProfile(payload)
            setMe((prev) => ({ ...(prev || {}), ...updated }))
            await refreshUsers()
            setProfileOpen(false)
        } catch (error) {
            setProfileError(error?.response?.data?.error || error?.response?.data?.message || "Failed to update profile.")
        } finally {
            setProfileSaving(false)
        }
    }

    const uploadAvatar = async (imageData) => {
        setProfileError("")
        setAvatarUploading(true)
        try {
            const updated = await usersApi.uploadMyAvatar(imageData)
            setMe((prev) => ({ ...(prev || {}), ...updated }))
            await refreshUsers()
        } catch (error) {
            setProfileError(error?.response?.data?.error || error?.response?.data?.message || "Failed to upload avatar.")
        } finally {
            setAvatarUploading(false)
        }
    }

    const handleLogout = () => {
        logout()
        setGame(null)
        setStatus("")
        setLogoutConfirmOpen(false)
    }

    if (bootstrappingAuth)
        return (
            <div className="auth-shell">
                <div className="auth-card">Restoring session...</div>
            </div>
        )
    if (!me) return <AuthCard onSuccess={setMe} />

    return (
        <div className="page">
            <TopBar
                me={me}
                currentView={isComputerPage ? "computer" : "online"}
                onNavigateHome={() => navigate("/")}
                onNavigateComputer={() => navigate("/play/computer")}
                onOpenProfile={openProfile}
                onRequestLogout={() => setLogoutConfirmOpen(true)}
            />

            {isComputerPage ? (
                <ComputerPlayPage
                    theme={theme}
                    boardScale={boardScale}
                    boardDirection={boardDirection}
                    boardSettingsOpen={boardSettingsOpen}
                    resizeState={resizeState}
                    startResize={startResize}
                    setBoardSettingsOpen={setBoardSettingsOpen}
                />
            ) : (
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
                        onToggleSettings={() => setBoardSettingsOpen((v) => !v)}
                        onStartResize={startResize}
                        promotionPrompt={promotionPrompt}
                        onPromotionPick={(piece) => submitMove(promotionPrompt.from, promotionPrompt.to, piece)}
                        onPromotionCancel={() => setPromotionPrompt(null)}
                    />

                    <aside className={`side-panel ${game ? "side-panel--game" : "side-panel--invite"}`}>
                        {game ? (
                            <GameSidebar
                                game={game}
                                notationEntries={notationEntries}
                                moveNumber={moveNumber}
                                maxPly={activeMoves.length}
                                viewPly={viewPly}
                                drawing={drawing}
                                resigning={resigning}
                                outgoingDraw={outgoingDraw}
                                incomingDraw={incomingDraw}
                                onOpenConfirm={openConfirm}
                                onJumpToPly={jumpToPly}
                                chatMessages={chatMessages}
                                me={me}
                                userMap={userMap}
                                chatInput={chatInput}
                                onChatInputChange={setChatInput}
                                onSubmitChat={submitChat}
                                chatLoading={chatLoading}
                            />
                        ) : (
                            <InviteHub me={me} users={users} onGameCreated={setGame} socketRef={socketRef} />
                        )}
                    </aside>
                </main>
            )}
            <BoardSettingsModal
                open={boardSettingsOpen}
                boardScale={boardScale}
                boardDirection={boardDirection}
                boardTheme={boardTheme}
                themes={BOARD_THEMES}
                onClose={() => setBoardSettingsOpen(false)}
                onBoardScaleChange={setBoardScale}
                onBoardDirectionChange={setBoardDirection}
                onBoardThemeChange={setBoardTheme}
            />
            {!isComputerPage ? (
                <ActionConfirmModal
                    action={confirmAction}
                    incomingDraw={incomingDraw}
                    onClose={() => setConfirmAction(null)}
                    onConfirm={handleConfirmAction}
                />
            ) : null}
            {!isComputerPage ? <ResultModal result={resultModal} onClose={() => setResultModal(null)} /> : null}
            <ProfileModal
                open={profileOpen}
                me={me}
                saving={profileSaving}
                uploadingAvatar={avatarUploading}
                error={profileError}
                onClose={() => setProfileOpen(false)}
                onSave={saveProfile}
                onUploadAvatar={uploadAvatar}
            />
            {logoutConfirmOpen ? (
                <div className="board-settings-modal-backdrop" onClick={() => setLogoutConfirmOpen(false)}>
                    <div className="action-confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Log Out</h3>
                        <p className="muted">Do you really want to log out?</p>
                        <div className="confirm-actions">
                            <button className="btn btn-quiet" onClick={() => setLogoutConfirmOpen(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-action-resign" onClick={handleLogout}>
                                Log out
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}

export default App

