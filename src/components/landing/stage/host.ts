import { shared } from "./shared";
import { WAVE_COOLDOWN_S } from "./scripts";
import { pickSpot, type SpotId } from "./spots";

/**
 * Which spot the one landing canvas serves (V8.3b). Spots register their boxes; an IntersectionObserver keeps how
 * much of each is in view, and `pickSpot` chooses where the canvas goes. A plain object with listeners, not React
 * state: LandingRoot moves the canvas layer and the stage switches the teacher, each on a change only.
 *
 * - `active`: the spot the canvas is placed on. It stays there when every spot has left the screen, so coming back
 *   to the same one resumes without a remount.
 * - `onScreen`: some of the active spot is in view (the stage renders only then).
 * - `live`: the spot whose teacher has drawn its first frame there. Until then the spot shows its still.
 */
export const host: {
  active: SpotId | null;
  onScreen: boolean;
  live: SpotId | null;
} = { active: null, onScreen: false, live: null };

const boxes = new Map<SpotId, HTMLElement>();
const ratios: Partial<Record<SpotId, number>> = {};
const listeners = new Set<() => void>();
let observer: IntersectionObserver | null = null;

const emit = () => listeners.forEach((l) => l());

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function spotBox(id: SpotId): HTMLElement | null {
  return boxes.get(id) ?? null;
}

function update() {
  const next = pickSpot(ratios, host.active);
  const onScreen = !!next && (ratios[next] ?? 0) > 0;
  const active = next ?? host.active;
  if (active === host.active && onScreen === host.onScreen) return;
  if (active !== host.active) setLive(null);
  host.active = active;
  host.onScreen = onScreen;
  emit();
}

function ensureObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.spot as SpotId;
        ratios[id] = e.isIntersecting ? e.intersectionRatio : 0;
      }
      update();
    },
    { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
  );
  return observer;
}

export function registerSpot(id: SpotId, el: HTMLElement): () => void {
  boxes.set(id, el);
  ensureObserver().observe(el);
  return () => {
    observer?.unobserve(el);
    if (boxes.get(id) === el) boxes.delete(id);
    delete ratios[id];
    update();
  };
}

/** The stage has drawn the teacher at `id` (or null: nothing live). Each spot hides its still while it is live. */
export function setLive(id: SpotId | null): void {
  if (host.live === id) return;
  if (host.live) boxes.get(host.live)?.removeAttribute("data-live");
  host.live = id;
  if (id) boxes.get(id)?.setAttribute("data-live", "");
  emit();
}

/** A fresh wave at the hero (a tap on Jake, the reader coming back): the stage remounts him there. */
export function greetHero(): void {
  shared.hero.greet += 1;
  emit();
}

/**
 * One Lesson, Five Moves starts again (Replay): the teacher there remounts from rest, so the first move's gesture is
 * never blocked by the last one still playing.
 */
export function replayMoves(): void {
  shared.moves.run += 1;
  emit();
}

/** The reader is near Step Into the Classroom: the stage loads the room from now on (once). */
export function nearRoom(): void {
  if (shared.room.near) return;
  shared.room.near = true;
  emit();
}

/** The room is loaded and warm (RoomScene sets shared.room.ready first): the teacher there may go live. */
export function roomReady(): void {
  emit();
}

/**
 * The close has come into view again (Close.tsx; `leftAt`, when its box last left the view, in performance.now
 * seconds): the teacher there remounts and a fresh mount waves goodbye (plan note 6: every time it comes into view, 8 s
 * cool-down). Not when he mounted there since it left (the canvas just arrived from another spot: he is already
 * fresh), nor within the cool-down.
 */
export function enterClose(leftAt: number): void {
  if (shared.close.mountedAt > leftAt) return;
  const last = shared.waves.close;
  if (last !== undefined && performance.now() / 1000 - last <= WAVE_COOLDOWN_S) return;
  shared.close.enter += 1;
  emit();
}

/** The room could not load (a missing or broken GLB): its section stays a still, with no controls (Immersive.tsx). */
export function roomFailed(): void {
  shared.room.failed = true;
  emit();
}

/** Leaving the page by a client-side link: nothing lingers. */
export function resetHost(): void {
  setLive(null);
  host.active = null;
  host.onScreen = false;
}
