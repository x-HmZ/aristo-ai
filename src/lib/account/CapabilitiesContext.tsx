"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ALL_CAPABILITIES, type Capabilities } from "./capabilities";

/**
 * What the learn UI reads to decide whether the microphone, free chat and the custom teacher are available.
 * /learn always provides the real value (computed on the server from the profile). The default, used by pages
 * that never mount a provider (the /demo and /dev pages, with no signed-in learner), allows everything.
 */
const CapabilitiesContext = createContext<Capabilities>(ALL_CAPABILITIES);

export function CapabilitiesProvider({ value, children }: { value: Capabilities; children: ReactNode }) {
  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>;
}

export function useCapabilities(): Capabilities {
  return useContext(CapabilitiesContext);
}
