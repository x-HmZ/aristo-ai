import { shared } from "./shared";
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

/** Leaving the page by a client-side link: nothing lingers. */
export function resetHost(): void {
  setLive(null);
  host.active = null;
  host.onScreen = false;
}
