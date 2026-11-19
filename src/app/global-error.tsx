"use client";

/**
 * Last-resort error screen: it replaces the root layout, so it brings its own <html> and body and cannot rely on the
 * app's fonts or stylesheet being loaded. Plain inline styles, no imports beyond React.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          background: "#fff",
          color: "#111",
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ lineHeight: 1.5 }}>
            Aristo could not be shown. Nothing you did caused it. Try again, or reload the page.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 16px", fontSize: 16, cursor: "pointer" }}
          >
            Try again
          </button>{" "}
          <a href="/" style={{ display: "inline-block", minHeight: 44, lineHeight: "44px", padding: "0 8px" }}>
            Back to the start
          </a>
        </main>
      </body>
    </html>
  );
}
