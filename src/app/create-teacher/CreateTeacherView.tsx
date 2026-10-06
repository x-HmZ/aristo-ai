import type { RefObject } from "react";
import { ArrowLeft, CircleAlert, CircleCheck, Info, LoaderCircle } from "lucide-react";
import { AristoMark } from "@/components/brand/AristoMark";
import { Button } from "@/components/ui/button";
import { SHAPE } from "@/lib/design/shape";
import { cn } from "@/lib/utils";

export type ExportStatus = "idle" | "saving" | "saved" | "error";

interface CreateTeacherViewProps {
  /** False when NEXT_PUBLIC_AVATURN_SUBDOMAIN is unset: the editor cannot load. */
  configured:  boolean;
  /** The Avaturn SDK injects its iframe here. */
  editorRef:   RefObject<HTMLDivElement>;
  status:      ExportStatus;
  savedUrl:    string | null;
  existingUrl: string | null;
}

// Message boxes as on the auth pages: a status tint with its border, an icon, ink text.
const BOX = cn(SHAPE.control, "flex w-full max-w-md items-start gap-2.5 border px-4 py-3 text-sm");
const CODE = "rounded-md bg-sunk px-1.5 py-0.5 font-mono text-[0.92em] text-ink";

/**
 * The create-teacher page without the SDK: header, editor frame, export status.
 * On the design system since V8.6: it follows the theme. The Avaturn editor is
 * a third-party iframe and keeps its own look.
 */
export function CreateTeacherView({ configured, editorRef, status, savedUrl, existingUrl }: CreateTeacherViewProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg p-6 text-ink">

      {/* Header */}
      <div className="text-center">
        <div className="mb-6 flex items-center justify-center">
          <AristoMark decorative={false} className="h-5 text-ink" litClassName="text-accent" />
        </div>
        <h1 className="type-h2 font-semibold text-ink">Create Your Teacher</h1>
        <p className="mt-1 text-sm text-body">
          Design a photorealistic 3D avatar — it will appear as your teacher in Aristo.
        </p>
      </div>

      {/* Unconfigured state */}
      {!configured && (
        <div className={cn(SHAPE.surface, "max-w-sm border border-line bg-surface px-6 py-8 text-center shadow-e1")}>
          <p className="mb-2 text-sm font-semibold text-ink">Avatar creator not configured</p>
          <p className="text-sm leading-relaxed text-body">
            Create a free project at{" "}
            <code className={CODE}>developer.avaturn.me</code>,
            then set{" "}
            <code className={cn(CODE, "break-all")}>NEXT_PUBLIC_AVATURN_SUBDOMAIN</code>{" "}
            in your environment variables.
          </p>
        </div>
      )}

      {/* Status */}
      {status === "saving" && (
        <div role="status" className={cn(BOX, "border-tint-line bg-tint text-ink")}>
          <LoaderCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text motion-safe:animate-spin" />
          Saving your teacher…
        </div>
      )}
      {status === "saved" && (
        <div role="status" className={cn(BOX, "border-success/25 bg-success/10 text-ink")}>
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="font-semibold text-success">Avatar exported.</p>
            {savedUrl?.startsWith("(downloaded") ? (
              <p className="mt-1 leading-relaxed text-body">
                Check your Downloads folder. Rename the file to{" "}
                <code className={CODE}>Teacher_Marcus.glb</code> (or{" "}
                <code className={CODE}>Teacher_Priya.glb</code>) and move it
                to <code className={CODE}>public/models/</code>.
              </p>
            ) : (
              <p className="mt-1 leading-relaxed text-body">
                Head back to{" "}
                <a href="/learn" className="font-semibold text-ink underline underline-offset-2 hover:text-accent-text">the app</a>
                {" "}and select &quot;My Teacher&quot;.
              </p>
            )}
          </div>
        </div>
      )}
      {status === "error" && (
        <div role="alert" className={cn(BOX, "border-danger/25 bg-danger/10 text-danger")}>
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Save failed — check your connection and try again.
        </div>
      )}
      {existingUrl && status === "idle" && (
        <div className={cn(BOX, "border-tint-line bg-tint text-ink")}>
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
          You have an existing teacher. Completing the avatar below will replace it.
        </div>
      )}

      {/* Avaturn editor container — SDK injects the iframe here */}
      {configured && (
        <div className={cn(SHAPE.surface, "w-full max-w-2xl overflow-hidden border border-line bg-surface shadow-e2")}>
          <div
            ref={editorRef}
            style={{ width: "100%", height: "600px" }}
          />
        </div>
      )}

      {savedUrl && (
        <p className="max-w-lg break-all text-center font-mono text-xs text-muted">
          {savedUrl}
        </p>
      )}

      <Button asChild variant="ghost">
        <a href="/learn">
          <ArrowLeft aria-hidden />
          Back to Aristo
        </a>
      </Button>
    </div>
  );
}
