"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const;

type AcceptedMime = (typeof ACCEPTED_TYPES)[number];

function CompareSlider({ before, after }: { before: string; after: string }) {
  const [position, setPosition] = useState(50);
  return (
    <div className="compare-shell">
      <div className="compare-images">
        <img src={before} alt="Original" className="compare-image" />
        <div className="compare-overlay" style={{ width: `${position}%` }}>
          <img src={after} alt="Edited" className="compare-image" />
        </div>
        <div className="compare-handle" style={{ left: `${position}%` }}>
          <div className="compare-bar" />
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
      />
    </div>
  );
}

export default function ImageEditorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Revoke object URL on unmount or when file changes
    return () => {
      if (originalPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(originalPreview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalPreview]);

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setError(null);
    setEditedImage(null);
    const f = e.target.files?.[0] ?? null;

    if (!f) {
      setFile(null);
      setOriginalPreview(null);
      return;
    }

    if (!ACCEPTED_TYPES.includes(f.type as AcceptedMime)) {
      setError("Please upload a PNG or JPG image.");
      setFile(null);
      setOriginalPreview(null);
      return;
    }

    setFile(f);
    const objectUrl = URL.createObjectURL(f);
    setOriginalPreview(objectUrl);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setEditedImage(null);

    if (!file) {
      setError("Please upload an image first.");
      return;
    }
    if (!prompt.trim()) {
      setError("Please enter a prompt describing the edit.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("prompt", prompt.trim());

      const res = await fetch("/api/edit-image", { method: "POST", body: fd });

      const contentType = res.headers.get("content-type") || "";
      let payload: any = null;
      if (contentType.includes("application/json")) {
        payload = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Unexpected server response (${res.status}).`);
      }

      if (!res.ok) {
        throw new Error(payload?.error || `Request failed (${res.status}).`);
      }

      const dataUrl = payload?.image as string | undefined;
      if (!dataUrl) {
        throw new Error("Backend did not return an edited image.");
      }

      setEditedImage(dataUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <section style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", marginBottom: 8 }}>OpenAI Image Editor</h1>
        <p style={{ textAlign: "center", color: "#6b7280", marginTop: 0, marginBottom: 24 }}>
          Upload a photo, describe how you want to change it, and we will generate an edited version using OpenAI gpt-image-1.
        </p>

        <form onSubmit={onSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            Image (PNG or JPG)
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg"
              onChange={onFileChange}
              disabled={loading}
            />
          </label>

          <label>
            Edit prompt
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Remove the background and make it transparent"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Generating..." : "Generate edited image"}
          </button>

          {error ? (
            <div className="error" role="alert">
              {error}
            </div>
          ) : null}
        </form>

        {originalPreview && !editedImage ? (
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Original image</h3>
            <img src={originalPreview} alt="Original" className="main-image" />
          </div>
        ) : null}

        {originalPreview && editedImage ? (
          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Preview and compare</h3>

            <div>
              <h4 style={{ margin: '8px 0' }}>Original</h4>
              <img src={originalPreview} alt="Original" className="main-image" />
              <h4 style={{ margin: '12px 0 8px' }}>Edited</h4>
              <img src={editedImage} alt="Edited" className="main-image" />
            </div>

            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: '12px 0 8px' }}>Compare (slider)</h4>
              <CompareSlider before={originalPreview} after={editedImage} />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
