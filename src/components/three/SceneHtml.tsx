"use client";

/**
 * drei's <Html> for the classroom scene. drei appends an Html element to the canvas's event source, which on the
 * classroom pages sits UNDER the canvas (ClassroomStage), so the overlays (picture toolbar, model labels, the desk
 * quiz) would be hidden behind the opaque room. ClassroomStage registers a layer above the canvas here and every
 * scene Html goes into it. Without a layer (dev pages that use the bare AristoCanvas) it is drei's own <Html>.
 */
import { useMemo, type ComponentProps } from "react";
import { Html } from "@react-three/drei";
import { create } from "zustand";

interface HtmlLayer {
  el:    HTMLElement | null;
  setEl: (el: HTMLElement | null) => void;
}

export const useHtmlLayer = create<HtmlLayer>((set) => ({ el: null, setEl: (el) => set({ el }) }));

export function SceneHtml(props: ComponentProps<typeof Html>) {
  const el = useHtmlLayer((s) => s.el);
  const portal = useMemo(() => (el ? { current: el } : undefined), [el]);
  const { children, ...rest } = props;
  // The layer is pointer-events: none (the room and the widget under it must stay reachable); the content opts in.
  // `display: contents` keeps every layout and the Html's own centring exactly as before.
  return (
    <Html {...rest} portal={portal}>
      <div style={{ display: "contents", pointerEvents: "auto" }}>{children}</div>
    </Html>
  );
}
