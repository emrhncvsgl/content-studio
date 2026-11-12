import { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";

// Motion blur alt örnekleri kesirli/kaydırılmış kare görür. Stop-motion (stepFps) basamakları bu "taban" kareden hesaplanır ki
// basamak sınırında iki poz üst üste binmesin (çift görüntü); kamera ise alt örnek karesiyle akar → blur yalnızca kamerada (EP 2026-11-01 testi).
export const BaseFrameCtx = createContext<number | null>(null);
export const useBaseFrame = () => useContext(BaseFrameCtx);
export const BaseFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BaseFrameCtx.Provider value={useCurrentFrame()}>{children}</BaseFrameCtx.Provider>
);
