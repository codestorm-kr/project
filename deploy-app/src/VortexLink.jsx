import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  UploadCloud, Download, Lock, Unlock, Copy, Check, Shuffle, FileText,
  Image as ImageIcon, Music, Video, Archive, X, AlertTriangle, ShieldCheck,
  Radio, Loader2, ArrowRight, KeyRound, Send, Trash2, Plus, Zap, Waves,
  FileWarning, PackageCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "vortex_vault_v1";
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB per file — demo-safe for sessionStorage

const ADJECTIVES = ["neon", "quiet", "ghost", "amber", "cobalt", "static", "vapor", "lunar", "cinder", "onyx"];
const NOUNS = ["falcon", "vortex", "signal", "prism", "delta", "circuit", "raven", "nova", "ember", "drift"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function iconForType(type) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.startsWith("video/")) return Video;
  if (type.startsWith("audio/")) return Music;
  if (type.includes("zip") || type.includes("rar") || type.includes("7z") || type.includes("tar")) return Archive;
  return FileText;
}

function normalizeCode(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

function generateCode() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${a}-${n}${num}`;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadVault() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveVault(vault) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  } catch {
    /* quota exceeded — silently ignore, in-memory state still holds it */
  }
}

/* ------------------------------------------------------------------ */
/*  Ripple button                                                       */
/* ------------------------------------------------------------------ */

function RippleButton({ children, onClick, disabled, className, style, glow }) {
  const [ripples, setRipples] = useState([]);
  const btnRef = useRef(null);

  const fire = (e) => {
    if (disabled) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x, y }]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 700);
    onClick?.(e);
  };

  return (
    <button
      ref={btnRef}
      onClick={fire}
      disabled={disabled}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {glow && !disabled && (
        <span
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ boxShadow: `0 0 24px ${glow}, 0 0 4px ${glow} inset` }}
        />
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: r.x,
            top: r.y,
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
            background: "rgba(255,255,255,0.55)",
            animation: "rippleExpand 0.7s ease-out forwards",
          }}
        />
      ))}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function VortexLink() {
  const [mode, setMode] = useState("deposit"); // 'deposit' | 'extract'
  const [vault, setVault] = useState(() => loadVault());

  /* deposit state */
  const [depositCode, setDepositCode] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPacking, setIsPacking] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [justPacked, setJustPacked] = useState(null); // code just deposited to
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  /* extract state */
  const [extractCode, setExtractCode] = useState("");
  const [extractResult, setExtractResult] = useState(null); // {code, entry} | 'not_found' | null
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    saveVault(vault);
  }, [vault]);

  /* ---------------- deposit logic ---------------- */

  const packFiles = useCallback(
    async (fileList) => {
      const code = normalizeCode(depositCode);
      if (!code) {
        setDepositError("Enter an access code before dropping files.");
        return;
      }
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const oversized = files.filter((f) => f.size > MAX_FILE_BYTES);
      if (oversized.length > 0) {
        setDepositError(`"${oversized[0].name}" exceeds the 8MB demo limit.`);
        return;
      }

      setDepositError("");
      setIsPacking(true);

      const entries = await Promise.all(
        files.map(async (f) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          size: f.size,
          type: f.type || "application/octet-stream",
          dataUrl: await readFileAsDataURL(f),
        }))
      );

      setVault((prev) => {
        const existing = prev[code];
        const merged = {
          files: existing ? [...existing.files, ...entries] : entries,
          createdAt: existing ? existing.createdAt : Date.now(),
          updatedAt: Date.now(),
        };
        return { ...prev, [code]: merged };
      });

      setIsPacking(false);
      setJustPacked(code);
    },
    [depositCode]
  );

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    packFiles(e.dataTransfer.files);
  };

  const handleBrowse = (e) => {
    if (e.target.files) packFiles(e.target.files);
    e.target.value = "";
  };

  const openBrowser = () => {
    const code = normalizeCode(depositCode);
    if (!code) {
      setDepositError("Enter an access code before dropping files.");
      return;
    }
    fileInputRef.current?.click();
  };

  const removePackedFile = (code, fileId) => {
    setVault((prev) => {
      const entry = prev[code];
      if (!entry) return prev;
      const remaining = entry.files.filter((f) => f.id !== fileId);
      const next = { ...prev };
      if (remaining.length === 0) delete next[code];
      else next[code] = { ...entry, files: remaining };
      return next;
    });
  };

  const startNewDeposit = () => {
    setJustPacked(null);
    setDepositCode("");
    setDepositError("");
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const suggestCode = () => {
    setDepositCode(generateCode());
    setDepositError("");
  };

  /* ---------------- extract logic ---------------- */

  const runExtract = () => {
    const code = normalizeCode(extractCode);
    if (!code) return;
    setIsExtracting(true);
    setExtractResult(null);
    setTimeout(() => {
      const entry = vault[code];
      setExtractResult(entry ? { code, entry } : "not_found");
      setIsExtracting(false);
    }, 550); // brief materialize delay for the sci-fi feel
  };

  const resetExtract = () => {
    setExtractResult(null);
    setExtractCode("");
  };

  const packedEntry = justPacked ? vault[justPacked] : null;
  const glowColor = mode === "deposit" ? "#7000FF" : "#00E5FF";

  /* ------------------------------------------------------------------ */

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden text-white flex items-center justify-center p-4"
      style={{ background: "#030206", fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
    >
      <style>{`
        @keyframes flareA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(70px,50px) scale(1.2); } }
        @keyframes flareB { 0%,100% { transform: translate(0,0) scale(1.15); } 50% { transform: translate(-60px,-40px) scale(0.9); } }
        @keyframes rippleExpand { from { width:10px;height:10px;margin-left:-5px;margin-top:-5px;opacity:0.6; } to { width:340px;height:340px;margin-left:-170px;margin-top:-170px;opacity:0; } }
        @keyframes dashPulse { 0%,100% { border-color: rgba(0,229,255,0.35); box-shadow: 0 0 0px rgba(0,229,255,0.15); } 50% { border-color: rgba(0,229,255,0.9); box-shadow: 0 0 32px rgba(0,229,255,0.35); } }
        @keyframes shakeX { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes fadeUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .flare-anim { animation: none !important; } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 9999px; }
        .glass-panel { backdrop-filter: blur(28px); background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 40px rgba(255,255,255,0.02); }
        .drop-active { animation: dashPulse 1.1s ease-in-out infinite; }
        .shake { animation: shakeX 0.4s ease-in-out; }
        .fade-up { animation: fadeUp 0.35s ease-out; }
      `}</style>

      {/* ambient flares */}
      <div
        className="absolute flare-anim rounded-full pointer-events-none"
        style={{ top: "-14%", left: "-10%", width: 620, height: 620, background: "radial-gradient(circle, rgba(0,229,255,0.28), transparent 70%)", filter: "blur(100px)", animation: "flareA 20s ease-in-out infinite" }}
      />
      <div
        className="absolute flare-anim rounded-full pointer-events-none"
        style={{ bottom: "-16%", right: "-10%", width: 680, height: 680, background: "radial-gradient(circle, rgba(112,0,255,0.32), transparent 70%)", filter: "blur(110px)", animation: "flareB 24s ease-in-out infinite" }}
      />

      <div className="relative z-10 w-full max-w-xl flex flex-col gap-5">
        {/* brand */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <Waves size={18} style={{ color: glowColor }} className="transition-colors duration-500" />
          <span className="text-sm tracking-[0.3em] text-white/50 font-medium">VORTEX LINK</span>
        </div>

        {/* dual toggle */}
        <div className="relative glass-panel rounded-full p-1 flex">
          <div
            className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out"
            style={{
              width: "calc(50% - 4px)",
              left: mode === "deposit" ? 4 : "calc(50% + 0px)",
              background: `linear-gradient(90deg, ${mode === "deposit" ? "#7000FF" : "#00E5FF"}, ${mode === "deposit" ? "#00E5FF" : "#7000FF"}22)`,
              boxShadow: `0 0 20px ${mode === "deposit" ? "rgba(112,0,255,0.5)" : "rgba(0,229,255,0.5)"}`,
            }}
          />
          <button
            onClick={() => setMode("deposit")}
            className="relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold tracking-wider rounded-full"
            style={{ color: mode === "deposit" ? "#fff" : "rgba(255,255,255,0.4)" }}
          >
            <UploadCloud size={14} /> DEPOSIT PAYLOAD
          </button>
          <button
            onClick={() => setMode("extract")}
            className="relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold tracking-wider rounded-full"
            style={{ color: mode === "extract" ? "#fff" : "rgba(255,255,255,0.4)" }}
          >
            <Download size={14} /> EXTRACT PAYLOAD
          </button>
        </div>

        {/* main panel */}
        <div
          className="glass-panel rounded-3xl p-6 md:p-8 transition-shadow duration-700"
          style={{ boxShadow: `0 0 60px -20px ${glowColor}55, inset 0 1px 0 rgba(255,255,255,0.05)` }}
        >
          {mode === "deposit" ? (
            packedEntry ? (
              /* ---------- deposit success view ---------- */
              <div className="fade-up flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(112,0,255,0.18)" }}>
                    <PackageCheck size={20} style={{ color: "#7000FF" }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Payload secured</div>
                    <div className="text-xs text-white/40">Share the code below verbally with the receiver.</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl px-5 py-4" style={{ background: "rgba(112,0,255,0.1)", border: "1px solid rgba(112,0,255,0.35)" }}>
                  <span className="text-2xl font-bold tracking-[0.15em]" style={{ color: "#c9a3ff" }}>{justPacked}</span>
                  <button
                    onClick={() => copyCode(justPacked)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                  {packedEntry.files.map((f) => {
                    const Icon = iconForType(f.type);
                    return (
                      <div key={f.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                        <Icon size={16} className="text-white/50 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate">{f.name}</div>
                          <div className="text-[10px] text-white/35">{formatBytes(f.size)}</div>
                        </div>
                        <button onClick={() => removePackedFile(justPacked, f.id)} className="text-white/30 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={openBrowser}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <Plus size={14} /> Add more files
                  </button>
                  <button
                    onClick={startNewDeposit}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-black"
                    style={{ background: "linear-gradient(90deg, #7000FF, #00E5FF)" }}
                  >
                    New transfer <ArrowRight size={14} />
                  </button>
                </div>
                <input ref={fileInputRef} type="file" multiple hidden onChange={handleBrowse} />
              </div>
            ) : (
              /* ---------- deposit input view ---------- */
              <div className="flex flex-col gap-5">
                <div>
                  <label className="text-[11px] tracking-[0.2em] text-white/40 flex items-center gap-2 mb-2">
                    <KeyRound size={12} /> GENERATE CUSTOM ACCESS CODE
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={depositCode}
                      onChange={(e) => {
                        setDepositCode(e.target.value);
                        setDepositError("");
                      }}
                      placeholder="e.g. titan7, ghost-falcon42"
                      className="flex-1 bg-black/40 border rounded-xl px-4 py-3 text-sm outline-none tracking-wide placeholder-white/25 transition-colors"
                      style={{ borderColor: depositError ? "#FF3B30" : "rgba(255,255,255,0.1)" }}
                    />
                    <button
                      onClick={suggestCode}
                      title="Suggest a code"
                      className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(112,0,255,0.15)", border: "1px solid rgba(112,0,255,0.35)" }}
                    >
                      <Shuffle size={15} style={{ color: "#a875ff" }} />
                    </button>
                  </div>
                  {depositError && (
                    <div className="flex items-center gap-1.5 text-[11px] mt-2" style={{ color: "#FF3B30" }}>
                      <AlertTriangle size={12} /> {depositError}
                    </div>
                  )}
                </div>

                <div
                  onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                  onDrop={handleDrop}
                  onClick={openBrowser}
                  className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-12 px-6 cursor-pointer transition-colors ${isDragOver ? "drop-active" : ""}`}
                  style={{ borderColor: isDragOver ? "rgba(0,229,255,0.7)" : "rgba(255,255,255,0.12)", background: isDragOver ? "rgba(0,229,255,0.06)" : "rgba(255,255,255,0.02)" }}
                >
                  {isPacking ? (
                    <>
                      <Loader2 size={30} className="animate-spin" style={{ color: "#7000FF" }} />
                      <span className="text-xs text-white/50">Encoding payload...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={30} style={{ color: isDragOver ? "#00E5FF" : "rgba(255,255,255,0.35)" }} />
                      <div className="text-center">
                        <div className="text-sm font-medium">Drop files, or click to browse</div>
                        <div className="text-[11px] text-white/35 mt-1">Up to 8MB per file · fully local to this session</div>
                      </div>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" multiple hidden onChange={handleBrowse} />
              </div>
            )
          ) : (
            /* ---------- extract mode ---------- */
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-[11px] tracking-[0.2em] text-white/40 flex items-center gap-2 mb-2">
                  <Radio size={12} /> RECEIVE MATRIX
                </label>
                <div className={`flex gap-2 ${extractResult === "not_found" ? "shake" : ""}`}>
                  <input
                    value={extractCode}
                    onChange={(e) => { setExtractCode(e.target.value); setExtractResult(null); }}
                    onKeyDown={(e) => e.key === "Enter" && runExtract()}
                    placeholder="Enter the verbal passcode..."
                    className="flex-1 bg-black/40 border rounded-xl px-4 py-3 text-sm outline-none tracking-wide placeholder-white/25"
                    style={{ borderColor: extractResult === "not_found" ? "#FF3B30" : "rgba(255,255,255,0.1)" }}
                  />
                  <RippleButton
                    onClick={runExtract}
                    disabled={!extractCode.trim() || isExtracting}
                    glow="rgba(0,229,255,0.6)"
                    className="flex-shrink-0 px-6 rounded-xl text-xs font-bold tracking-wider text-black disabled:opacity-30"
                    style={{ background: "linear-gradient(90deg, #00E5FF, #7000FF)" }}
                  >
                    {isExtracting ? <Loader2 size={15} className="animate-spin" /> : <>EXTRACT <Zap size={13} /></>}
                  </RippleButton>
                </div>
              </div>

              {extractResult === "not_found" && (
                <div className="fade-up flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.35)" }}>
                  <FileWarning size={18} style={{ color: "#FF3B30" }} />
                  <div className="text-xs text-white/60">
                    No payload found for <span className="font-semibold text-white">{normalizeCode(extractCode)}</span>. Check the code and try again.
                  </div>
                </div>
              )}

              {extractResult && extractResult !== "not_found" && (
                <div className="fade-up flex flex-col gap-4">
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.3)" }}>
                    <ShieldCheck size={18} style={{ color: "#00E5FF" }} />
                    <div className="text-xs">
                      <span className="font-semibold">Match confirmed.</span>{" "}
                      <span className="text-white/50">{extractResult.entry.files.length} file(s) ready.</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {extractResult.entry.files.map((f) => {
                      const Icon = iconForType(f.type);
                      return (
                        <a
                          key={f.id}
                          href={f.dataUrl}
                          download={f.name}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.07]"
                          style={{ background: "rgba(255,255,255,0.04)" }}
                        >
                          <Icon size={16} className="flex-shrink-0" style={{ color: "#00E5FF" }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate">{f.name}</div>
                            <div className="text-[10px] text-white/35">{formatBytes(f.size)}</div>
                          </div>
                          <Download size={14} className="text-white/40 flex-shrink-0" />
                        </a>
                      );
                    })}
                  </div>

                  <button
                    onClick={resetExtract}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    Extract another code
                  </button>
                </div>
              )}

              {!extractResult && (
                <div className="flex items-center gap-2 text-[11px] text-white/30 justify-center py-2">
                  <Lock size={12} /> Codes are matched locally — nothing is sent until extraction.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/25">
          <Unlock size={10} /> Zero login · Zero email · Session-bound and anonymous
        </div>
      </div>
    </div>
  );
}
