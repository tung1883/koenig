import { useEffect, useState } from "react";

function useTicker(intervalMs = 250) {
  const [tickNow, setTickNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setTickNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return tickNow;
}

export default useTicker;
