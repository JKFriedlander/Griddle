const { useState, useEffect, useCallback, useRef } = React;

// ─── MATHS ─────────────────────────────────────────────────────────────────

function perms(arr) {
  if (arr.length <= 1) return [[...arr]];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.filter((_, j) => j !== i);
    for (const p of perms(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

function applyBonus(run, bonus) {
  if (!bonus)              return { after: run + 1, expr: `${run} + 1`,                   type: "normal" };
  if (bonus.op === "+")   return { after: run + 1 + bonus.val, expr: `${run} + 1 + ${bonus.val}`, type: "flat" };
  return { after: (run + 1) * bonus.val, expr: `(${run} + 1) × ${bonus.val}`,           type: "mult" };
}

function computeRun(order) {
  let run = 0;
  const steps = order.map(box => {
    const prev = run;
    const { after, expr, type } = applyBonus(run, box.bonus);
    run = after;
    return { box, prev, after: run, expr, type };
  });
  return { run, steps };
}

function trapScore(trapBox) {
  if (!trapBox.bonus) return 1;
  if (trapBox.bonus.op === "+") return 1 + trapBox.bonus.val;
  return trapBox.bonus.val; // (0+1)*val
}

function analyzeAll(puzzle) {
  const { freeBoxes, trapBox, youCommitted, cpuCommitted } = puzzle;
  const cpuRun   = trapScore(trapBox);
  const cpuFinal = cpuCommitted + cpuRun;
  return perms(freeBoxes)
    .map(order => {
      const { run, steps } = computeRun(order);
      const youFinal = youCommitted + run;
      const outcome  = youFinal > cpuFinal ? "WIN" : youFinal < cpuFinal ? "LOSE" : "TIE";
      return { order, steps, run, youFinal, cpuFinal, outcome };
    })
    .sort((a, b) => b.run - a.run);
}

// ─── BONUS DISPLAY ─────────────────────────────────────────────────────────

function bonusLabel(bonus) {
  if (!bonus) return "normal";
  if (bonus.op === "+") return `+${bonus.val}`;
  return `×${bonus.val}`;
}
function bonusColor(bonus) {
  if (!bonus) return "#a8cdd8";
  if (bonus.op === "+") return "#22aadd";
  return "#e09000";
}

// ─── GTO EXPLANATION (algorithmic) ─────────────────────────────────────────

function buildExplanation(puzzle, analysis) {
  const { freeBoxes, trapBox } = puzzle;
  const optimal = analysis[0];
  const worst   = analysis[analysis.length - 1];
  const mults   = freeBoxes.filter(b => b.bonus?.op === "*");
  const flats   = freeBoxes.filter(b => b.bonus?.op === "+");
  const norms   = freeBoxes.filter(b => !b.bonus);
  const winners = analysis.filter(a => a.outcome === "WIN");
  const losers  = analysis.filter(a => a.outcome === "LOSE");

  const blocks = [];

  blocks.push({
    kind: "summary",
    icon: "◈",
    title: "Puzzle Overview",
    body:
      `${winners.length} of ${analysis.length} orderings WIN. ` +
      `Optimal run: ${optimal.run} pts → YOU ${optimal.youFinal} vs CPU ${optimal.cpuFinal}. ` +
      `Worst run: ${worst.run} pts → YOU ${worst.youFinal}. ` +
      `Margin between best and worst: ${optimal.run - worst.run} pts.`,
  });

  if (mults.length > 0 && (flats.length + norms.length) > 0) {
    const prereq = [...flats, ...norms]
      .map(b => b.id + " (" + bonusLabel(b.bonus) + ")")
      .join(", ");
    const multNames = mults
      .map(b => `${b.id} (×${b.bonus.val})`)
      .join(", ");
    blocks.push({
      kind: "rule",
      icon: "①",
      title: "Rule: Capture flat/normal boxes BEFORE multipliers",
      body:
        `Multiplier ${multNames} computes new_run = (current_run + 1) × n. ` +
        `The larger current_run is at that moment, the more powerful the multiplication. ` +
        `Boxes ${prereq} are order-independent among themselves — capture them in any order, ` +
        `but ALL must precede any ×n box. ` +
        `Violating this is the single most common mistake.`,
    });
  }

  if (mults.length > 1) {
    const asc  = [...mults].sort((a, b) => a.bonus.val - b.bonus.val);
    const desc = [...mults].sort((a, b) => b.bonus.val - a.bonus.val);
    const baseBeforeMults =
      flats.reduce((s, b) => s + 1 + b.bonus.val, 0) + norms.length;

    let rAsc = baseBeforeMults, rDesc = baseBeforeMults;
    for (const m of asc)  rAsc  = (rAsc  + 1) * m.bonus.val;
    for (const m of desc) rDesc = (rDesc + 1) * m.bonus.val;

    blocks.push({
      kind: "rule",
      icon: "②",
      title: "Rule: Apply multipliers in ASCENDING order (smallest ×n first)",
      body:
        `With multipliers [${mults.map(b => `×${b.bonus.val}`).join(", ")}], ` +
        `ascending order (${asc.map(b => `×${b.bonus.val}`).join(" → ")}) ` +
        `gives run ${rAsc}, vs descending (${desc.map(b => `×${b.bonus.val}`).join(" → ")}) ` +
        `giving run ${rDesc}. ` +
        `Proof: for m₁ < m₂, applying m₁ first yields …×m₁×m₂ + m₂ extra, ` +
        `while m₂ first yields …×m₁×m₂ + m₁ extra. ` +
        `Since m₂ > m₁, ascending order always wins by exactly m₂ − m₁.`,
    });
  }

  if (mults.length === 0) {
    blocks.push({
      kind: "rule",
      icon: "①",
      title: "Order Invariance — no multipliers present",
      body:
        `All ${freeBoxes.length} free boxes use flat/normal bonuses. ` +
        `Since addition is commutative (a + b = b + a), ALL ${analysis.length} orderings ` +
        `yield IDENTICAL run scores (${optimal.run} pts). ` +
        `The puzzle difficulty here comes entirely from the trap box timing, ` +
        `not the capture sequence.`,
    });
  }

  const trapRun = trapScore(trapBox);
  blocks.push({
    kind: "trap",
    icon: "⚠",
    title: `Trap Box ${trapBox.id} — CPU claims ${trapRun} pts`,
    body:
      `After you exhaust all free boxes you MUST draw one of ${trapBox.id}'s remaining edges ` +
      `(no other null edges exist). Your run then commits, and CPU captures ${trapBox.id} ` +
      `(${bonusLabel(trapBox.bonus)}) on their turn. ` +
      `CPU starts a fresh run of 0, so they score ${trapRun} pts. ` +
      `CPU final = ${puzzle.cpuCommitted} + ${trapRun} = ${puzzle.cpuCommitted + trapRun}. ` +
      `Your optimal run must exceed that gap.`,
  });

  const optOrder = optimal.order.map(b => `${b.id}(${bonusLabel(b.bonus)})`).join(" → ");
  blocks.push({
    kind: "conclusion",
    icon: "◉",
    title: "GTO Verdict",
    body:
      `Optimal sequence: ${optOrder}. ` +
      `Run = ${optimal.run} → YOU finish at ${optimal.youFinal}. ` +
      (losers.length > 0
        ? `${losers.length} ordering(s) lose outright (run ≤ ${worst.run}). `
        : `All suboptimal orderings at least tie. `) +
      `Remember: flats first, then multipliers in ascending ×n order.`,
  });

  return blocks;
}

// ─── PRESETS ───────────────────────────────────────────────────────────────

const PRESETS = [
  {
    id: "p1",
    title: "The Multiplier Trap",
    difficulty: "BEGINNER",
    lesson: "Save the ×3 for last — apply the multiplier to a large base.",
    freeBoxes: [
      { id: "A", bonus: { op: "*", val: 3 } },
      { id: "B", bonus: { op: "+", val: 2 } },
      { id: "C", bonus: null },
    ],
    trapBox:      { id: "D", bonus: { op: "*", val: 3 } },
    youCommitted: 7,
    cpuCommitted: 14,
  },
  {
    id: "p2",
    title: "Double Multiplier",
    difficulty: "INTERMEDIATE",
    lesson: "Two ×n boxes — smaller multiplier first always wins.",
    freeBoxes: [
      { id: "A", bonus: { op: "*", val: 2 } },
      { id: "B", bonus: { op: "*", val: 3 } },
      { id: "C", bonus: null },
    ],
    trapBox:      { id: "D", bonus: { op: "+", val: 2 } },
    youCommitted: 4,
    cpuCommitted: 8,
  },
  {
    id: "p3",
    title: "Flat First",
    difficulty: "BEGINNER",
    lesson: "Two flat bonuses then one multiplier — order of flats doesn't matter.",
    freeBoxes: [
      { id: "A", bonus: { op: "+", val: 3 } },
      { id: "B", bonus: { op: "+", val: 1 } },
      { id: "C", bonus: { op: "*", val: 2 } },
    ],
    trapBox:      { id: "D", bonus: { op: "+", val: 1 } },
    youCommitted: 4,
    cpuCommitted: 8,
  },
  {
    id: "p4",
    title: "The Chain Reaction",
    difficulty: "ADVANCED",
    lesson: "Four boxes — flat bonuses first, then ascending ×n order.",
    freeBoxes: [
      { id: "A", bonus: { op: "*", val: 3 } },
      { id: "B", bonus: { op: "*", val: 2 } },
      { id: "C", bonus: { op: "+", val: 2 } },
      { id: "D", bonus: { op: "+", val: 1 } },
    ],
    trapBox:      { id: "E", bonus: { op: "*", val: 2 } },
    youCommitted: 8,
    cpuCommitted: 20,
  },
  {
    id: "p5",
    title: "Order Invariance",
    difficulty: "CONCEPT",
    lesson: "No multipliers → all orderings equivalent. GTO is about timing, not sequence.",
    freeBoxes: [
      { id: "A", bonus: { op: "+", val: 3 } },
      { id: "B", bonus: { op: "+", val: 2 } },
      { id: "C", bonus: { op: "+", val: 1 } },
    ],
    trapBox:      { id: "D", bonus: { op: "*", val: 3 } },
    youCommitted: 3,
    cpuCommitted: 8,
  },
  {
    id: "p6",
    title: "The Narrow Win",
    difficulty: "EXPERT",
    lesson: "Only ONE ordering wins. Every wrong move loses by exactly 1.",
    freeBoxes: [
      { id: "A", bonus: { op: "*", val: 3 } },
      { id: "B", bonus: { op: "*", val: 2 } },
      { id: "C", bonus: { op: "+", val: 1 } },
    ],
    trapBox:      { id: "D", bonus: { op: "*", val: 3 } },
    youCommitted: 5,
    cpuCommitted: 13,
  },
];

// ─── RANDOM GENERATOR ──────────────────────────────────────────────────────

function generateRandom() {
  const palette = [
    null, null,
    { op: "+", val: 1 }, { op: "+", val: 2 }, { op: "+", val: 3 },
    { op: "*", val: 2 }, { op: "*", val: 3 },
  ];
  const numFree = 3 + Math.floor(Math.random() * 2);
  let freeBoxes, result;
  let tries = 0;

  do {
    freeBoxes = Array.from({ length: numFree }, (_, i) => ({
      id: String.fromCharCode(65 + i),
      bonus: palette[Math.floor(Math.random() * palette.length)],
    }));
    if (!freeBoxes.some(b => b.bonus?.op === "*"))
      freeBoxes[0].bonus = { op: "*", val: 2 + Math.floor(Math.random() * 2) };
    if (!freeBoxes.some(b => !b.bonus || b.bonus.op === "+"))
      freeBoxes[freeBoxes.length - 1].bonus = null;

    const trap = { id: String.fromCharCode(65 + numFree), bonus: { op: "*", val: 2 + Math.floor(Math.random() * 2) } };
    result = analyzeAll({ freeBoxes, trapBox: trap, youCommitted: 0, cpuCommitted: 0 });
    tries++;
  } while (result[0].run === result[result.length - 1].run && tries < 30);

  const trap       = { id: String.fromCharCode(65 + numFree), bonus: { op: "*", val: 2 + Math.floor(Math.random() * 2) } };
  const best       = result[0].run;
  const worst      = result[result.length - 1].run;
  const cpuR       = trapScore(trap);
  const midTarget  = worst + Math.ceil((best - worst) * 0.4) + 1;
  const cpuCommitted = Math.max(0, midTarget - cpuR);
  const youCommitted = Math.max(0, Math.floor(cpuCommitted * 0.55));

  return {
    id: "rand_" + Date.now(),
    title: "Random Puzzle",
    difficulty: numFree === 4 ? "ADVANCED" : "INTERMEDIATE",
    lesson: "Find the game-theory optimal sequence.",
    freeBoxes,
    trapBox: trap,
    youCommitted,
    cpuCommitted,
  };
}

// ─── STYLES ────────────────────────────────────────────────────────────────

const S = {
  page:       { minHeight: "100vh", background: "#07090f", color: "#a8cdd8", fontFamily: "'Share Tech Mono', monospace", padding: "0 0 60px" },
  header:     { background: "#0b1220", borderBottom: "1px solid #1d3a52", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  titleWrap:  { display: "flex", flexDirection: "column" },
  title:      { fontFamily: "'Orbitron', sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: "0.35em", color: "#00d4f0", textShadow: "0 0 20px rgba(0,212,240,0.4)", margin: 0 },
  sub:        { fontSize: 9, letterSpacing: "0.2em", color: "#28606e", marginTop: 3 },
  body:       { maxWidth: 1100, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 28 },
  row:        { display: "flex", gap: 20, flexWrap: "wrap" },
  card:       { background: "#0b1220", border: "1px solid #1d3a52", borderRadius: 6, padding: "20px 22px", flex: 1, minWidth: 260 },
  cardTitle:  { fontSize: 9, letterSpacing: "0.2em", color: "#28606e", marginBottom: 14, textTransform: "uppercase" },
  badge:      (col) => ({ display: "inline-block", fontSize: 9, letterSpacing: "0.15em", padding: "2px 10px", borderRadius: 3, border: `1px solid ${col}`, color: col }),
  box:        (col) => ({ border: `1px solid ${col}`, borderRadius: 6, padding: "10px 14px", background: col + "14", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 70, cursor: "default", transition: "transform 0.15s" }),
  boxId:      { fontFamily: "'Orbitron', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: "0.1em" },
  boxBonus:   { fontSize: 11, letterSpacing: "0.1em" },
  boxKind:    { fontSize: 8, letterSpacing: "0.15em", opacity: 0.6 },
  btn:        (active, col = "#00d4f0") => ({ background: active ? col + "18" : "transparent", border: `1px solid ${active ? col : "#1d3a52"}`, borderRadius: 3, color: active ? col : "#28606e", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: "0.12em", padding: "5px 14px", cursor: "pointer", transition: "all 0.15s" }),
  stepBox:    { background: "#0f1c2a", border: "1px solid #1d3a52", borderRadius: 4, padding: "10px 14px", marginBottom: 8 },
  pill:       (col) => ({ background: col + "20", border: `1px solid ${col}`, borderRadius: 12, padding: "2px 10px", fontSize: 10, color: col }),
  outcomeColor: { WIN: "#00bb78", TIE: "#ffd700", LOSE: "#e83020" },
};

const DIFF_COLOR = { BEGINNER: "#00bb78", INTERMEDIATE: "#ffd700", ADVANCED: "#e09000", EXPERT: "#e83020", CONCEPT: "#22aadd" };

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function BoxCard({ box, highlight, dim, size = "md" }) {
  const col = bonusColor(box.bonus);
  const fSize = size === "sm" ? 14 : 20;
  return (
    <div style={{ ...S.box(col), opacity: dim ? 0.35 : 1, transform: highlight ? "scale(1.08)" : "scale(1)", filter: highlight ? `drop-shadow(0 0 8px ${col})` : "none" }}>
      <div style={{ ...S.boxId, fontSize: fSize, color: col }}>{box.id}</div>
      <div style={{ ...S.boxBonus, color: col }}>{bonusLabel(box.bonus)}</div>
      <div style={{ ...S.boxKind }}>{!box.bonus ? "normal" : box.bonus.op === "+" ? "flat" : "mult"}</div>
    </div>
  );
}

function OutcomeBadge({ outcome }) {
  const col = S.outcomeColor[outcome] || "#a8cdd8";
  return <span style={S.pill(col)}>{outcome}</span>;
}

function ScoreRow({ label, committed, run, final, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "6px 0", borderBottom: "1px solid #1d3a5222" }}>
      <span style={{ color, minWidth: 50, fontWeight: "bold" }}>{label}</span>
      <span style={{ color: "#28606e" }}>{committed}</span>
      <span style={{ color: "#28606e" }}>+</span>
      <span style={{ color: run > 0 ? "#ffd700" : "#28606e" }}>{run}</span>
      <span style={{ color: "#28606e" }}>=</span>
      <span style={{ color, fontSize: 16, fontWeight: "bold", marginLeft: 4 }}>{final}</span>
    </div>
  );
}

// ─── API THEORY PANEL ─────────────────────────────────────────────────────

function TheoryPanel({ puzzle, analysis }) {
  const [text, setText]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [done, setDone]       = useState(false);

  const fetchTheory = useCallback(async () => {
    setLoading(true); setText(""); setError(null); setDone(false);
    const optimal = analysis[0];
    const worst   = analysis[analysis.length - 1];
    const prompt  = [
      "You are a game theory teacher explaining a Dots & Boxes scoring puzzle.",
      "",
      "SCORING RULES:",
      "  Normal box: run += 1",
      "  Flat +n:    run = run + 1 + n   (base first, then add bonus)",
      "  Multi ×n:   run = (run + 1) × n  (base first, then multiply entire run)",
      "A run starts at 0 each turn and commits when you fail to capture a box.",
      "",
      "PUZZLE:",
      `  Your committed score: ${puzzle.youCommitted}`,
      `  CPU committed score:  ${puzzle.cpuCommitted}`,
      `  Free boxes you can capture: ${puzzle.freeBoxes.map(b => `${b.id}(${bonusLabel(b.bonus)})`).join(", ")}`,
      `  Trap box (CPU claims after you open it): ${puzzle.trapBox.id}(${bonusLabel(puzzle.trapBox.bonus)}) → CPU gains ${trapScore(puzzle.trapBox)} pts`,
      "",
      `  Optimal order: ${optimal.order.map(b => `${b.id}(${bonusLabel(b.bonus)})`).join(" → ")} → run ${optimal.run} → YOU ${optimal.youFinal} vs CPU ${optimal.cpuFinal} → ${optimal.outcome}`,
      `  Worst order:   ${worst.order.map(b => `${b.id}(${bonusLabel(b.bonus)})`).join(" → ")} → run ${worst.run} → YOU ${worst.youFinal} → ${worst.outcome}`,
      "",
      "Write a concise game theory lesson (4-5 short paragraphs) covering:",
      "1. What GTO principle is demonstrated by this puzzle",
      "2. The mathematical reason the optimal order wins (show the arithmetic)",
      "3. Why wrong orders fail (concrete example of a losing order)",
      "4. The general rule the player should memorise",
      "",
      "Use plain language. Show key formulas inline like: run = (5 + 1) × 3 = 18. No markdown headers.",
    ].join("\n");

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          stream: true,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "content_block_delta" && evt.delta?.text)
              setText(t => t + evt.delta.text);
          } catch {}
        }
      }
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [puzzle, analysis]);

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>◈ AI-POWERED GTO EXPLANATION</div>
      {!text && !loading && !error && (
        <div style={{ textAlign: "center", paddingTop: 20 }}>
          <div style={{ fontSize: 11, color: "#28606e", marginBottom: 16 }}>
            Get a deep explanation of why this puzzle has a unique GTO solution.
          </div>
          <button style={{ ...S.btn(false, "#00d4f0"), padding: "8px 24px", fontSize: 11 }} onClick={fetchTheory}>
            EXPLAIN THIS PUZZLE
          </button>
        </div>
      )}
      {loading && !text && (
        <div style={{ color: "#28606e", fontSize: 10, letterSpacing: "0.1em" }}>GENERATING EXPLANATION...</div>
      )}
      {(text || error) && (
        <div style={{ fontSize: 12, lineHeight: 1.8, color: "#a8cdd8", whiteSpace: "pre-wrap" }}>
          {error ? <span style={{ color: "#e83020" }}>Error: {error}</span> : text}
          {loading && <span style={{ color: "#00d4f0", animation: "pulse 1s infinite" }}>▌</span>}
        </div>
      )}
      {done && (
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button style={S.btn(false)} onClick={() => { setText(""); setDone(false); setError(null); }}>
            CLEAR
          </button>
          <button style={S.btn(false, "#00d4f0")} onClick={fetchTheory}>
            REGENERATE
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────

function App() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [puzzle, setPuzzle]       = useState(PRESETS[0]);
  const [analysis, setAnalysis]   = useState(() => analyzeAll(PRESETS[0]));
  const [tab, setTab]             = useState("analysis"); // analysis | solution | theory
  const [selOrdering, setSelOrdering] = useState(0);
  const [animStep, setAnimStep]   = useState(-1);
  const [autoPlay, setAutoPlay]   = useState(false);
  const timerRef = useRef(null);

  const explanation = buildExplanation(puzzle, analysis);

  useEffect(() => {
    const a = analyzeAll(puzzle);
    setAnalysis(a);
    setSelOrdering(0);
    setAnimStep(-1);
    setAutoPlay(false);
  }, [puzzle]);

  // Auto-play animation
  useEffect(() => {
    if (!autoPlay) { clearTimeout(timerRef.current); return; }
    const maxStep = analysis[selOrdering]?.steps.length ?? 0;
    if (animStep >= maxStep - 1) { setAutoPlay(false); return; }
    timerRef.current = setTimeout(() => setAnimStep(s => s + 1), 900);
    return () => clearTimeout(timerRef.current);
  }, [autoPlay, animStep, selOrdering, analysis]);

  function loadPreset(idx) {
    setPresetIdx(idx);
    setPuzzle(PRESETS[idx]);
    setTab("analysis");
  }
  function loadRandom() {
    const p = generateRandom();
    setPuzzle(p);
    setPresetIdx(-1);
    setTab("analysis");
  }

  const optimal  = analysis[0];
  const cpuFinal = optimal?.cpuFinal ?? 0;
  const cpuRun   = trapScore(puzzle.trapBox);

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #07090f; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0b1220; }
        ::-webkit-scrollbar-thumb { background: #1d3a52; border-radius: 3px; }
      `}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.titleWrap}>
          <h1 style={S.title}>GRID — PUZZLE ANALYZER</h1>
          <div style={S.sub}>GAME-THEORY OPTIMAL PUZZLE TOOL · SCORING: flat first · ascending ×n · multiplier last</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((p, i) => (
            <button key={p.id} style={S.btn(presetIdx === i)} onClick={() => loadPreset(i)}>
              {i + 1}
            </button>
          ))}
          <button style={S.btn(presetIdx === -1, "#ffd700")} onClick={loadRandom}>
            RANDOM
          </button>
        </div>
      </div>

      <div style={S.body}>

        {/* ── Puzzle header ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: "0.2em", color: "#00d4f0", margin: 0 }}>
              {puzzle.title}
            </h2>
            <span style={S.badge(DIFF_COLOR[puzzle.difficulty] ?? "#a8cdd8")}>{puzzle.difficulty}</span>
          </div>
          <div style={{ fontSize: 11, color: "#28606e", letterSpacing: "0.08em" }}>
            LESSON: {puzzle.lesson}
          </div>
        </div>

        {/* ── Top row: Board + Scores ── */}
        <div style={S.row}>

          {/* Board */}
          <div style={S.card}>
            <div style={S.cardTitle}>FREE BOXES (you can capture these)</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              {puzzle.freeBoxes.map(b => <BoxCard key={b.id} box={b} />)}
            </div>
            <div style={S.cardTitle}>TRAP BOX (CPU claims after you open it)</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <BoxCard box={puzzle.trapBox} />
              <div style={{ alignSelf: "center", fontSize: 10, color: "#28606e", letterSpacing: "0.08em" }}>
                CPU gains {cpuRun} pts from this box.<br />
                You MUST open it (no other moves left).
              </div>
            </div>
          </div>

          {/* Scores */}
          <div style={S.card}>
            <div style={S.cardTitle}>SCORE BREAKDOWN</div>
            <ScoreRow label="YOU" committed={puzzle.youCommitted} run={optimal?.run ?? "?"} final={optimal?.youFinal ?? "?"} color="#00d4f0" />
            <ScoreRow label="CPU" committed={puzzle.cpuCommitted} run={cpuRun} final={cpuFinal} color="#ff5828" />
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 11 }}>Optimal outcome:</div>
              {optimal && <OutcomeBadge outcome={optimal.outcome} />}
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: "#28606e", marginBottom: 6 }}>Orderings by outcome:</div>
              {["WIN","TIE","LOSE"].map(o => {
                const n = analysis.filter(a => a.outcome === o).length;
                return n > 0 ? (
                  <div key={o} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <OutcomeBadge outcome={o} />
                    <span style={{ fontSize: 11, color: "#a8cdd8" }}>{n} of {analysis.length}</span>
                  </div>
                ) : null;
              })}
            </div>
            <div style={{ marginTop: 12, padding: "8px 10px", background: "#0f1c2a", borderRadius: 4, fontSize: 10, color: "#28606e", letterSpacing: "0.08em" }}>
              GTO SCORE RANGE: {analysis[analysis.length-1]?.run ?? "?"} — {optimal?.run ?? "?"} pts
              {optimal && analysis.length > 1 && (
                <span style={{ color: optimal.run > analysis[analysis.length-1].run ? "#00bb78" : "#28606e" }}>
                  {" "}(gap: {optimal.run - analysis[analysis.length-1].run})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tab Nav ── */}
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #1d3a52", paddingBottom: 0 }}>
          {[["analysis","ORDERINGS"], ["solution","SOLUTION STEPS"], ["theory","LOGIC & PROOF"]].map(([t, label]) => (
            <button key={t}
              style={{ ...S.btn(tab === t), borderBottom: tab === t ? "2px solid #00d4f0" : "none", borderRadius: "3px 3px 0 0", paddingBottom: 9 }}
              onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Analysis ── */}
        {tab === "analysis" && (
          <div style={S.card}>
            <div style={S.cardTitle}>ALL {analysis.length} ORDERINGS — RANKED BY RUN SCORE</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ color: "#28606e", fontSize: 9, letterSpacing: "0.12em" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #1d3a52" }}>#</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #1d3a52" }}>SEQUENCE</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #1d3a52" }}>RUN</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #1d3a52" }}>YOU</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #1d3a52" }}>CPU</th>
                    <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #1d3a52" }}>RESULT</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #1d3a52" }}>STEPS</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.map((a, i) => {
                    const isOpt = i === 0;
                    const rowBg = isOpt ? "rgba(0,212,240,0.05)" : selOrdering === i ? "rgba(255,255,255,0.02)" : "transparent";
                    return (
                      <tr key={i}
                        style={{ background: rowBg, cursor: "pointer", transition: "background 0.15s" }}
                        onClick={() => { setSelOrdering(i); setTab("solution"); setAnimStep(-1); setAutoPlay(false); }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                        onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                        <td style={{ padding: "8px 8px", color: isOpt ? "#00d4f0" : "#28606e", fontWeight: isOpt ? "bold" : "normal" }}>
                          {isOpt ? "★" : i + 1}
                        </td>
                        <td style={{ padding: "8px 8px" }}>
                          {a.order.map((b, j) => (
                            <span key={b.id}>
                              <span style={{ color: bonusColor(b.bonus), fontWeight: isOpt ? "bold" : "normal" }}>
                                {b.id}
                              </span>
                              <span style={{ color: "#28606e", fontSize: 9 }}>({bonusLabel(b.bonus)})</span>
                              {j < a.order.length - 1 && <span style={{ color: "#1d3a52", margin: "0 4px" }}>→</span>}
                            </span>
                          ))}
                        </td>
                        <td style={{ textAlign: "right", padding: "8px 8px", color: isOpt ? "#ffd700" : "#a8cdd8", fontWeight: "bold" }}>{a.run}</td>
                        <td style={{ textAlign: "right", padding: "8px 8px", color: "#00d4f0" }}>{a.youFinal}</td>
                        <td style={{ textAlign: "right", padding: "8px 8px", color: "#ff5828" }}>{a.cpuFinal}</td>
                        <td style={{ textAlign: "center", padding: "8px 8px" }}><OutcomeBadge outcome={a.outcome} /></td>
                        <td style={{ padding: "8px 8px", color: "#28606e", fontSize: 10 }}>
                          {a.steps.map(s => s.expr).join(" | ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 10, fontSize: 9, color: "#1d3a52", letterSpacing: "0.1em" }}>
              CLICK ANY ROW TO SEE STEP-BY-STEP WALKTHROUGH IN THE SOLUTION STEPS TAB
            </div>
          </div>
        )}

        {/* ── Tab: Solution ── */}
        {tab === "solution" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Ordering selector */}
            <div style={S.card}>
              <div style={S.cardTitle}>SELECT ORDERING TO WALK THROUGH</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {analysis.map((a, i) => (
                  <button key={i}
                    style={{ ...S.btn(selOrdering === i, S.outcomeColor[a.outcome]), fontSize: 10 }}
                    onClick={() => { setSelOrdering(i); setAnimStep(-1); setAutoPlay(false); }}>
                    {i === 0 ? "★ " : ""}{a.order.map(b => b.id).join("→")} ({a.outcome})
                  </button>
                ))}
              </div>
            </div>

            {/* Playback controls */}
            <div style={S.card}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, color: "#00d4f0", letterSpacing: "0.15em" }}>
                  {selOrdering === 0 ? "★ OPTIMAL SOLUTION" : `ORDERING #${selOrdering + 1}`}
                  <span style={{ marginLeft: 12 }}><OutcomeBadge outcome={analysis[selOrdering]?.outcome} /></span>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button style={S.btn(false)} onClick={() => { setAnimStep(-1); setAutoPlay(false); }}>RESET</button>
                  <button style={S.btn(false)} onClick={() => setAnimStep(s => Math.max(-1, s - 1))}>◀ PREV</button>
                  <button style={S.btn(false)} onClick={() => setAnimStep(s => Math.min((analysis[selOrdering]?.steps.length ?? 1) - 1, s + 1))}>NEXT ▶</button>
                  <button style={S.btn(autoPlay, "#00d4f0")} onClick={() => { if (animStep >= (analysis[selOrdering]?.steps.length ?? 1) - 1) setAnimStep(-1); setAutoPlay(v => !v); }}>
                    {autoPlay ? "⏸ PAUSE" : "▶ PLAY"}
                  </button>
                </div>
              </div>

              {/* Box row */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                {analysis[selOrdering]?.order.map((b, i) => (
                  <BoxCard key={b.id} box={b}
                    highlight={animStep === i}
                    dim={animStep >= 0 && animStep < i} />
                ))}
                <div style={{ display: "flex", alignItems: "center", color: "#1d3a52", padding: "0 6px" }}>→ OPEN TRAP</div>
                <BoxCard box={puzzle.trapBox} dim={animStep < (analysis[selOrdering]?.steps.length ?? 0)} />
              </div>

              {/* Steps */}
              {analysis[selOrdering]?.steps.map((step, i) => {
                const visible = animStep < 0 || i <= animStep;
                const active  = i === animStep;
                const typeColor = { normal: "#a8cdd8", flat: "#22aadd", mult: "#e09000" }[step.type] || "#a8cdd8";
                return (
                  <div key={i} style={{
                    ...S.stepBox,
                    opacity: visible ? 1 : 0.25,
                    borderColor: active ? typeColor : "#1d3a52",
                    background: active ? typeColor + "10" : "#0f1c2a",
                    transition: "all 0.3s",
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, color: typeColor, minWidth: 28 }}>{step.box.id}</span>
                      <span style={{ fontSize: 10, color: "#28606e" }}>Capture {step.box.bonus ? (step.box.bonus.op === "+" ? "flat +"+step.box.bonus.val : "×"+step.box.bonus.val) : "normal"}</span>
                      <span style={{ flex: 1, textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>
                        <span style={{ color: "#28606e" }}>run = </span>
                        <span style={{ color: typeColor }}>{step.expr}</span>
                        <span style={{ color: "#28606e" }}> = </span>
                        <span style={{ color: active ? "#ffd700" : "#a8cdd8", fontWeight: "bold" }}>{step.after}</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Final result */}
              {(animStep >= (analysis[selOrdering]?.steps.length ?? 1) - 1 || animStep < 0) && analysis[selOrdering] && (
                <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 5, background: S.outcomeColor[analysis[selOrdering].outcome] + "12", border: `1px solid ${S.outcomeColor[analysis[selOrdering].outcome]}`, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 9, color: "#28606e", marginBottom: 3 }}>YOUR RUN COMMITTED</div>
                    <div style={{ fontSize: 22, color: "#ffd700", fontWeight: "bold" }}>{analysis[selOrdering].run}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "#28606e", marginBottom: 3 }}>YOU FINAL</div>
                    <div style={{ fontSize: 22, color: "#00d4f0", fontWeight: "bold" }}>{analysis[selOrdering].youFinal}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: "#28606e", marginBottom: 3 }}>CPU FINAL</div>
                    <div style={{ fontSize: 22, color: "#ff5828", fontWeight: "bold" }}>{analysis[selOrdering].cpuFinal}</div>
                  </div>
                  <div style={{ fontSize: 28, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: S.outcomeColor[analysis[selOrdering].outcome], marginLeft: "auto" }}>
                    {analysis[selOrdering].outcome}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Theory ── */}
        {tab === "theory" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Algorithmic explanation blocks */}
            {explanation.map((block, i) => {
              const kindColor = { summary: "#22aadd", rule: "#00d4f0", proof: "#00bb78", trap: "#e09000", conclusion: "#ffd700" }[block.kind] || "#a8cdd8";
              return (
                <div key={i} style={{ ...S.card, borderLeftWidth: 3, borderLeftColor: kindColor, paddingLeft: 18 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 16, color: kindColor }}>{block.icon}</span>
                    <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, letterSpacing: "0.15em", color: kindColor }}>{block.title}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#a8cdd8", lineHeight: 1.8, margin: 0 }}>{block.body}</p>
                </div>
              );
            })}

            {/* Claude-powered deep explanation */}
            <TheoryPanel puzzle={puzzle} analysis={analysis} />

            {/* Universal GTO rules reference */}
            <div style={S.card}>
              <div style={S.cardTitle}>◈ UNIVERSAL GTO RULES FOR THIS SCORING SYSTEM</div>
              {[
                ["①", "#00d4f0", "Flat bonuses first", "Boxes with +n bonuses should always be captured before any ×n box. Flat bonuses add to the run; capturing them inflates the base before multiplication."],
                ["②", "#22aadd", "Among flat bonuses — order is irrelevant", "Addition is commutative: a + b + c = c + b + a. Any ordering of flat-only boxes yields identical run scores."],
                ["③", "#e09000", "Among multipliers — ascending ×n order", "For multipliers m₁ < m₂: applying m₁ first yields +m₂ more than applying m₂ first. Proof: the final terms differ by exactly m₂ − m₁."],
                ["④", "#ffd700", "Multipliers compound everything before them", "A ×n box applies to your ENTIRE accumulated run (plus 1 for the capture). The higher the run before you multiply, the more powerful the effect."],
                ["⑤", "#00bb78", "The trap is a constant — optimise around it", "The CPU's score from the trap box is fixed regardless of your play order. Your only variable is the run you build before opening it."],
              ].map(([num, col, title, body]) => (
                <div key={num} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: "1px solid #1d3a5222" }}>
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, color: col, minWidth: 24 }}>{num}</span>
                  <div>
                    <div style={{ fontSize: 11, color: col, letterSpacing: "0.08em", marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 11, color: "#28606e", lineHeight: 1.7 }}>{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Auto-mount when loaded directly via HTML
const _root = document.getElementById('root');
if (_root) ReactDOM.createRoot(_root).render(React.createElement(App));
