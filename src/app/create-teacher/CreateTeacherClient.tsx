"use client";

import { useEffect, useRef, useState } from "react";
import { AvaturnSDK } from "@avaturn/sdk";

// Set NEXT_PUBLIC_AVATURN_SUBDOMAIN in Vercel / .env.local after creating a
// free project at https://developer.avaturn.dev — you'll receive a subdomain
// like "aristo.avaturn.dev". Set the value to just the subdomain part
// (e.g. "aristo"). Without it the editor won't load.
const AVATURN_URL = process.env.NEXT_PUBLIC_AVATURN_SUBDOMAIN
  ? `https://${process.env.NEXT_PUBLIC_AVATURN_SUBDOMAIN}.avaturn.dev/`
  : null;

interface CreateTeacherClientProps {
  userId:      string;
  existingUrl: string | null;
}

export function CreateTeacherClient({ userId, existingUrl }: CreateTeacherClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sdkRef       = useRef<AvaturnSDK | null>(null);
  const [status, setStatus]    = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedUrl, setSavedUrl] = useState<string | null>(existingUrl);

  useEffect(() => {
    if (!AVATURN_URL || !containerRef.current) return;

    const sdk = new AvaturnSDK();
    sdkRef.current = sdk;

    sdk.init(containerRef.current, { url: AVATURN_URL }).then(() => {
      sdk.on("export", async (data) => {
        const avatarUrl: string = data.url;

        // Avaturn free tier returns a base64 data URL (GLB encoded inline),
        // not a hosted https URL. We can't save data URLs to Supabase
        // (too long) so we trigger a browser download instead — user can
        // then rename the file and drop it into public/models/.
        if (data.urlType === "dataURL") {
          setStatus("saving");
          try {
            const res  = await fetch(avatarUrl);
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = `avatar-${Date.now()}.glb`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);

            setSavedUrl(`(downloaded as ${a.download} — ${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
            setStatus("saved");
          } catch {
            setStatus("error");
          }
          return;
        }

        // Hosted https URL — paid Avaturn plan or session created via API.
        // Save it to the user's profile for the "My Teacher" custom avatar flow.
        setStatus("saving");
        try {
          const res = await fetch("/api/profile/custom-teacher", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ userId, avatarUrl }),
          });
          if (!res.ok) throw new Error("Save failed");
          setSavedUrl(avatarUrl);
          setStatus("saved");
        } catch {
          setStatus("error");
        }
      });
    });

    return () => {
      sdk.destroy();
      sdkRef.current = null;
    };
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#FDF0E4] flex flex-col items-center justify-center p-6 gap-6">

      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="font-bold text-[#3D2110] text-2xl tracking-tight">aristo</span>
          <span className="text-[#F97B2F] text-2xl font-bold">✦</span>
        </div>
        <h1 className="text-xl font-bold text-[#3D2110]">Create Your Teacher</h1>
        <p className="text-sm text-[#8B6E5A] mt-1">
          Design a photorealistic 3D avatar — it will appear as your teacher in Aristo.
        </p>
      </div>

      {/* Unconfigured state */}
      {!AVATURN_URL && (
        <div className="max-w-sm text-center px-6 py-8 rounded-2xl bg-white/60 border border-white/60 shadow-sm">
          <p className="text-sm font-semibold text-[#3D2110] mb-2">Avatar creator not configured</p>
          <p className="text-xs text-[#8B6E5A] leading-relaxed">
            Create a free project at{" "}
            <span className="font-mono text-[#F97B2F]">developer.avaturn.me</span>,
            then set{" "}
            <span className="font-mono text-[#F97B2F]">NEXT_PUBLIC_AVATURN_SUBDOMAIN</span>{" "}
            in your environment variables.
          </p>
        </div>
      )}

      {/* Status bar */}
      {status === "saving" && (
        <div className="px-4 py-2 rounded-full bg-[#F97B2F]/10 border border-[#F97B2F]/30 text-sm font-medium text-[#C45A10] animate-pulse">
          Saving your teacher…
        </div>
      )}
      {status === "saved" && (
        <div className="max-w-md px-4 py-3 rounded-2xl bg-[#F0FDF4] border border-[#10B981]/30 text-sm font-medium text-[#059669]">
          <div className="flex items-center gap-2 mb-1">
            <span>✓</span>
            <span>Avatar exported.</span>
          </div>
          {savedUrl?.startsWith("(downloaded") ? (
            <p className="text-xs text-[#047857] leading-relaxed">
              Check your Downloads folder. Rename the file to{" "}
              <span className="font-mono">Teacher_Marcus.glb</span> (or{" "}
              <span className="font-mono">Teacher_Priya.glb</span>) and move it
              to <span className="font-mono">public/models/</span>.
            </p>
          ) : (
            <p className="text-xs text-[#047857] leading-relaxed">
              Head back to{" "}
              <a href="/learn" className="underline font-semibold hover:text-[#047857]">the app</a>
              {" "}and select "My Teacher".
            </p>
          )}
        </div>
      )}
      {status === "error" && (
        <div className="px-4 py-2 rounded-full bg-red-50 border border-red-200 text-sm font-medium text-red-700">
          Save failed — check your connection and try again.
        </div>
      )}
      {existingUrl && status === "idle" && (
        <div className="px-4 py-2 rounded-full bg-[#F0FDF4] border border-[#10B981]/30 text-xs text-[#059669]">
          You have an existing teacher. Completing the avatar below will replace it.
        </div>
      )}

      {/* Avaturn editor container — SDK injects the iframe here */}
      {AVATURN_URL && (
        <div
          className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(249,123,47,0.18)] border border-white/60"
        >
          <div
            ref={containerRef}
            style={{ width: "100%", height: "600px" }}
          />
        </div>
      )}

      {savedUrl && (
        <p className="text-[10px] text-[#B8957A] font-mono break-all max-w-lg text-center">
          {savedUrl}
        </p>
      )}

      <a
        href="/learn"
        className="text-sm text-[#8B6E5A] hover:text-[#3D2110] font-medium transition-colors"
      >
        ← Back to Aristo
      </a>
    </div>
  );
}
