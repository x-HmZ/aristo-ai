"use client";

import { useEffect, useRef, useState } from "react";
import { AvaturnSDK } from "@avaturn/sdk";
import { CreateTeacherView, type ExportStatus } from "./CreateTeacherView";

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
  const [status, setStatus]    = useState<ExportStatus>("idle");
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
    <CreateTeacherView
      configured={!!AVATURN_URL}
      editorRef={containerRef}
      status={status}
      savedUrl={savedUrl}
      existingUrl={existingUrl}
    />
  );
}
