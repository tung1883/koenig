import { useCallback, useEffect, useRef, useState } from "react"

const ENGINE_PATH = `${import.meta.env.BASE_URL}stockfish/stockfish-18-lite-single.js`
const WASM_PATH = `${import.meta.env.BASE_URL}stockfish/stockfish-18-lite-single.wasm`
const SCRIPT_SELECTOR = 'script[data-stockfish-engine="lite-single"]'

let engineFactoryPromise = null

function loadEngineFactory() {
    if (engineFactoryPromise) return engineFactoryPromise

    engineFactoryPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(SCRIPT_SELECTOR)
        const script = existing || document.createElement("script")

        const finish = () => {
            if (typeof script._exports === "function") {
                resolve(script._exports)
                return
            }
            reject(new Error("Stockfish engine factory was not found after script load."))
        }

        const fail = () => {
            reject(new Error("Failed to load the Stockfish browser bundle."))
        }

        if (!existing) {
            script.async = true
            script.src = ENGINE_PATH
            script.dataset.stockfishEngine = "lite-single"
            script.addEventListener("load", finish, { once: true })
            script.addEventListener("error", fail, { once: true })
            document.body.appendChild(script)
            return
        }

        if (typeof script._exports === "function") {
            finish()
            return
        }

        script.addEventListener("load", finish, { once: true })
        script.addEventListener("error", fail, { once: true })
    })

    return engineFactoryPromise
}

function parseScore(line) {
    const match = String(line || "").match(/score (cp|mate) (-?\d+)/)
    if (!match) return ""
    const [, type, raw] = match
    if (type === "mate") return `Mate ${raw}`
    const cp = Number(raw)
    if (!Number.isFinite(cp)) return ""
    return `${(cp / 100).toFixed(2)}`
}

function useStockfishEngine({ skillLevel = 6 } = {}) {
    const engineRef = useRef(null)
    const pendingRef = useRef(null)
    const skillRef = useRef(skillLevel)
    const [ready, setReady] = useState(false)
    const [info, setInfo] = useState("")
    const [error, setError] = useState("")

    const send = useCallback((command) => {
        const engine = engineRef.current
        if (!engine) return
        setTimeout(() => {
            engine.ccall("command", null, ["string"], [command], { async: /^go\b/.test(command) })
        }, 0)
    }, [])

    const stopSearch = useCallback(() => {
        if (!engineRef.current) return
        send("stop")
        if (pendingRef.current) {
            pendingRef.current.reject(new Error("Search cancelled."))
            pendingRef.current = null
        }
    }, [send])

    useEffect(() => {
        skillRef.current = skillLevel
        if (!ready) return
        send(`setoption name Skill Level value ${Math.max(0, Math.min(20, Number(skillLevel) || 0))}`)
        send("setoption name Hash value 16")
        send("ucinewgame")
        send("isready")
    }, [ready, send, skillLevel])

    useEffect(() => {
        let cancelled = false
        setError("")
        setReady(false)

        loadEngineFactory()
            .then((initEngine) =>
                initEngine({
                    locateFile(path) {
                        if (path.includes(".wasm")) return WASM_PATH
                        return ENGINE_PATH
                    },
                    listener(line) {
                        const text = String(line || "").trim()
                        if (!text || cancelled) return

                        if (text === "uciok") {
                            send(`setoption name Skill Level value ${Math.max(0, Math.min(20, Number(skillRef.current) || 0))}`)
                            send("setoption name Hash value 16")
                            send("isready")
                            return
                        }

                        if (text === "readyok") {
                            setReady(true)
                            return
                        }

                        if (text.startsWith("info ")) {
                            const score = parseScore(text)
                            if (score) setInfo(score)
                            return
                        }

                        if (text.startsWith("bestmove ")) {
                            const bestmove = text.split(/\s+/)[1] || ""
                            if (pendingRef.current) {
                                pendingRef.current.resolve(bestmove)
                                pendingRef.current = null
                            }
                        }
                    },
                })
            )
            .then((engine) => {
                if (cancelled) {
                    try {
                        engine.terminate?.()
                    } catch {}
                    return
                }
                engineRef.current = engine
                send("uci")
            })
            .catch((loadError) => {
                if (cancelled) return
                setError(loadError?.message || "Failed to initialize Stockfish.")
            })

        return () => {
            cancelled = true
            if (pendingRef.current) {
                pendingRef.current.reject(new Error("Stockfish engine stopped."))
                pendingRef.current = null
            }
            try {
                engineRef.current?.terminate?.()
            } catch {}
            engineRef.current = null
            setReady(false)
        }
    }, [send])

    const requestBestMove = useCallback(
        ({ fen, moveTime = 250 }) =>
            new Promise((resolve, reject) => {
                if (!engineRef.current || !ready) {
                    reject(new Error("Stockfish is still loading."))
                    return
                }

                if (pendingRef.current) {
                    pendingRef.current.reject(new Error("Superseded by a new search."))
                    pendingRef.current = null
                }

                setInfo("")
                pendingRef.current = { resolve, reject }
                send(`position fen ${fen}`)
                send(`go movetime ${Math.max(30, Number(moveTime) || 250)}`)
            }),
        [ready, send]
    )

    return {
        ready,
        info,
        error,
        requestBestMove,
        stopSearch,
    }
}

export default useStockfishEngine
