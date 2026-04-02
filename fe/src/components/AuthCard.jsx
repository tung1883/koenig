import { useState } from "react";
import { authApi } from "../api";

function AuthCard({ onSuccess }) {
  const [mode, setMode] = useState("signin");
  const [user, setUser] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [tokenRequested, setTokenRequested] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if ((mode === "signup" || (mode === "forgot" && tokenRequested)) && pwd !== pwd2) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const data = await authApi.signIn(user.trim(), pwd);
        onSuccess({
          user: data.user,
          userID: Number(data.userID),
          displayName: data.displayName || "",
          avatarUrl: data.avatarUrl || "",
          bio: data.bio || ""
        });
      } else if (mode === "signup") {
        await authApi.signUp(user.trim(), pwd);
        setMsg("Registration successful. You can sign in now.");
        setMode("signin");
        setPwd("");
        setPwd2("");
      } else if (!tokenRequested) {
        const res = await authApi.requestResetToken(user.trim());
        setTokenRequested(true);
        setMsg(res?.token ? `Reset token: ${res.token}` : "Reset token generated. Check backend logs.");
      } else {
        await authApi.resetPassword(user.trim(), pwd, resetToken.trim());
        setMsg("Password updated. Please sign in.");
        setMode("signin");
        setPwd("");
        setPwd2("");
        setResetToken("");
        setTokenRequested(false);
      }
    } catch (error) {
      setErr(error?.response?.data || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <img src="/assets/logo.png" alt="Logo" className="logo" />
        <h1>{mode === "signin" ? "Play Chess" : mode === "signup" ? "Create Account" : "Reset Password"}</h1>
        <p>Minimal frontend for your backend game API.</p>
        <div className="auth-mode">
          <button
            type="button"
            className={`btn btn-quiet ${mode === "signin" ? "is-active" : ""}`}
            onClick={() => { setMode("signin"); setTokenRequested(false); setResetToken(""); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`btn btn-quiet ${mode === "signup" ? "is-active" : ""}`}
            onClick={() => { setMode("signup"); setTokenRequested(false); setResetToken(""); }}
          >
            Register
          </button>
          <button
            type="button"
            className={`btn btn-quiet ${mode === "forgot" ? "is-active" : ""}`}
            onClick={() => { setMode("forgot"); setTokenRequested(false); setResetToken(""); }}
          >
            Forgot Password
          </button>
        </div>
        <label>
          Username
          <input value={user} onChange={(e) => setUser(e.target.value)} required />
        </label>
        {mode !== "forgot" || tokenRequested ? (
          <label>
            Password
            <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
          </label>
        ) : null}
        {mode !== "signin" && mode !== "forgot" ? (
          <label>
            Confirm Password
            <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required />
          </label>
        ) : null}
        {mode === "forgot" && tokenRequested ? (
          <>
            <label>
              Confirm Password
              <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required />
            </label>
            <label>
              Reset Token
              <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
            </label>
          </>
        ) : null}
        {msg ? <div className="success-box">{msg}</div> : null}
        {err ? <div className="error-box">{String(err)}</div> : null}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Please wait..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : tokenRequested ? "Reset password" : "Request token"}
        </button>
      </form>
    </div>
  );
}

export default AuthCard;
