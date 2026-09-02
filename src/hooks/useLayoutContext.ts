import { useOutletContext } from "react-router-dom";

export interface AppLayoutContext {
  onOpenMenu: () => void;
}

export function useLayoutContext(): AppLayoutContext {
  return useOutletContext<AppLayoutContext>();
}
