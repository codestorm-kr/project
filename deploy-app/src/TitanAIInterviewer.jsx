import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Terminal, Code2, Send, Bell, Settings, ChevronDown, Search, Activity,
  Brain, Zap, ShieldAlert, AlertTriangle, User, Bot, RotateCcw, Sparkles,
  Clock, MessageSquare, CheckCircle2, XCircle, Mic, ArrowUpRight, Radio,
  VenetianMask, SearchCode, HelpCircle, History, Users, BarChart3,
  LifeBuoy, Play, Lock, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Static persona + script data                                       */
/* ------------------------------------------------------------------ */

const PERSONAS = {
  A: {
    id: "A",
    name: "The Silent Intimidator",
    short: "Intimidator",
    color: "#FF3B30",
    Icon: VenetianMask,
    tag: "Zero validation. Zero warmth.",
    dossier:
      "Responds in curt, single-sentence fragments. Never confirms whether your solution is correct. Will not react to jokes, hedging, or small talk — only to claims you can defend.",
    opener: "Sit down. State the problem. Nothing else.",
    script: [
      "Explain why you are confident in line {line}. Proceed.",
      "That is an assertion, not a proof. State the time complexity. One line.",
      "Acceptable. Now tell me what input breaks this.",
      "Noted. Sufficient. Interview concluded.",
    ],
    deltas: [
      { stress: 10, rating: -2 },
      { stress: 8, rating: 2 },
      { stress: 6, rating: 3 },
      { stress: -5, rating: 5 },
    ],
  },
  B: {
    id: "B",
    name: "The Nitpicker",
    short: "Nitpicker",
    color: "#FF9F0A",
    Icon: SearchCode,
    tag: "Death by a thousand micro-critiques.",
    dossier:
      "Interrupts sound logic to attack variable naming, style, and micro-optimizations. Passive-aggressive by design — treats every line as a style-guide violation waiting to happen.",
    opener:
      "Before you write a single character — walk me through your naming plan. I'm already skeptical.",
    script: [
      "Noted. Now — did you even consider an in-place approach before reaching for that auxiliary array?",
      "Your indentation aside, explain the actual Big-O here. No hand-waving.",
      "I see camelCase and snake_case in the same fifteen lines. Pick one. Final complexity?",
      "Fine. It compiles, in theory. Interview concluded.",
    ],
    deltas: [
      { stress: 7, rating: -3 },
      { stress: 9, rating: 1 },
      { stress: 8, rating: -2 },
      { stress: -4, rating: 4 },
    ],
  },
  C: {
    id: "C",
    name: "The Vague Product Lead",
    short: "Product Lead",
    color: "#00E5FF",
    Icon: HelpCircle,
    tag: "Ambiguity is the test.",
    dossier:
      "Delivers deliberately incomplete problem statements. Silently docks points if you start coding before asking a single clarifying question in chat.",
    opener:
      "So, we want something that handles all the... you know, edge cases. Just build it.",
    script: [
      null, // resolved dynamically — see getPersonaCReply
      "Sure, sure — let's just say it varies by use case. Keep going.",
      "Interesting direction. What does 'done' even look like to you?",
      "We'll circle back on this later. Interview concluded.",
    ],
    deltas: [
      { stress: 5, rating: 0 },
      { stress: 6, rating: -1 },
      { stress: 4, rating: 2 },
      { stress: -3, rating: 5 },
    ],
  },
};

const TOPICS = [
  { id: "two-sum", label: "Two Sum — Array / Hashing", difficulty: "Easy" },
  { id: "reverse-ll", label: "Reverse a Linked List", difficulty: "Easy" },
  { id: "lswr", label: "Longest Substring Without Repeats", difficulty: "Medium" },
  { id: "bt-level", label: "Binary Tree Level Order Traversal", difficulty: "Medium" },
  { id: "merge-int", label: "Merge Intervals", difficulty: "Medium" },
  { id: "lru", label: "Design an LRU Cache", difficulty: "Hard" },
];

const STARTERS = {
  "two-sum": "function twoSum(nums, target) {\n  // your solution\n}",
  "reverse-ll": "function reverseList(head) {\n  // your solution\n}",
  lswr: "function lengthOfLongestSubstring(s) {\n  // your solution\n}",
  "bt-level": "function levelOrder(root) {\n  // your solution\n}",
  "merge-int": "function merge(intervals) {\n  // your solution\n}",
  lru: "class LRUCache {\n  constructor(capacity) {\n    // your solution\n  }\n}",
};

/* ------------------------------------------------------------------ */
/*  Heuristics                                                          */
/* ------------------------------------------------------------------ */

const HEDGE_WORDS = ["i think", "maybe", "not sure", "i guess", "probably", "kind of", "sort of", "i believe"];
const CONFIDENT_WORDS = ["because", "since", "therefore", "o(n", "o(1", "o(log", "time complexity", "space complexity", "invariant", "edge case", "trade-off"];

function analyzeText(text) {
  const lower = text.toLowerCase();
  let stress = 0;
  let rating = 0;
  HEDGE_WORDS.forEach((h) => {
    if (lower.includes(h)) {
      stress += 5;
      rating -= 3;
    }
  });
  CONFIDENT_WORDS.forEach((c) => {
    if (lower.includes(c)) {
      stress -= 3;
      rating += 3;
    }
  });
  const trimmed = text.trim();
  if (trimmed.length < 12) {
    stress += 6;
    rating -= 3;
  } else if (trimmed.length > 180) {
    rating += 2;
  }
  return { stress, rating };
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function gradeFor(rating) {
  if (rating >= 85) return { label: "ELITE HIRE", color: "#00E5FF" };
  if (rating >= 70) return { label: "STRONG SIGNAL", color: "#34D399" };
  if (rating >= 50) return { label: "BORDERLINE", color: "#FF9F0A" };
  return { label: "DO NOT PROCEED", color: "#FF3B30" };
}

/* ------------------------------------------------------------------ */
/*  Radial gauge                                                       */
/* ------------------------------------------------------------------ */

function RadialGauge({ value, color, size = 72, icon: Icon }) {
  const pct = clamp(value);
  const bg = `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.08) ${pct * 3.6}deg 360deg)`;
  return (
    <div
      className="relative flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: bg, transition: "background 0.6s ease" }}
    >
      <div
        className="rounded-full flex flex-col items-center justify-center"
        style={{ width: size - 12, height: size - 12, background: "#0a0a0e" }}
      >
        {Icon ? <Icon size={14} style={{ color }} /> : null}
        <span className="text-xs font-bold mt-0.5" style={{ color }}>
          {Math.round(pct)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function TitanAIInterviewer() {
  const [selectedPersona, setSelectedPersona] = useState("A");
  const [topic, setTopic] = useState(TOPICS[0].id);
  const [code, setCode] = useState(STARTERS[TOPICS[0].id]);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(0);
  const [stress, setStress] = useState(18);
  const [rating, setRating] = useState(75);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewOver, setInterviewOver] = useState(false);
  const [hasAskedQuestion, setHasAskedQuestion] = useState(false);
  const [hasSubmittedCode, setHasSubmittedCode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [waitStart, setWaitStart] = useState(null);
  const [lockedNote, setLockedNote] = useState(false);

  const chatEndRef = useRef(null);
  const idRef = useRef(0);
  const nextId = () => (idRef.current += 1);

  const persona = PERSONAS[selectedPersona];

  /* ---------------- timers ---------------- */

  useEffect(() => {
    if (!interviewStarted || interviewOver) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [interviewStarted, interviewOver]);

  useEffect(() => {
    if (!interviewStarted || interviewOver || waitStart == null) return;
    const t = setInterval(() => {
      const waited = (Date.now() - waitStart) / 1000;
      if (waited > 6) {
        setStress((s) => clamp(s + 1));
      }
    }, 3000);
    return () => clearInterval(t);
  }, [interviewStarted, interviewOver, waitStart]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------------- actions ---------------- */

  const pushMessage = useCallback((msg) => {
    setMessages((m) => [...m, { id: nextId(), ...msg }]);
  }, []);

  const handleTopicChange = (id) => {
    setTopic(id);
    setCode(STARTERS[id]);
  };

  const handlePersonaSelect = (id) => {
    if (interviewStarted) {
      setLockedNote(true);
      setTimeout(() => setLockedNote(false), 1800);
      return;
    }
    setSelectedPersona(id);
  };

  const startInterview = () => {
    setInterviewStarted(true);
    setInterviewOver(false);
    setMessages([{ id: nextId(), sender: "ai", text: persona.opener, delta: null }]);
    setStep(0);
    setStress(18);
    setRating(75);
    setHasAskedQuestion(false);
    setHasSubmittedCode(false);
    setElapsed(0);
    setWaitStart(Date.now());
  };

  const resetSimulation = () => {
    setInterviewStarted(false);
    setInterviewOver(false);
    setMessages([]);
    setStep(0);
    setStress(18);
    setRating(75);
    setHasAskedQuestion(false);
    setHasSubmittedCode(false);
    setElapsed(0);
    setWaitStart(null);
    setChatInput("");
  };

  function getPersonaReply(personaId, stepIdx, ctx) {
    const p = PERSONAS[personaId];
    if (personaId === "A") {
      const lineGuess = Math.max(3, Math.min(30, code.split("\n").length - 1 || 12));
      return p.script[stepIdx].replace("{line}", lineGuess);
    }
    if (personaId === "C" && stepIdx === 0) {
      if (ctx.hasAskedQuestion) {
        return "Good question. Let's just say... it depends on the user. Figure out the rest.";
      }
      if (ctx.hasSubmittedCode) {
        return "Oh — you're already coding? Bold, considering you never asked about constraints. Noted, quietly.";
      }
      return "Sure. Keep going, I suppose.";
    }
    return p.script[stepIdx];
  }

  function getPersonaDelta(personaId, stepIdx, ctx) {
    const base = { ...PERSONAS[personaId].deltas[stepIdx] };
    if (personaId === "C" && stepIdx === 0) {
      if (ctx.hasAskedQuestion) {
        base.stress -= 6;
        base.rating += 8;
      } else if (ctx.hasSubmittedCode) {
        base.stress += 15;
        base.rating -= 12;
      }
    }
    return base;
  }

  const handleSubmit = (type) => {
    if (!interviewStarted || interviewOver) return;
    const text = type === "code" ? code : chatInput.trim();
    if (!text) return;

    const askedQuestionNow = type === "explain" && text.includes("?");
    const submittingCodeNow = type === "code";

    pushMessage({
      sender: "user",
      text,
      isCode: type === "code",
      delta: null,
    });

    const ctx = {
      hasAskedQuestion: hasAskedQuestion || askedQuestionNow,
      hasSubmittedCode: hasSubmittedCode || submittingCodeNow,
    };
    if (askedQuestionNow) setHasAskedQuestion(true);
    if (submittingCodeNow) setHasSubmittedCode(true);

    const analysis = analyzeText(text);
    const pDelta = getPersonaDelta(selectedPersona, step, ctx);
    const totalStressDelta = analysis.stress + pDelta.stress;
    const totalRatingDelta = analysis.rating + pDelta.rating;

    const nextStress = clamp(stress + totalStressDelta);
    const nextRating = clamp(rating + totalRatingDelta);
    setStress(nextStress);
    setRating(nextRating);

    const replyText = getPersonaReply(selectedPersona, step, ctx);

    pushMessage({
      sender: "ai",
      text: replyText,
      delta: { stress: totalStressDelta, rating: totalRatingDelta },
    });

    const nextStep = step + 1;
    setStep(nextStep);
    setWaitStart(Date.now());
    if (type === "explain") setChatInput("");

    if (nextStep >= persona.script.length) {
      setInterviewOver(true);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit("explain");
    }
  };

  const handleCodeKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit("code");
    }
  };

  const messagesExchanged = messages.filter((m) => m.sender === "user").length;
  const grade = gradeFor(rating);
  const stressColor = stress > 70 ? "#FF3B30" : stress > 40 ? "#FF9F0A" : "#00E5FF";

  /* ---------------- render ---------------- */

  return (
    <div
      className="w-full min-h-screen relative overflow-hidden text-white"
      style={{ background: "#030305", fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
    >
      <style>{`
        @keyframes blobMoveA {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(60px, 40px) scale(1.18); }
        }
        @keyframes blobMoveB {
          0%, 100% { transform: translate(0px, 0px) scale(1.1); }
          50% { transform: translate(-50px, -35px) scale(0.95); }
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .blob-anim { animation: none !important; }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 9999px; }
        .glass {
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.09);
        }
      `}</style>

      {/* ambient blooms */}
      <div
        className="absolute blob-anim rounded-full pointer-events-none"
        style={{
          top: "-12%",
          left: "-8%",
          width: 620,
          height: 620,
          background: "radial-gradient(circle, rgba(255,59,48,0.38), transparent 70%)",
          filter: "blur(95px)",
          animation: "blobMoveA 19s ease-in-out infinite",
        }}
      />
      <div
        className="absolute blob-anim rounded-full pointer-events-none"
        style={{
          bottom: "-16%",
          right: "-10%",
          width: 700,
          height: 700,
          background: "radial-gradient(circle, rgba(0,229,255,0.3), transparent 70%)",
          filter: "blur(105px)",
          animation: "blobMoveB 23s ease-in-out infinite",
        }}
      />

      <div className="relative z-10 flex min-h-screen p-3 md:p-4 gap-4">
        {/* ---------------- Sidebar ---------------- */}
        <aside className="hidden lg:flex flex-col w-56 glass backdrop-blur-xl rounded-3xl p-5 flex-shrink-0">
          <div className="flex items-center gap-2 mb-8 px-1">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #FF3B30, #00E5FF)" }}
            >
              <Terminal size={16} className="text-black" />
            </div>
            <span className="font-bold tracking-tight text-sm">TITAN AI</span>
          </div>

          <nav className="flex flex-col gap-1 text-sm">
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: "linear-gradient(90deg, rgba(255,59,48,0.25), rgba(0,229,255,0.15))" }}
            >
              <Brain size={16} />
              <span>Interrogation</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white/80 cursor-default">
              <History size={16} />
              <span>Session Log</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white/80 cursor-default">
              <Users size={16} />
              <span>Persona Lab</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 hover:text-white/80 cursor-default">
              <BarChart3 size={16} />
              <span>Reports</span>
            </div>
          </nav>

          <div className="mt-auto flex flex-col gap-1 text-sm">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40">
              <Settings size={16} />
              <span>Settings</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40">
              <LifeBuoy size={16} />
              <span>Support</span>
            </div>
          </div>
        </aside>

        {/* ---------------- Main ---------------- */}
        <main className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 min-w-0">
          {/* header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                Interrogation Session
                <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "#00E5FF" }}>
                  STRESS &amp; VIBE CHECK
                </span>
              </h1>
              <p className="text-sm text-white/45 mt-1">
                Persona: <span style={{ color: persona.color }}>{persona.name}</span> — {persona.tag}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={resetSimulation}
                className="w-10 h-10 rounded-full glass backdrop-blur-xl flex items-center justify-center hover:bg-white/10 transition-colors"
                title="Reset simulation"
              >
                <RotateCcw size={16} />
              </button>
              <button className="w-10 h-10 rounded-full glass backdrop-blur-xl flex items-center justify-center hover:bg-white/10 transition-colors">
                <Bell size={16} />
              </button>
              <div className="flex items-center gap-2 glass backdrop-blur-xl rounded-full pl-2 pr-4 py-1.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${persona.color}, #00E5FF)` }}
                >
                  <persona.Icon size={15} className="text-black" />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-semibold">TITAN-7 Core</div>
                  <div className="text-[10px] text-white/40">
                    {interviewStarted ? (interviewOver ? "session ended" : "live") : "standby"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* persona selector pills */}
          <div className="flex flex-wrap items-center gap-2 relative">
            {Object.values(PERSONAS).map((p) => {
              const active = selectedPersona === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handlePersonaSelect(p.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all"
                  style={{
                    background: active ? `linear-gradient(90deg, ${p.color}33, rgba(255,255,255,0.08))` : "rgba(255,255,255,0.04)",
                    border: active ? `1px solid ${p.color}88` : "1px solid rgba(255,255,255,0.08)",
                    color: active ? "#fff" : "rgba(255,255,255,0.55)",
                  }}
                >
                  <p.Icon size={14} style={{ color: active ? p.color : "inherit" }} />
                  {p.short}
                  {interviewStarted && active && <Lock size={11} className="ml-1 text-white/40" />}
                </button>
              );
            })}
            {lockedNote && (
              <span className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(255,59,48,0.15)", color: "#FF3B30" }}>
                Persona locked for this session — reset to change.
              </span>
            )}
          </div>

          {/* command bar */}
          <div className="flex items-center gap-3 glass backdrop-blur-xl rounded-2xl px-4 py-3">
            <Search size={16} className="text-white/40 flex-shrink-0" />
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              disabled={!interviewStarted || interviewOver}
              placeholder={interviewStarted ? "Query the Interviewer Core — explain your approach..." : "Start the interview to begin querying Titan..."}
              className="flex-1 bg-transparent outline-none text-sm placeholder-white/30 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => handleSubmit("explain")}
              disabled={!interviewStarted || interviewOver || !chatInput.trim()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full disabled:opacity-30 transition-opacity"
              style={{ background: "rgba(0,229,255,0.15)", color: "#00E5FF" }}
            >
              <Mic size={12} /> Speak
            </button>
          </div>

          {/* stat grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* col 1: session brief + dossier */}
            <div className="flex flex-col gap-4">
              <div className="glass backdrop-blur-xl rounded-3xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/50">Case File</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    {TOPICS.find((t) => t.id === topic)?.difficulty}
                  </span>
                </div>
                <div className="relative mb-4">
                  <select
                    value={topic}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    disabled={interviewStarted}
                    className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {TOPICS.map((t) => (
                      <option key={t.id} value={t.id} style={{ background: "#0a0a0e" }}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" />
                </div>
                {!interviewStarted ? (
                  <button
                    onClick={startInterview}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
                    style={{ background: `linear-gradient(90deg, ${persona.color}, #00E5FF)` }}
                  >
                    <Play size={14} fill="black" /> Start Interview
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-white/40 border border-white/10">
                    <Radio size={13} className={interviewOver ? "" : "animate-pulse"} style={{ color: interviewOver ? "#666" : "#00E5FF" }} />
                    {interviewOver ? "Session ended" : "In progress"}
                  </div>
                )}
              </div>

              <div className="glass backdrop-blur-xl rounded-3xl p-5 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <persona.Icon size={16} style={{ color: persona.color }} />
                  <span className="text-sm font-semibold">Persona Dossier</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{persona.dossier}</p>
                <div className="mt-4 flex items-center gap-1.5 text-xs" style={{ color: persona.color }}>
                  <Sparkles size={12} /> Behavior pattern active
                </div>
              </div>
            </div>

            {/* col 2: code workspace */}
            <div className="glass backdrop-blur-xl rounded-3xl p-5 flex flex-col md:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Code2 size={15} className="text-white/50" />
                  <span className="text-sm font-semibold">The Code Workspace</span>
                </div>
                <span className="text-[10px] text-white/30">⌘/Ctrl + Enter to submit</span>
              </div>
              <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/10 bg-black/50">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={handleCodeKeyDown}
                  spellCheck={false}
                  className="w-full h-full min-h-[220px] bg-transparent outline-none text-xs p-4 leading-relaxed resize-none"
                  style={{ color: "#c8f7ff" }}
                />
              </div>
              <button
                onClick={() => handleSubmit("code")}
                disabled={!interviewStarted || interviewOver}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30 transition-opacity"
                style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${persona.color}55` }}
              >
                <Send size={13} /> Submit Code to Interviewer
              </button>
            </div>

            {/* col 3: telemetry */}
            <div className="grid grid-cols-2 gap-4 content-start">
              <div className="glass backdrop-blur-xl rounded-2xl p-4 flex flex-col items-center gap-2 col-span-1">
                <span className="text-[10px] text-white/40 uppercase tracking-wide self-start">Vibe Index</span>
                <RadialGauge value={stress} color={stressColor} icon={stress > 70 ? AlertTriangle : Activity} />
                <span className="text-[10px]" style={{ color: stressColor }}>
                  {stress > 70 ? "Critical" : stress > 40 ? "Elevated" : "Composed"}
                </span>
              </div>
              <div className="glass backdrop-blur-xl rounded-2xl p-4 flex flex-col items-center gap-2 col-span-1">
                <span className="text-[10px] text-white/40 uppercase tracking-wide self-start">Rating</span>
                <RadialGauge value={rating} color="#00E5FF" icon={ShieldAlert} />
                <span className="text-[10px] text-white/40">{Math.round(rating)} / 100</span>
              </div>
              <div className="glass backdrop-blur-xl rounded-2xl p-4 flex items-center gap-3 col-span-2">
                <Clock size={16} className="text-white/40" />
                <div>
                  <div className="text-sm font-semibold">{formatClock(elapsed)}</div>
                  <div className="text-[10px] text-white/40">Time elapsed</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <MessageSquare size={16} className="text-white/40" />
                  <div>
                    <div className="text-sm font-semibold">{messagesExchanged}</div>
                    <div className="text-[10px] text-white/40">Exchanges</div>
                  </div>
                </div>
              </div>
              {interviewOver && (
                <div
                  className="col-span-2 rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: `${grade.color}1A`, border: `1px solid ${grade.color}55` }}
                >
                  {rating >= 70 ? <CheckCircle2 size={18} style={{ color: grade.color }} /> : <XCircle size={18} style={{ color: grade.color }} />}
                  <div>
                    <div className="text-sm font-bold" style={{ color: grade.color }}>{grade.label}</div>
                    <div className="text-[10px] text-white/40">Final verdict from {persona.short}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ---------------- Interrogation Matrix ---------------- */}
          <div className="glass backdrop-blur-xl rounded-3xl p-5 flex-1 flex flex-col min-h-[380px]">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Terminal size={16} style={{ color: persona.color }} />
                <span className="text-sm font-semibold">The Interrogation Matrix</span>
              </div>
              <div className="flex items-center gap-1.5">
                {["Intro", "Probe", "Pressure", "Verdict"].map((phase, i) => (
                  <span
                    key={phase}
                    className="text-[10px] px-2.5 py-1 rounded-full"
                    style={{
                      background: step >= i ? `${persona.color}2A` : "rgba(255,255,255,0.05)",
                      color: step >= i ? persona.color : "rgba(255,255,255,0.3)",
                      border: `1px solid ${step >= i ? persona.color + "55" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {phase}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-white/30 text-sm gap-2 py-10">
                  <Bot size={28} />
                  Select a persona and start the interview to begin the transcript.
                </div>
              )}
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                return (
                  <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"} relative`}>
                    <div className={`flex items-start gap-2 max-w-[80%] ${m.sender === "user" ? "flex-row-reverse" : ""}`}>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: m.sender === "ai" ? `${persona.color}2A` : "rgba(255,255,255,0.08)",
                        }}
                      >
                        {m.sender === "ai" ? <persona.Icon size={13} style={{ color: persona.color }} /> : <User size={13} />}
                      </div>
                      <div>
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${m.isCode ? "font-mono whitespace-pre-wrap" : ""}`}
                          style={{
                            background: m.sender === "ai" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)",
                            border: m.sender === "ai" ? `1px solid ${persona.color}33` : "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          {m.text}
                        </div>
                        {m.delta && isLast && (
                          <div className="flex items-center gap-2 mt-1.5 ml-1 text-[10px] text-white/40">
                            {m.delta.stress > 0 ? (
                              <span className="flex items-center gap-0.5" style={{ color: "#FF3B30" }}><TrendingUp size={10} /> stress +{Math.round(m.delta.stress)}</span>
                            ) : m.delta.stress < 0 ? (
                              <span className="flex items-center gap-0.5" style={{ color: "#00E5FF" }}><TrendingDown size={10} /> stress {Math.round(m.delta.stress)}</span>
                            ) : (
                              <span className="flex items-center gap-0.5"><Minus size={10} /> stress ±0</span>
                            )}
                            <span className="opacity-30">/</span>
                            {m.delta.rating >= 0 ? (
                              <span style={{ color: "#34D399" }}>rating +{Math.round(m.delta.rating)}</span>
                            ) : (
                              <span style={{ color: "#FF9F0A" }}>rating {Math.round(m.delta.rating)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                disabled={!interviewStarted || interviewOver}
                placeholder={
                  interviewOver
                    ? "Session ended — reset to start a new interview."
                    : interviewStarted
                    ? "Explain your reasoning, or ask a clarifying question..."
                    : "Start the interview to unlock the chat."
                }
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none placeholder-white/25 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                onClick={() => handleSubmit("explain")}
                disabled={!interviewStarted || interviewOver || !chatInput.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-black disabled:opacity-30 transition-opacity flex-shrink-0"
                style={{ background: `linear-gradient(90deg, ${persona.color}, #00E5FF)` }}
              >
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
