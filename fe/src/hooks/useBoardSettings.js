import { useEffect, useState } from "react";

function useBoardSettings() {
  const [boardScale, setBoardScale] = useState(70);
  const [boardTheme, setBoardTheme] = useState("classic");
  const [boardDirection, setBoardDirection] = useState("auto");
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [resizeState, setResizeState] = useState(null);

  useEffect(() => {
    if (!resizeState) return undefined;
    const onMove = (e) => {
      const delta = e.clientX - resizeState.startX;
      const next = resizeState.startScale + delta * 0.08;
      setBoardScale(Math.max(55, Math.min(95, next)));
    };
    const onUp = () => setResizeState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizeState]);

  const startResize = (e) => {
    e.preventDefault();
    setResizeState({
      startX: e.clientX,
      startScale: boardScale
    });
  };

  return {
    boardScale,
    setBoardScale,
    boardTheme,
    setBoardTheme,
    boardDirection,
    setBoardDirection,
    boardSettingsOpen,
    setBoardSettingsOpen,
    resizeState,
    startResize
  };
}

export default useBoardSettings;
