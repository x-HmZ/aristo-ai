"use client";

/**
 * How the classroom page is laid out for the screen it is on, and how much of the canvas the lesson panel covers.
 * Not persisted. Written by ClassroomStage (the mode) and ClassroomPanel (the insets); read by the camera
 * (LensShift frames the room in what the panel leaves free) and by the panel itself.
 *
 *   desk       a laptop or tablet: the panel is a 400px column on the right.
 *   portrait   a phone held upright (narrower than 640px): the room is a band at the top, the lesson a bottom sheet.
 *   landscape  a phone on its side (shorter than 500px): the room fills the screen, the lesson a drawer on the right.
 */

import { create } from "zustand";

export type LayoutMode = "desk" | "portrait" | "landscape";
export type SheetSnap = "peek" | "half" | "full";

export function layoutModeOf(width: number, height: number): LayoutMode {
  if (width < 640 && height >= width) return "portrait";
  if (height < 500 && width > height) return "landscape";
  return "desk";
}

/** The top bar's pills (52px at 12px): the room's free area starts under them on a phone. */
export const PHONE_TOP_INSET = 64;

interface ClassroomLayout {
  mode:        LayoutMode;
  viewport:    { w: number; h: number };
  /** Canvas px covered by the panel on the right and at the bottom. */
  panelRight:  number;
  panelBottom: number;
  /** Portrait: the sheet's snap. Landscape: whether the drawer is open. */
  snap:        SheetSnap;
  drawerOpen:  boolean;
  set: (p: Partial<Omit<ClassroomLayout, "set">>) => void;
}

export const useClassroomLayout = create<ClassroomLayout>((set) => ({
  mode: "desk",
  viewport: { w: 1440, h: 900 },
  panelRight: 0,
  panelBottom: 0,
  snap: "half",
  drawerOpen: true,
  set: (p) => set(p),
}));
