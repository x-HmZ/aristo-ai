"use client";

/**
 * FreeModelPreview — dev-only harness for the free-explore 3D model path.
 *
 * Reproduces the exact store state the free-mode flow produces, without
 * touching /api/teach or fal.ai:
 *
 *   1. "Image stage"  — what InputBox sets after /api/generate-model
 *      resolves: activePreviewImageUrl + pending3dImageUrl (the in-scene
 *      image plane with the "View in 3D" toolbar button).
 *   2. "Model stage"  — what the toolbar's View-in-3D click sets after
 *      /api/generate-model/3d resolves: activeModelUrl + viewMode3d=true
 *      (the GeneratedModel GLB in the scene).
 *
 * The model stage uses a local placeholder GLB (public/models/
 * dev_placeholder.glb) so iterating costs zero API credits.
 */

import { useEffect, useState } from "react";
import { AristoCanvas } from "@/components/learn/AristoCanvas";
import { useAristoStore, type TeacherAvatar } from "@/store/useAristoStore";

// Dev-only query overrides: ?avatar=ryan|sonia|marcus|priya and ?room=alt
// let the harness exercise every teacher GLB / the alternative classroom
// without auth. Parsed once on mount, before the first stage effect runs.
const AVATAR_PARAMS: readonly TeacherAvatar[] = ["ryan", "sonia", "marcus", "priya"];

const PLACEHOLDER_GLB = "/models/dev_placeholder.glb";
// 1×1 orange PNG data-URI — stands in for the fal.ai teaching image so the
// image plane + toolbar render without any remote fetch.
const PLACEHOLDER_IMG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type Stage = "empty" | "image" | "model";

export default function FreeModelPreview() {
  const [stage, setStage] = useState<Stage>("model");

  useEffect(() => {
    const s = useAristoStore.getState();
    s.setUserId("dev-mock-user");

    const params = new URLSearchParams(window.location.search);
    const avatar = params.get("avatar") as TeacherAvatar | null;
    if (avatar && AVATAR_PARAMS.includes(avatar)) s.setTeacher(avatar);
    if (params.get("room") === "alt") s.setClassroom("alternative");
  }, []);

  useEffect(() => {
    const s = useAristoStore.getState();
    if (stage === "model") {
      s.setActivePreviewImageUrl(PLACEHOLDER_IMG);
      s.setPending3dImageUrl(PLACEHOLDER_IMG);
      s.setActiveModelUrl(PLACEHOLDER_GLB);
      s.setViewMode3d(true);
    } else if (stage === "image") {
      s.setActivePreviewImageUrl(PLACEHOLDER_IMG);
      s.setPending3dImageUrl(PLACEHOLDER_IMG);
      s.setActiveModelUrl(null);
      s.setViewMode3d(false);
    } else {
      s.setActivePreviewImageUrl(null);
      s.setPending3dImageUrl(null);
      s.setActiveModelUrl(null);
      s.setViewMode3d(false);
    }
  }, [stage]);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <AristoCanvas />
      <div style={{
        position: "absolute", top: 12, left: 12,
        display: "flex", gap: 8, alignItems: "center",
        background: "rgba(0,0,0,0.55)", color: "white",
        padding: "6px 10px", borderRadius: 8,
        fontSize: 12, fontFamily: "monospace",
      }}>
        <span>/dev/free-model — stage:</span>
        {(["empty", "image", "model"] as Stage[]).map((s) => (
          <button
            key={s}
            data-testid={`stage-${s}`}
            onClick={() => setStage(s)}
            style={{
              background: stage === s ? "#F97B2F" : "#333",
              color: "white", border: "none", borderRadius: 6,
              padding: "4px 10px", fontSize: 12, fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
