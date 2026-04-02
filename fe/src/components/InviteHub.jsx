import { useEffect, useState } from "react";
import { inviteApi } from "../api";

function NumberField({ label, value, min = 0, max = null, onChange }) {
  const clamp = (next) => {
    let n = Number(next);
    if (Number.isNaN(n)) n = min;
    if (typeof min === "number") n = Math.max(min, n);
    if (typeof max === "number") n = Math.min(max, n);
    return n;
  };

  const stepBy = (delta) => onChange(clamp(Number(value || 0) + delta));

  return (
    <label className="number-field">
      {label}
      <div className="number-field-wrap">
        <input
          type="number"
          className="number-input-modern"
          min={min}
          max={typeof max === "number" ? max : undefined}
          value={value}
          onChange={(e) => onChange(clamp(e.target.value))}
        />
        <div className="number-stepper">
          <button type="button" className="number-step-btn" onClick={() => stepBy(1)} aria-label={`Increase ${label}`}>
            ▲
          </button>
          <button type="button" className="number-step-btn" onClick={() => stepBy(-1)} aria-label={`Decrease ${label}`}>
            ▼
          </button>
        </div>
      </div>
    </label>
  );
}

function InviteHub({ me, users, onGameCreated, socketRef }) {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState(null);
  const [opp, setOpp] = useState("");
  const [baseHours, setBaseHours] = useState(0);
  const [baseMinutes, setBaseMinutes] = useState(10);
  const [baseSeconds, setBaseSeconds] = useState(0);
  const [inc, setInc] = useState(5);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingReq, setPendingReq] = useState(null);
  const [timeMode, setTimeMode] = useState("blitz");

  const presetGroups = {
    bullet: [
      { label: "1 | 0", base: 60, inc: 0 },
      { label: "1 | 1", base: 60, inc: 1 },
      { label: "2 | 1", base: 120, inc: 1 }
    ],
    blitz: [
      { label: "3 | 0", base: 180, inc: 0 },
      { label: "3 | 2", base: 180, inc: 2 },
      { label: "5 | 0", base: 300, inc: 0 },
      { label: "5 | 3", base: 300, inc: 3 }
    ],
    rapid: [
      { label: "10 | 0", base: 600, inc: 0 },
      { label: "10 | 5", base: 600, inc: 5 },
      { label: "15 | 10", base: 900, inc: 10 }
    ],
    classical: [
      { label: "30 | 0", base: 1800, inc: 0 },
      { label: "30 | 20", base: 1800, inc: 20 },
      { label: "60 | 30", base: 3600, inc: 30 }
    ]
  };
  const modeOptions = [
    { id: "bullet", label: "Bullet" },
    { id: "blitz", label: "Blitz" },
    { id: "rapid", label: "Rapid" },
    { id: "classical", label: "Classical" }
  ];
  const activePresets = presetGroups[timeMode] || [];
  const baseTotalSeconds = Math.max(0, Number(baseHours || 0) * 3600 + Number(baseMinutes || 0) * 60 + Number(baseSeconds || 0));
  const available = users.filter((u) => Number(u.userID) !== Number(me.userID));
  const meDisplayName = me.displayName || me.user;
  const outgoingIsLive = outgoing && !outgoing.gameID;

  const applyBaseSeconds = (totalSeconds) => {
    const safe = Math.max(0, Number(totalSeconds || 0));
    const h = Math.floor(safe / 3600);
    const rem = safe % 3600;
    const m = Math.floor(rem / 60);
    const s = rem % 60;
    setBaseHours(h);
    setBaseMinutes(m);
    setBaseSeconds(s);
  };

  const refresh = async () => {
    try {
      const [inData, outData] = await Promise.all([
        inviteApi.getIncomingInvites(),
        inviteApi.getOutgoingInvite()
      ]);
      setIncoming(Array.isArray(inData?.requestList) ? inData.requestList : []);
      setOutgoing(outData?.request || null);
    } catch (_) {
      // ignore
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket || !me) return undefined;

    const onInviteNew = (payload) => {
      if (Number(payload?.receiver) !== Number(me.userID)) return;
      setIncoming((prev) => {
        if (prev.some((item) => Number(item.reqID) === Number(payload.reqID))) return prev;
        return [...prev, payload];
      });
    };

    const onInviteAccepted = (payload) => {
      const myId = Number(me.userID);
      if (Number(payload?.wp) !== myId && Number(payload?.bp) !== myId) return;
      onGameCreated({
        gameID: Number(payload.gameID),
        wp: Number(payload.wp),
        bp: Number(payload.bp),
        turn: Number(payload.wp),
        timer: payload.timer,
        started_time: Number(payload.startedTime),
        record: null,
        move_number: null
      });
      setIncoming((prev) => prev.filter((item) => Number(item.reqID) !== Number(payload.reqID)));
      setOutgoing((prev) => (Number(prev?.reqID) === Number(payload.reqID) ? null : prev));
      setMsg("Invite accepted. Game started.");
    };

    const onInviteDeclined = (payload) => {
      const myId = Number(me.userID);
      if (Number(payload?.wp) !== myId && Number(payload?.bp) !== myId) return;
      setIncoming((prev) => prev.filter((item) => Number(item.reqID) !== Number(payload.reqID)));
      if (Number(outgoingIsLive?.reqID) === Number(payload?.reqID)) {
        setOutgoing(null);
        setMsg("Invite declined.");
      }
    };

    const onInviteExpired = (payload) => {
      const myId = Number(me.userID);
      if (Number(payload?.wp) !== myId && Number(payload?.bp) !== myId) return;
      setIncoming((prev) => prev.filter((item) => Number(item.reqID) !== Number(payload.reqID)));
      if (Number(outgoingIsLive?.reqID) === Number(payload?.reqID)) {
        setOutgoing(null);
        setMsg("Invite expired.");
      }
    };

    socket.on("invite:new", onInviteNew);
    socket.on("invite:accepted", onInviteAccepted);
    socket.on("invite:declined", onInviteDeclined);
    socket.on("invite:expired", onInviteExpired);
    return () => {
      socket.off("invite:new", onInviteNew);
      socket.off("invite:accepted", onInviteAccepted);
      socket.off("invite:declined", onInviteDeclined);
      socket.off("invite:expired", onInviteExpired);
    };
  }, [me?.userID, onGameCreated, socketRef, outgoingIsLive?.reqID]);

  const sendInvite = async () => {
    if (!opp) {
      setErr("Choose an opponent first.");
      return;
    }
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const target = available.find((u) => Number(u.userID) === Number(opp));
      if (!target) throw new Error("Selected opponent not found.");

      const payload = {
        wp: Number(me.userID),
        wu: meDisplayName,
        bp: Number(target.userID),
        bu: target.displayName || target.user,
        timer: `${baseTotalSeconds}+${inc}`
      };
      const res = await inviteApi.createInvite(payload);
      setOutgoing({ ...payload, reqID: Number(res.reqID) });
      setMsg("Invite sent.");
    } catch (error) {
      setErr(error?.response?.data?.error || error?.response?.data?.message || error.message || "Cannot send invite");
    } finally {
      setLoading(false);
    }
  };

  const answerInvite = async (reqItem, accept) => {
    setPendingReq(reqItem.reqID);
    setErr("");
    setMsg("");
    try {
      if (!accept) {
        await inviteApi.respondInvite(reqItem.reqID, 0);
        setMsg("Invite declined.");
        setIncoming((prev) => prev.filter((item) => Number(item.reqID) !== Number(reqItem.reqID)));
        return;
      }

      const game = await inviteApi.acceptInvite(reqItem.reqID);
      onGameCreated({
        gameID: Number(game.gameID),
        wp: Number(game.wp ?? reqItem.wp),
        bp: Number(game.bp ?? reqItem.bp),
        turn: Number(game.wp ?? reqItem.wp),
        timer: game.timer || reqItem.timer,
        started_time: Number(game.started_time || Date.now()),
        record: null,
        move_number: null
      });
      setMsg("Invite accepted. Game started.");
    } catch (error) {
      setErr(error?.response?.data?.error || error?.response?.data?.message || "Cannot process invite");
    } finally {
      setPendingReq(null);
    }
  };

  return (
    <>
      <div className="new-game">
        <div className="panel-head">
          <h2>Invite Player</h2>
        </div>
        <div className="field">
          <span className="field-label">Opponent:</span>
          <select value={opp} onChange={(e) => setOpp(e.target.value)}>
            <option value="">{available.length ? "Select player" : "No players found"}</option>
            {available.map((u) => (
              <option key={u.userID} value={u.userID}>{u.displayName || u.user}</option>
            ))}
          </select>
        </div>
        <div className="time-mode-row">
          {modeOptions.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`btn btn-mode ${timeMode === m.id ? "is-active" : ""}`}
              onClick={() => setTimeMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className={`preset-row presets-${activePresets.length}`}>
          {activePresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`btn btn-time ${baseTotalSeconds === preset.base && inc === preset.inc ? "is-active" : ""}`}
              onClick={() => {
                applyBaseSeconds(preset.base);
                setInc(preset.inc);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="timer-grid timer-grid-challenge">
          <NumberField label="Hours" min={0} max={23} value={baseHours} onChange={setBaseHours} />
          <NumberField label="Minutes" min={0} max={59} value={baseMinutes} onChange={setBaseMinutes} />
          <NumberField label="Seconds" min={0} max={59} value={baseSeconds} onChange={setBaseSeconds} />
          <NumberField label="Increment" min={0} value={inc} onChange={setInc} />
        </div>
        {msg ? <div className="success-box">{msg}</div> : null}
        {err ? <div className="error-box">{String(err)}</div> : null}
        <button className="btn btn-primary" onClick={sendInvite} disabled={loading || !available.length}>
          {loading ? "Sending..." : "Send Invite"}
        </button>
      </div>

      {outgoingIsLive ? (
        <div className="card">
          <h3>Outgoing Invite</h3>
          <p className="muted">Waiting for response</p>
          <div className="kv"><span>Req ID</span><strong>{outgoingIsLive.reqID}</strong></div>
          <div className="kv"><span>Timer</span><strong>{outgoingIsLive.timer}</strong></div>
        </div>
      ) : null}

      <div className="card">
        <h3>Incoming Invites</h3>
        <div className="invite-list">
          {incoming.length === 0 ? <div className="muted">No incoming invites.</div> : null}
          {incoming.map((reqItem) => {
            const isMineWhite = Number(reqItem.wp) === Number(me.userID);
            const oppName = isMineWhite ? reqItem.bu : reqItem.wu;
            return (
              <div key={reqItem.reqID} className="invite-item">
                <div className="invite-main">
                  <strong>{oppName}</strong>
                  <span>{reqItem.timer}</span>
                </div>
                <div className="invite-actions">
                  <button className="btn btn-primary" onClick={() => answerInvite(reqItem, true)} disabled={pendingReq === reqItem.reqID}>Accept</button>
                  <button className="btn btn-danger" onClick={() => answerInvite(reqItem, false)} disabled={pendingReq === reqItem.reqID}>Decline</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default InviteHub;
