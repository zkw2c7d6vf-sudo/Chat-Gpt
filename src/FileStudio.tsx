import { useEffect, useRef, useState } from "react";
import { Download, FileJson, Image, Upload } from "lucide-react";
import { convertText } from "./fileTools";
import "./modules.css";

type Result = { url: string; name: string; bytes: number; image: boolean };
export default function FileStudio() {
  const [tab, setTab] = useState("image"),
    [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState(""),
    [format, setFormat] = useState("image/webp"),
    [quality, setQuality] = useState(85);
  const [mode, setMode] = useState("format-json"),
    [text, setText] = useState(""),
    [output, setOutput] = useState("");
  const [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null),
    job = useRef(0);
  const urlRef = useRef("");
  useEffect(
    () => () => {
      job.current++;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  const publish = (blob: Blob, name: string, image: boolean) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setResult({ url, name, bytes: blob.size, image });
  };
  const clear = () => {
    job.current++;
    setBusy(false);
    setError("");
    setResult(null);
    setOutput("");
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
  };
  const choose = async (selected?: File) => {
    if (!selected) return;
    clear();
    if (tab === "image") {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(selected.type) ||
        selected.size > 20 * 1024 * 1024
      ) {
        setError("Choose a PNG, JPEG, or WebP image up to 20 MiB.");
        return;
      }
      setFile(selected);
      setWidth("");
    } else {
      if (selected.size > 2 * 1024 * 1024) {
        setError("Choose a text, JSON, or CSV file smaller than 2 MiB.");
        return;
      }
      const current = job.current;
      try {
        const contents = await selected.text();
        if (current === job.current) setText(contents);
      } catch {
        setError("This file could not be read. Try selecting it again.");
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };
  const convertImage = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    const current = ++job.current;
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40_000_000)
        throw new Error("Choose an image below 40 megapixels.");
      const desired = width.trim() ? Number(width) : bitmap.width;
      if (!Number.isInteger(desired) || desired < 1 || desired > 8192)
        throw new Error("Set an output width from 1 to 8,192 pixels.");
      const height = Math.max(
        1,
        Math.round((bitmap.height * desired) / bitmap.width),
      );
      if (desired * height > 40_000_000 || height > 8192)
        throw new Error(
          "Choose a smaller output width; the resized image exceeds 8,192 pixels or 40 megapixels.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = desired;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Image conversion is unavailable in this browser.");
      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, desired, height);
      }
      context.drawImage(bitmap, 0, 0, desired, height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("The browser could not encode this image.")),
          format,
          quality / 100,
        ),
      );
      if (blob.type !== format)
        throw new Error(
          "This browser does not support the selected output format. Try PNG.",
        );
      if (current === job.current)
        publish(
          blob,
          `${file.name.replace(/\.[^.]+$/, "")}-${desired}w.${format === "image/jpeg" ? "jpg" : format.split("/")[1]}`,
          true,
        );
    } catch (cause) {
      if (current === job.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not convert the image.",
        );
    } finally {
      bitmap?.close();
      if (current === job.current) setBusy(false);
    }
  };
  const convert = () => {
    clear();
    try {
      const converted = convertText(text, mode);
      setOutput(converted.text);
      publish(
        new Blob([converted.text], { type: converted.type }),
        `orbit-converted.${converted.extension}`,
        false,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The text could not be converted.",
      );
    }
  };
  return (
    <section className="module-surface file-studio" aria-label="File Studio">
      <header className="module-header">
        <div>
          <span className="eyebrow">LOCAL TOOLS</span>
          <h2>
            <FileJson size={24} />
            File Studio
          </h2>
          <p>Convert images and structured text directly in your browser.</p>
        </div>
        <span className="module-chip">No uploads</span>
      </header>
      <div className="module-tabs" role="group" aria-label="File Studio tools">
        <button
          aria-pressed={tab === "image"}
          onClick={() => {
            clear();
            setTab("image");
          }}
        >
          <Image size={16} />
          Images
        </button>
        <button
          aria-pressed={tab === "text"}
          onClick={() => {
            clear();
            setTab("text");
          }}
        >
          <FileJson size={16} />
          JSON & CSV
        </button>
      </div>
      <div className="studio-grid">
        <div className="studio-workbench">
          <button
            className="studio-dropzone"
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void choose(event.dataTransfer.files[0]);
            }}
          >
            <Upload size={26} />
            <strong>
              {tab === "image"
                ? file?.name || "Choose or drop an image"
                : "Load a JSON, CSV, or text file"}
            </strong>
            <span>
              {tab === "image"
                ? "PNG, JPEG, WebP · up to 20 MiB"
                : "Or paste text below · up to 2 MiB"}
            </span>
          </button>
          <input
            ref={fileInput}
            hidden
            type="file"
            aria-label="File Studio input"
            accept={
              tab === "image"
                ? "image/png,image/jpeg,image/webp"
                : ".json,.csv,.txt,text/plain,application/json,text/csv"
            }
            onChange={(event) => void choose(event.target.files?.[0])}
          />
          {tab === "image" ? (
            <div className="module-form">
              <label>
                Output format
                <select
                  aria-label="Image output format"
                  value={format}
                  onChange={(event) => {
                    clear();
                    setFormat(event.target.value);
                  }}
                >
                  <option value="image/webp">WebP</option>
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPEG</option>
                </select>
              </label>
              <label>
                Width in pixels (optional)
                <input
                  aria-label="Image output width"
                  type="number"
                  min="1"
                  max="8192"
                  placeholder="Keep original width"
                  value={width}
                  onChange={(event) => {
                    clear();
                    setWidth(event.target.value);
                  }}
                />
              </label>
              <label>
                Quality · {quality}%
                <input
                  aria-label="Image quality"
                  type="range"
                  min="10"
                  max="100"
                  disabled={format === "image/png"}
                  value={quality}
                  onChange={(event) => {
                    clear();
                    setQuality(Number(event.target.value));
                  }}
                />
              </label>
              <p>
                Aspect ratio is preserved. JPEG uses a white background for
                transparent areas. Metadata is removed by canvas re-encoding.
              </p>
              <button
                className="primary-button"
                disabled={!file || busy}
                onClick={() => void convertImage()}
              >
                {busy ? "Converting…" : "Convert image"}
              </button>
            </div>
          ) : (
            <div className="module-form">
              <label>
                Conversion
                <select
                  aria-label="Text conversion"
                  value={mode}
                  onChange={(event) => {
                    clear();
                    setMode(event.target.value);
                  }}
                >
                  <option value="format-json">Format JSON</option>
                  <option value="minify-json">Minify JSON</option>
                  <option value="csv-json">CSV → JSON</option>
                  <option value="json-csv">JSON → CSV</option>
                </select>
              </label>
              <label>
                Source text
                <textarea
                  aria-label="File Studio source text"
                  rows={14}
                  value={text}
                  spellCheck={false}
                  onChange={(event) => {
                    clear();
                    setText(event.target.value);
                  }}
                  placeholder={
                    mode === "csv-json"
                      ? "name,course\n"
                      : '[{"name":"","course":""}]'
                  }
                />
              </label>
              <button
                className="primary-button"
                disabled={!text.trim()}
                onClick={convert}
              >
                Convert text
              </button>
            </div>
          )}
          {error && (
            <p className="module-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="studio-result" aria-label="Conversion result">
          {result ? (
            <>
              <div className="studio-result-heading">
                <h3>Ready to download</h3>
                <span>{(result.bytes / 1024).toFixed(1)} KiB</span>
              </div>
              {result.image ? (
                <img src={result.url} alt="Converted image preview" />
              ) : (
                <textarea
                  aria-label="Converted text"
                  readOnly
                  rows={18}
                  value={output}
                />
              )}
              <a
                className="primary-button"
                href={result.url}
                download={result.name}
              >
                <Download size={15} />
                Download {result.name}
              </a>
            </>
          ) : (
            <div className="module-empty">
              <FileJson size={32} />
              <h3>Output preview</h3>
              <p>Your converted file will appear here.</p>
            </div>
          )}
        </div>
      </div>
      <p className="module-privacy">
        Files stay in this tab and are released when you leave. This tool does
        not upload files to Orbit, Drive, AI, or conversion services. PDF,
        Office documents, and video transcoding are not supported.
      </p>
    </section>
  );
}
