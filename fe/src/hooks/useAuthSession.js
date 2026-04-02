import { useCallback, useEffect, useState } from "react";

const AUTH_STORAGE_KEY = "chess_web_auth_user";

function useAuthSession() {
  const [me, setMe] = useState(null);
  const [bootstrappingAuth, setBootstrappingAuth] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!saved) {
      setBootstrappingAuth(false);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.user && parsed?.userID) {
        setMe(parsed);
      }
    } catch (error) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setBootstrappingAuth(false);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(me));
  }, [me]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setMe(null);
  }, [clearSession]);

  return {
    me,
    setMe,
    bootstrappingAuth,
    logout,
    clearSession
  };
}

export default useAuthSession;
