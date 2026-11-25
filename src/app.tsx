import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

/* =====================================================================
   DEFAULT CONTENT. This is only the starting point: once the app has run,
   edits made inside the app (Edit button) are saved on the device and win
   over this list. "Reset layout" in Edit mode restores exactly this list.
   Structure: segments -> routines -> activities. Ids must stay unique.
   ===================================================================== */
interface Activity {
  id: string;
  label: string;
  note?: string;
}
interface Routine {
  id: string;
  name: string;
  hint?: string;
  draft?: boolean;
  activities: Activity[];
}
interface Segment {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  note?: string;
  routines: Routine[];
}

const DEFAULT_SEGMENTS: Segment[] = [
  {
    id: "in1",
    name: "In Segment #1",
    subtitle: "Wake up until the Out segment",
    color: "#2F6FED",
    routines: [
      {
        id: "morning",
        name: "Morning Routine",
        hint: "Locked in. Phone stays in the bedroom until 9:30.",
        activities: [
          { id: "pee", label: "Pee" },
          { id: "teeth-am", label: "Brush teeth" },
          { id: "balcony", label: "Open balcony for Hazel", note: "Feed her if needed" },
          { id: "pray", label: "Pray" },
          { id: "breakfast", label: "Breakfast", note: "Planned meal or a protein bar" },
          { id: "stocks", label: "Mark stock zones on iPad", note: "Phone stays in the bedroom" },
          { id: "manga", label: "Berserk manga or an enjoyable non-gaming activity" },
          { id: "catchup-1", label: "9:30 work catch-up", note: "Phone is earned back" },
        ],
      },
      {
        id: "late-morning",
        name: "Late Morning",
        hint: "9:30 to about 12",
        draft: true,
        activities: [
          { id: "work-caught-up", label: "Work caught up" },
          { id: "real-swap", label: "Swap a scroll for something real", note: "Manga, golf chipping, Lego. Off the phone." },
          { id: "lunch", label: "Cook and eat planned lunch", note: "Log macros" },
        ],
      },
    ],
  },
  {
    id: "out",
    name: "Out Segment",
    subtitle: "The sweat block, before Jordan gets home",
    color: "#E8590C",
    routines: [
      {
        id: "get-moving",
        name: "Get Moving",
        hint: "Afternoon, before about 5",
        draft: true,
        activities: [
          { id: "walk", label: "Hazel walk", note: "Steps" },
          { id: "gym", label: "Gym" },
          { id: "shower", label: "Shower" },
        ],
      },
    ],
  },
  {
    id: "in2",
    name: "In Segment #2",
    subtitle: "Evening",
    color: "#7048E8",
    note: "6 PM: cart unlocks",
    routines: [
      {
        id: "evening",
        name: "Evening",
        hint: "6 PM: cart unlocks",
        draft: true,
        activities: [
          { id: "dinner", label: "Cook planned dinner", note: "Log macros" },
          { id: "family", label: "Family time", note: "Call or text Mom, Papa, or Dad" },
          { id: "teeth-pm", label: "Brush teeth before bed" },
        ],
      },
    ],
  },
];
/* ===================== end of default content ===================== */

const KEY_LOG = "raphael-weekday-habits-v1";
const KEY_CONFIG = "raphael-weekday-habits-config-v2";
const ACCENT = "#2F6FED";
const PERFECT = "#12B886";
const FIRE = "#FF4A12";
const ICE = "#6EC8F5";
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

type Log = Record<string, string[]>;
type View = { seg: string | null; routine: string | null };

type Theme = {
  kind: "light" | "dark";
  bg: { base: string; subtle: string; elevated: string };
  text: { primary: string; secondary: string; tertiary: string; onColor: string; onPrimary: string; accent: string };
  fill: { primary: string; secondary: string };
  border: { default: string; strong: string };
  font: { family: string };
};

const LIGHT: Theme = {
  kind: "light",
  bg: { base: "#F3F3F5", subtle: "#EBEBED", elevated: "#FFFFFF" },
  text: { primary: "#111113", secondary: "#5C5C66", tertiary: "#8B8B94", onColor: "#FFFFFF", onPrimary: "#FFFFFF", accent: ACCENT },
  fill: { primary: "#111113", secondary: "#E4E4E8" },
  border: { default: "#D4D4DA", strong: "#8B8B94" },
  font: { family: FONT },
};

const DARK: Theme = {
  kind: "dark",
  bg: { base: "#0E0E10", subtle: "#161618", elevated: "#1C1C1F" },
  text: { primary: "#F4F4F5", secondary: "#A1A1AA", tertiary: "#71717A", onColor: "#FFFFFF", onPrimary: "#111113", accent: ACCENT },
  fill: { primary: "#F4F4F5", secondary: "#1C1C1F" },
  border: { default: "#2E2E33", strong: "#8B8B94" },
  font: { family: FONT },
};

function getTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT;
}

function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(getTheme);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => setTheme(getTheme());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return theme;
}

/* ---------- storage that never throws ---------- */
const mem: Record<string, string> = {};
function readStore(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    /* blocked: fall through to memory */
  }
  return mem[key] === undefined ? null : mem[key];
}
function writeStore(key: string, value: string): boolean {
  mem[key] = value;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function cloneDefaults(): Segment[] {
  return JSON.parse(JSON.stringify(DEFAULT_SEGMENTS)) as Segment[];
}
function loadLog(): Log {
  try {
    const raw = readStore(KEY_LOG);
    if (raw) {
      const p = JSON.parse(raw) as Log;
      if (p && typeof p === "object") return p;
    }
  } catch {
    /* corrupt value: start fresh */
  }
  return {};
}
function loadConfig(): Segment[] {
  try {
    const raw = readStore(KEY_CONFIG);
    if (raw) {
      const p = JSON.parse(raw) as Segment[];
      if (Array.isArray(p) && p.length > 0 && p.every((s: Segment) => s && Array.isArray(s.routines))) return p;
    }
  } catch {
    /* corrupt value: use defaults */
  }
  return cloneDefaults();
}

/* ---------- dates (weekdays only) ---------- */
const pad = (n: number): string => String(n).padStart(2, "0");
function keyOf(d: Date): string {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function parseKey(k: string): Date {
  const p = k.split("-");
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function isWeekday(d: Date): boolean {
  const g = d.getDay();
  return g > 0 && g < 6;
}
function prevWeekday(d: Date): Date {
  let x = addDays(d, -1);
  while (!isWeekday(x)) x = addDays(x, -1);
  return x;
}
function lastWeekdayOnOrBefore(d: Date): Date {
  let x = d;
  while (!isWeekday(x)) x = addDays(x, -1);
  return x;
}
function weekDays(today: Date): Date[] {
  const dow = today.getDay();
  const mon = addDays(today, dow === 0 ? -6 : 1 - dow);
  return [0, 1, 2, 3, 4].map((i: number) => addDays(mon, i));
}
const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const DOW3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ---------- streak maths ---------- */
function currentRun(has: (d: Date) => boolean, today: Date): number {
  let cur = lastWeekdayOnOrBefore(today);
  if (isWeekday(today) && !has(cur)) cur = prevWeekday(cur);
  let n = 0;
  while (has(cur) && n < 4000) {
    n += 1;
    cur = prevWeekday(cur);
  }
  return n;
}
function bestRun(has: (d: Date) => boolean, log: Log, today: Date): number {
  const keys = Object.keys(log).sort();
  if (keys.length === 0) return 0;
  const endKey = keyOf(lastWeekdayOnOrBefore(today));
  const todayKey = keyOf(today);
  let d = parseKey(keys[0]);
  let best = 0;
  let run = 0;
  let guard = 0;
  while (keyOf(d) <= endKey && guard < 4000) {
    if (isWeekday(d)) {
      if (has(d)) {
        run += 1;
        if (run > best) best = run;
      } else if (keyOf(d) !== todayKey) {
        run = 0;
      }
    }
    d = addDays(d, 1);
    guard += 1;
  }
  return best;
}

function newId(): string {
  return "x" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
}
function moveItem<T>(arr: T[], i: number, dir: number): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  const t = next[i];
  next[i] = next[j];
  next[j] = t;
  return next;
}
function buzz(): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
  } catch {
    /* not supported */
  }
}

/* ---------- styles ---------- */
const CSS = `
.hb-root { min-height: 100vh; min-height: 100dvh; box-sizing: border-box; -webkit-text-size-adjust: 100%; touch-action: manipulation; }
.hb-root button { font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; user-select: none; touch-action: manipulation; outline: none; }
.hb-root input { font-family: inherit; -webkit-appearance: none; appearance: none; }
.hb-spring { transition: transform 360ms cubic-bezier(.34,1.56,.64,1), box-shadow 240ms ease, background-color 600ms ease, border-color 600ms ease, color 400ms ease, opacity 200ms ease; }
.hb-spring:active { transform: scale(.96); }
.hb-root button:focus-visible, .hb-root input:focus-visible { box-shadow: 0 0 0 3px rgba(80,120,255,.55); }
@media (hover: hover) {
  .hb-lift:hover { transform: translateY(-2px) scale(1.012); box-shadow: 0 12px 26px rgba(0,0,0,.16); }
  .hb-lift:active { transform: scale(.96); }
  .hb-crumb:hover { text-decoration: underline; }
}
.hb-root button[disabled] { cursor: default; }
.hb-fade { animation: hbFade 380ms cubic-bezier(.2,.9,.3,1) both; }
.hb-pop { animation: hbPop 560ms cubic-bezier(.2,.9,.3,1.3) both; }
.hb-sheet { animation: hbSheet 360ms cubic-bezier(.2,.9,.3,1.1) both; }
.hb-backdrop { animation: hbBackdrop 240ms ease both; }
.hb-toast { animation: hbToast 360ms cubic-bezier(.34,1.56,.64,1) both; }
.hb-check path { stroke-dasharray: 26; stroke-dashoffset: 26; animation: hbDraw 340ms ease-out 40ms forwards; }
.hb-bar { transition: width 600ms cubic-bezier(.2,.9,.3,1.1), background-color 500ms ease; }
.hb-ringarc { transition: stroke-dashoffset 800ms cubic-bezier(.2,.9,.3,1.05), stroke 500ms ease; }
.hb-glow { animation: hbGlow 2.4s ease-in-out infinite; }
.hb-flame { transition: fill 400ms ease, transform 300ms ease; }
.hb-confetti { position: fixed; top: -14px; width: 9px; height: 15px; border-radius: 2px; pointer-events: none; animation-name: hbFall; animation-timing-function: cubic-bezier(.3,.6,.5,1); animation-fill-mode: forwards; }
@keyframes hbFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes hbPop { 0% { transform: scale(.95); } 55% { transform: scale(1.035); } 100% { transform: scale(1); } }
@keyframes hbSheet { from { transform: translateY(100%); } to { transform: none; } }
@keyframes hbBackdrop { from { opacity: 0; } to { opacity: 1; } }
@keyframes hbToast { from { opacity: 0; transform: translateY(24px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes hbDraw { to { stroke-dashoffset: 0; } }
@keyframes hbGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(18,184,134,.0), 0 0 22px 2px rgba(18,184,134,.28); } 50% { box-shadow: 0 0 0 0 rgba(18,184,134,.0), 0 0 34px 6px rgba(18,184,134,.45); } }
@keyframes hbFall { 0% { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; } 85% { opacity: 1; } 100% { transform: translate3d(var(--dx), 108vh, 0) rotate(var(--rot)); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .hb-spring, .hb-fade, .hb-pop, .hb-sheet, .hb-backdrop, .hb-toast, .hb-bar, .hb-ringarc, .hb-glow, .hb-flame { animation: none !important; transition: none !important; }
  .hb-check path { animation: none !important; stroke-dashoffset: 0; }
  .hb-confetti { display: none; }
}
`;

/* ---------- small visuals ---------- */
function Flame(props: { size: number; fill: string }) {
  return (
    <svg className="hb-flame" width={props.size} height={props.size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="hbFireGrad" x1="12" y1="22" x2="12" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF2A00" />
          <stop offset="55%" stopColor="#FF4A12" />
          <stop offset="100%" stopColor="#FFB020" />
        </linearGradient>
      </defs>
      <path
        d="M12 2c.9 3.4 5.2 5.6 5.2 10.6a5.2 5.2 0 0 1-10.4 0c0-2.1 1-3.7 2.1-4.7.3 1.6 1 2.6 2.1 3.1-.1-3.1-.5-5.6 1-9z"
        fill={props.fill === FIRE ? "url(#hbFireGrad)" : props.fill}
      />
    </svg>
  );
}

function Snowflake(props: { size: number; color: string }) {
  return (
    <svg width={props.size} height={props.size} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke={props.color} strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.8v18.4M5.1 7.4l13.8 9.2M5.1 16.6l13.8-9.2" />
        <path d="M12 2.8l2.1 2.1M12 2.8L9.9 4.9M12 21.2l2.1-2.1M12 21.2l-2.1-2.1" />
        <path d="M5.1 7.4l2.8.15M5.1 7.4l.15 2.8M18.9 16.6l-2.8-.15M18.9 16.6l-.15-2.8" />
        <path d="M5.1 16.6l2.8-.15M5.1 16.6l.15-2.8M18.9 7.4l-2.8.15M18.9 7.4l-.15 2.8" />
      </g>
    </svg>
  );
}

function StreakMark(props: { streak: number; size?: number }) {
  const size = props.size || 20;
  const alive = props.streak > 0;
  const color = alive ? FIRE : ICE;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        flexShrink: 0,
        fontSize: 15,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color,
        transition: "color 400ms ease",
      }}
    >
      {alive ? <Flame size={size} fill={FIRE} /> : <Snowflake size={size} color={ICE} />}
      {props.streak}
    </span>
  );
}

function Check(props: { size: number; color: string }) {
  return (
    <svg className="hb-check" width={props.size} height={props.size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 12.8l4.2 4.2L18.8 7.6" fill="none" stroke={props.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Glyph(props: { d: string; size?: number; stroke?: number }) {
  const s = props.size || 20;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true">
      <path d={props.d} fill="none" stroke="currentColor" strokeWidth={props.stroke || 2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const UP = "M6 15l6-6 6 6";
const DOWN = "M6 9l6 6 6-6";

function DraftTag(props: { onColor?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 999,
        border: "1px solid " + (props.onColor ? "rgba(255,255,255,.7)" : "currentColor"),
        opacity: props.onColor ? 0.95 : 0.6,
        fontWeight: 500,
      }}
    >
      Draft
    </span>
  );
}

function Ring(props: { pct: number; complete: boolean }) {
  const theme = useTheme();
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = props.complete ? PERFECT : ACCENT;
  return (
    <svg width={132} height={132} viewBox="0 0 120 120" role="img" aria-label={props.pct + " percent done today"}>
      <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(128,128,128,.25)" strokeWidth={10} />
      <circle
        className="hb-ringarc"
        cx={60}
        cy={60}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - props.pct / 100)}
        transform="rotate(-90 60 60)"
      />
      <text x={60} y={60} textAnchor="middle" dominantBaseline="central" fontSize={28} fontWeight={600} fill={theme.text.primary}>
        {props.pct}%
      </text>
    </svg>
  );
}

function IconButton(props: { label: string; onClick: () => void; disabled?: boolean; children: any; active?: boolean; wide?: boolean }) {
  const theme = useTheme();
  return (
    <button
      className="hb-spring"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        minWidth: 44,
        height: 44,
        padding: props.wide ? "0 14px" : 0,
        borderRadius: 14,
        border: "1px solid " + theme.border.default,
        background: props.active ? theme.fill.primary : theme.bg.base,
        color: props.active ? theme.text.onPrimary : theme.text.primary,
        opacity: props.disabled ? 0.35 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontSize: 14,
        fontWeight: 500,
      }}
    >
      {props.children}
    </button>
  );
}

function TextField(props: { value: string; onChange: (v: string) => void; placeholder?: string; label: string; onEnter?: () => void; small?: boolean }) {
  const theme = useTheme();
  return (
    <input
      aria-label={props.label}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && props.onEnter) props.onEnter();
      }}
      style={{
        width: "100%",
        boxSizing: "border-box",
        minHeight: props.small ? 40 : 46,
        padding: "0 14px",
        fontSize: 16,
        borderRadius: 14,
        border: "1px solid " + theme.border.default,
        background: theme.bg.base,
        color: theme.text.primary,
      }}
    />
  );
}

/* ---------- bubble ---------- */
function Bubble(props: {
  title: string;
  subtitle?: string;
  note?: string;
  draft?: boolean;
  done: number;
  total: number;
  color: string;
  onClick: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const complete = props.total > 0 && props.done === props.total;
  const pct = props.total === 0 ? 0 : Math.round((props.done / props.total) * 100);
  const fg = complete ? "#FFFFFF" : theme.text.primary;
  const sub = complete ? "rgba(255,255,255,.85)" : theme.text.secondary;
  return (
    <button
      className={"hb-spring hb-lift" + (complete ? " hb-pop" : "")}
      onClick={props.onClick}
      style={{
        width: "100%",
        textAlign: "left",
        display: "block",
        minHeight: 96,
        border: "1px solid " + (complete ? props.color : theme.border.default),
        borderRadius: props.compact ? 24 : 28,
        padding: props.compact ? "18px 20px" : "20px 22px",
        background: complete ? props.color : theme.fill.secondary,
        color: fg,
        boxShadow: "0 2px 6px rgba(0,0,0,.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: props.compact ? 18 : 21, fontWeight: 600, lineHeight: 1.2 }}>{props.title}</span>
            {props.draft ? <DraftTag onColor={complete} /> : null}
          </div>
          {props.subtitle ? <div style={{ marginTop: 4, fontSize: 14, color: sub }}>{props.subtitle}</div> : null}
          {props.note ? <div style={{ marginTop: 6, fontSize: 13, color: sub }}>{props.note}</div> : null}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: props.compact ? 28 : 34, fontWeight: 600, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {props.done}
            <span style={{ opacity: 0.55 }}>/{props.total}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: sub, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
            {complete ? (
              <span key="all" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={14} color="#FFFFFF" /> All done
              </span>
            ) : (
              <span>today</span>
            )}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          height: 6,
          borderRadius: 999,
          background: complete ? "rgba(255,255,255,.35)" : "rgba(128,128,128,.25)",
          overflow: "hidden",
          transition: "background-color 500ms ease",
        }}
      >
        <div className="hb-bar" style={{ height: "100%", width: pct + "%", borderRadius: 999, background: complete ? "#FFFFFF" : props.color }} />
      </div>
    </button>
  );
}

/* ---------- activity row (tap = toggle, hold or streak chip = history) ---------- */
function ActivityRow(props: {
  activity: Activity;
  done: boolean;
  streak: number;
  color: string;
  editable: boolean;
  onToggle: () => void;
  onInfo: () => void;
}) {
  const theme = useTheme();
  const a = props.activity;
  const timer = useRef<number | null>(null);
  const fired = useRef<boolean>(false);
  const clear = (): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderRadius: 22,
        border: "1px solid " + (props.done ? props.color : theme.border.default),
        background: props.done ? props.color + "22" : theme.fill.secondary,
        transition: "background-color 400ms ease, border-color 400ms ease",
      }}
    >
      <button
        className="hb-spring"
        disabled={!props.editable}
        aria-pressed={props.done}
        onPointerDown={() => {
          fired.current = false;
          clear();
          timer.current = window.setTimeout(() => {
            fired.current = true;
            buzz();
            props.onInfo();
          }, 520);
        }}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (fired.current) {
            fired.current = false;
            return;
          }
          props.onToggle();
        }}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 8px 12px 16px",
          textAlign: "left",
          background: "none",
          border: "none",
          borderRadius: 22,
          color: theme.text.primary,
          opacity: props.editable ? 1 : 0.7,
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid " + (props.done ? props.color : theme.border.strong),
            background: props.done ? props.color : "transparent",
            transition: "background-color 300ms ease, border-color 300ms ease, transform 420ms cubic-bezier(.34,1.56,.64,1)",
            transform: props.done ? "scale(1.08)" : "scale(1)",
          }}
        >
          {props.done ? <Check key="c" size={19} color="#FFFFFF" /> : null}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.3,
              color: props.done ? theme.text.secondary : theme.text.primary,
              textDecoration: props.done ? "line-through" : "none",
              textDecorationColor: "rgba(128,128,128,.6)",
            }}
          >
            {a.label}
          </span>
          {a.note ? <span style={{ display: "block", marginTop: 2, fontSize: 13, color: theme.text.tertiary }}>{a.note}</span> : null}
        </span>
      </button>
      <button
        className="hb-spring"
        onClick={props.onInfo}
        aria-label={"Streak history for " + a.label}
        style={{
          minWidth: 60,
          background: "none",
          border: "none",
          borderRadius: 22,
          padding: "0 14px 0 6px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StreakMark streak={props.streak} />
      </button>
    </div>
  );
}

/* ---------- editing row for an activity ---------- */
function EditActivityRow(props: {
  activity: Activity;
  index: number;
  count: number;
  confirming: boolean;
  onChange: (patch: Partial<Activity>) => void;
  onMove: (dir: number) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  return (
    <div style={{ padding: 12, borderRadius: 22, border: "1px solid " + theme.border.default, background: theme.fill.secondary, display: "flex", flexDirection: "column", gap: 8 }}>
      <TextField label="Activity name" value={props.activity.label} onChange={(v: string) => props.onChange({ label: v })} />
      <TextField label="Note" small placeholder="Note (optional)" value={props.activity.note || ""} onChange={(v: string) => props.onChange({ note: v })} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <IconButton label="Move up" disabled={props.index === 0} onClick={() => props.onMove(-1)}>
          <Glyph d={UP} />
        </IconButton>
        <IconButton label="Move down" disabled={props.index === props.count - 1} onClick={() => props.onMove(1)}>
          <Glyph d={DOWN} />
        </IconButton>
        <IconButton wide label={props.confirming ? "Tap again to delete" : "Delete"} onClick={props.onDelete} active={props.confirming}>
          {props.confirming ? "Tap again to delete" : "Delete"}
        </IconButton>
      </div>
    </div>
  );
}

/* ---------- confetti ---------- */
const CONFETTI = Array.from({ length: 44 }, (_: unknown, i: number) => ({
  left: (i * 23 + 7) % 100,
  delay: (i % 11) * 70,
  dur: 1900 + (i % 6) * 260,
  dx: ((i % 7) - 3) * 22,
  rot: 360 + (i % 5) * 160,
  tone: i % 5,
}));

function Confetti(props: { colors: string[] }) {
  const palette = props.colors.concat([PERFECT, "#FAB005"]);
  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 40, overflow: "hidden" }}>
      {CONFETTI.map((c, i: number) => (
        <span
          key={i}
          className="hb-confetti"
          style={{
            left: c.left + "%",
            background: palette[(i + c.tone) % palette.length],
            animationDuration: c.dur + "ms",
            animationDelay: c.delay + "ms",
            ["--dx" as any]: c.dx + "px",
            ["--rot" as any]: c.rot + "deg",
          }}
        />
      ))}
    </div>
  );
}

/* ---------- app ---------- */
function App() {
  const theme = useTheme();
  const [config, setConfig] = useState<Segment[]>(() => loadConfig());
  const [log, setLog] = useState<Log>(() => loadLog());
  const [view, setView] = useState<View>({ seg: null, routine: null });
  const [today] = useState<Date>(() => new Date());
  const [editing, setEditing] = useState<boolean>(false);
  const [adding, setAdding] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [detail, setDetail] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ id: string; label: string; wasDone: boolean; stamp: number } | null>(null);
  const [celebrate, setCelebrate] = useState<number>(0);
  const [storageOk, setStorageOk] = useState<boolean>(true);

  useEffect(() => {
    const ok = writeStore(KEY_LOG, JSON.stringify(log));
    setStorageOk(ok);
  }, [log]);
  useEffect(() => {
    const ok = writeStore(KEY_CONFIG, JSON.stringify(config));
    setStorageOk(ok);
  }, [config]);
  useEffect(() => {
    try {
      document.title = "Habits";
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 5000);
    return () => window.clearTimeout(t);
  }, [undo]);
  useEffect(() => {
    if (!celebrate) return;
    const t = window.setTimeout(() => setCelebrate(0), 4600);
    return () => window.clearTimeout(t);
  }, [celebrate]);
  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(""), 3500);
    return () => window.clearTimeout(t);
  }, [confirm]);

  const editable = isWeekday(today);
  const shownDay = lastWeekdayOnOrBefore(today);
  const shownKey = keyOf(shownDay);
  const doneSet = new Set<string>(log[shownKey] || []);

  const allActivities: Activity[] = [];
  config.forEach((s: Segment) => s.routines.forEach((r: Routine) => r.activities.forEach((a: Activity) => allActivities.push(a))));
  const allIds = allActivities.map((a: Activity) => a.id);
  const allTotal = allIds.length;
  const allDone = allIds.filter((id: string) => doneSet.has(id)).length;
  const allPct = allTotal === 0 ? 0 : Math.round((allDone / allTotal) * 100);
  const perfectToday = allTotal > 0 && allDone === allTotal;

  const countRoutine = (r: Routine): number => r.activities.filter((a: Activity) => doneSet.has(a.id)).length;
  const countSegment = (s: Segment): { done: number; total: number } => {
    let done = 0;
    let total = 0;
    s.routines.forEach((r: Routine) => {
      done += countRoutine(r);
      total += r.activities.length;
    });
    return { done, total };
  };
  const hasId = (id: string) => (d: Date): boolean => (log[keyOf(d)] || []).indexOf(id) >= 0;
  const hasPerfect = (d: Date): boolean => {
    if (allTotal === 0) return false;
    const s = log[keyOf(d)] || [];
    return allIds.every((id: string) => s.indexOf(id) >= 0);
  };
  const perfectStreak = currentRun(hasPerfect, today);
  const perfectBest = bestRun(hasPerfect, log, today);

  const seg = config.find((s: Segment) => s.id === view.seg) || null;
  const routine = seg ? seg.routines.find((r: Routine) => r.id === view.routine) || null : null;

  const go = (v: View): void => {
    setView(v);
    setAdding("");
    setConfirm("");
  };

  const toggle = (id: string, label: string): void => {
    if (!editable) return;
    const wasDone = doneSet.has(id);
    const next = new Set<string>(doneSet);
    if (wasDone) next.delete(id);
    else next.add(id);
    setLog((prev: Log) => {
      const out: Log = { ...prev };
      out[shownKey] = Array.from(next);
      return out;
    });
    setUndo({ id, label, wasDone, stamp: Date.now() });
    buzz();
    if (!wasDone && allTotal > 0 && allIds.every((x: string) => next.has(x))) setCelebrate(Date.now());
    if (wasDone) setCelebrate(0);
  };
  const doUndo = (): void => {
    if (!undo) return;
    const u = undo;
    setLog((prev: Log) => {
      const cur = new Set<string>(prev[shownKey] || []);
      if (u.wasDone) cur.add(u.id);
      else cur.delete(u.id);
      const out: Log = { ...prev };
      out[shownKey] = Array.from(cur);
      return out;
    });
    setCelebrate(0);
    setUndo(null);
    buzz();
  };

  const updateSeg = (segId: string, fn: (s: Segment) => Segment): void => {
    setConfig((prev: Segment[]) => prev.map((s: Segment) => (s.id === segId ? fn(s) : s)));
  };
  const updateRoutine = (segId: string, rid: string, fn: (r: Routine) => Routine): void => {
    updateSeg(segId, (s: Segment) => ({ ...s, routines: s.routines.map((r: Routine) => (r.id === rid ? fn(r) : r)) }));
  };
  const askDelete = (token: string, run: () => void): void => {
    if (confirm === token) {
      setConfirm("");
      run();
    } else {
      setConfirm(token);
    }
  };

  const card: any = {
    borderRadius: 28,
    border: "1px solid " + theme.border.default,
    background: theme.fill.secondary,
    padding: 20,
  };
  const crumbStyle: any = {
    background: "none",
    border: "none",
    minHeight: 44,
    padding: "0 6px",
    color: theme.text.secondary,
    fontSize: 15,
  };

  const editButton = (
    <IconButton wide label={editing ? "Finish editing" : "Edit layout"} active={editing} onClick={() => { setEditing(!editing); setAdding(""); setConfirm(""); }}>
      {editing ? "Done" : "Edit"}
    </IconButton>
  );

  let crumbs: any = null;
  if (seg) {
    crumbs = (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, minWidth: 0 }}>
          <button className="hb-crumb" style={crumbStyle} onClick={() => go({ seg: null, routine: null })}>
            Home
          </button>
          <span style={{ color: theme.text.tertiary }}>/</span>
          {routine ? (
            <button className="hb-crumb" style={crumbStyle} onClick={() => go({ seg: seg.id, routine: null })}>
              {seg.name}
            </button>
          ) : (
            <span style={{ fontSize: 15, fontWeight: 600, padding: "0 6px" }}>{seg.name}</span>
          )}
          {routine ? <span style={{ color: theme.text.tertiary }}>/</span> : null}
          {routine ? <span style={{ fontSize: 15, fontWeight: 600, padding: "0 6px" }}>{routine.name}</span> : null}
        </div>
        {editButton}
      </div>
    );
  }

  const weekCols = weekDays(today);
  const todayKey = keyOf(today);

  const weekView = (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>This week</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) repeat(5, minmax(0,1fr))", gap: "10px 4px", alignItems: "center" }}>
        <span />
        {weekCols.map((d: Date) => (
          <span
            key={keyOf(d)}
            style={{
              textAlign: "center",
              fontSize: 12,
              fontWeight: keyOf(d) === todayKey ? 700 : 500,
              color: keyOf(d) === todayKey ? theme.text.primary : theme.text.tertiary,
            }}
          >
            {DOW3[d.getDay()]}
          </span>
        ))}
        {config.map((s: Segment) => {
          const ids: string[] = [];
          s.routines.forEach((r: Routine) => r.activities.forEach((a: Activity) => ids.push(a.id)));
          return [
            <span key={s.id + "-l"} style={{ fontSize: 13, color: theme.text.secondary, lineHeight: 1.2, paddingRight: 6 }}>
              {s.name}
            </span>,
            ...weekCols.map((d: Date) => {
              const k = keyOf(d);
              const future = k > todayKey;
              const set = log[k] || [];
              const n = ids.filter((id: string) => set.indexOf(id) >= 0).length;
              const full = ids.length > 0 && n === ids.length;
              const pct = ids.length === 0 ? 0 : Math.round((n / ids.length) * 100);
              return (
                <span key={s.id + k} style={{ display: "flex", justifyContent: "center" }}>
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: full ? s.color : future ? "transparent" : "conic-gradient(" + s.color + " " + pct + "%, rgba(128,128,128,.25) 0)",
                      border: future ? "1.5px dashed " + theme.border.default : "none",
                      transition: "background-color 500ms ease",
                      position: "relative",
                    }}
                  >
                    {full ? (
                      <Check size={16} color="#FFFFFF" />
                    ) : future || pct === 0 ? null : (
                      <span style={{ width: 20, height: 20, borderRadius: 999, background: theme.fill.secondary }} />
                    )}
                  </span>
                </span>
              );
            }),
          ];
        })}
        <span style={{ fontSize: 13, color: theme.text.secondary, fontWeight: 600 }}>Perfect day</span>
        {weekCols.map((d: Date) => {
          const k = keyOf(d);
          const future = k > todayKey;
          const ok = !future && hasPerfect(d);
          return (
            <span key={"p" + k} style={{ display: "flex", justifyContent: "center" }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: ok ? PERFECT : "transparent",
                  border: ok ? "none" : "1.5px " + (future ? "dashed " : "solid ") + theme.border.default,
                  transition: "background-color 500ms ease",
                }}
              >
                {ok ? <Check size={16} color="#FFFFFF" /> : null}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );

  let screen: any;

  if (seg && routine) {
    const done = countRoutine(routine);
    const total = routine.activities.length;
    const complete = total > 0 && done === total;
    screen = (
      <div key={"r-" + routine.id + (editing ? "-e" : "")} className="hb-fade">
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>{routine.name}</h1>
              {routine.draft ? (
                <span style={{ color: theme.text.secondary }}>
                  <DraftTag />
                </span>
              ) : null}
            </div>
            {routine.hint ? <div style={{ marginTop: 4, fontSize: 14, color: theme.text.secondary }}>{routine.hint}</div> : null}
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: complete ? seg.color : theme.text.primary, transition: "color 500ms ease" }}>
            {done}
            <span style={{ opacity: 0.5 }}>/{total}</span>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "rgba(128,128,128,.25)", overflow: "hidden", margin: "10px 0 16px" }}>
          <div className="hb-bar" style={{ height: "100%", width: (total === 0 ? 0 : Math.round((done / total) * 100)) + "%", background: seg.color, borderRadius: 999 }} />
        </div>
        {!editing && total > 0 ? (
          <div style={{ fontSize: 12, color: theme.text.tertiary, marginBottom: 10 }}>Tap to check off. Hold, or tap the flame, for streak history.</div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {editing
            ? routine.activities.map((a: Activity, i: number) => (
                <EditActivityRow
                  key={a.id}
                  activity={a}
                  index={i}
                  count={routine.activities.length}
                  confirming={confirm === "a:" + a.id}
                  onChange={(patch: Partial<Activity>) =>
                    updateRoutine(seg.id, routine.id, (r: Routine) => ({ ...r, activities: r.activities.map((x: Activity) => (x.id === a.id ? { ...x, ...patch } : x)) }))
                  }
                  onMove={(dir: number) => updateRoutine(seg.id, routine.id, (r: Routine) => ({ ...r, activities: moveItem(r.activities, i, dir) }))}
                  onDelete={() =>
                    askDelete("a:" + a.id, () => updateRoutine(seg.id, routine.id, (r: Routine) => ({ ...r, activities: r.activities.filter((x: Activity) => x.id !== a.id) })))
                  }
                />
              ))
            : routine.activities.map((a: Activity) => (
                <ActivityRow
                  key={a.id}
                  activity={a}
                  done={doneSet.has(a.id)}
                  streak={currentRun(hasId(a.id), today)}
                  color={seg.color}
                  editable={editable}
                  onToggle={() => toggle(a.id, a.label)}
                  onInfo={() => setDetail(a.id)}
                />
              ))}
        </div>
        {editing ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <TextField
              label="New activity"
              placeholder="Add an activity"
              value={adding}
              onChange={setAdding}
              onEnter={() => {
                const t = adding.trim();
                if (!t) return;
                updateRoutine(seg.id, routine.id, (r: Routine) => ({ ...r, activities: r.activities.concat([{ id: newId(), label: t }]) }));
                setAdding("");
              }}
            />
            <IconButton
              wide
              label="Add activity"
              onClick={() => {
                const t = adding.trim();
                if (!t) return;
                updateRoutine(seg.id, routine.id, (r: Routine) => ({ ...r, activities: r.activities.concat([{ id: newId(), label: t }]) }));
                setAdding("");
              }}
            >
              Add
            </IconButton>
          </div>
        ) : null}
      </div>
    );
  } else if (seg) {
    const c = countSegment(seg);
    screen = (
      <div key={"s-" + seg.id + (editing ? "-e" : "")} className="hb-fade">
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <TextField label="Segment name" value={seg.name} onChange={(v: string) => updateSeg(seg.id, (s: Segment) => ({ ...s, name: v }))} />
            <TextField label="Segment subtitle" small placeholder="Subtitle" value={seg.subtitle} onChange={(v: string) => updateSeg(seg.id, (s: Segment) => ({ ...s, subtitle: v }))} />
            <TextField label="Segment note" small placeholder="Note (optional)" value={seg.note || ""} onChange={(v: string) => updateSeg(seg.id, (s: Segment) => ({ ...s, note: v }))} />
          </div>
        ) : (
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>{seg.name}</h1>
            <div style={{ marginTop: 4, fontSize: 14, color: theme.text.secondary }}>
              {seg.subtitle} · {c.done}/{c.total} today
            </div>
            {seg.note ? <div style={{ marginTop: 8, fontSize: 13, color: theme.text.tertiary }}>{seg.note}</div> : null}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18 }}>
          {editing
            ? seg.routines.map((r: Routine, i: number) => (
                <div key={r.id} style={{ padding: 12, borderRadius: 22, border: "1px solid " + theme.border.default, background: theme.fill.secondary, display: "flex", flexDirection: "column", gap: 8 }}>
                  <TextField label="Routine name" value={r.name} onChange={(v: string) => updateRoutine(seg.id, r.id, (x: Routine) => ({ ...x, name: v }))} />
                  <TextField label="Routine hint" small placeholder="Hint (optional)" value={r.hint || ""} onChange={(v: string) => updateRoutine(seg.id, r.id, (x: Routine) => ({ ...x, hint: v }))} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <IconButton label="Move up" disabled={i === 0} onClick={() => updateSeg(seg.id, (s: Segment) => ({ ...s, routines: moveItem(s.routines, i, -1) }))}>
                      <Glyph d={UP} />
                    </IconButton>
                    <IconButton label="Move down" disabled={i === seg.routines.length - 1} onClick={() => updateSeg(seg.id, (s: Segment) => ({ ...s, routines: moveItem(s.routines, i, 1) }))}>
                      <Glyph d={DOWN} />
                    </IconButton>
                    <IconButton wide active={!!r.draft} label="Toggle draft" onClick={() => updateRoutine(seg.id, r.id, (x: Routine) => ({ ...x, draft: !x.draft }))}>
                      Draft
                    </IconButton>
                    <IconButton wide label="Open routine" onClick={() => go({ seg: seg.id, routine: r.id })}>
                      Open
                    </IconButton>
                    <IconButton
                      wide
                      label={confirm === "r:" + r.id ? "Tap again to delete" : "Delete"}
                      active={confirm === "r:" + r.id}
                      onClick={() => askDelete("r:" + r.id, () => updateSeg(seg.id, (s: Segment) => ({ ...s, routines: s.routines.filter((x: Routine) => x.id !== r.id) })))}
                    >
                      {confirm === "r:" + r.id ? "Tap again to delete" : "Delete"}
                    </IconButton>
                  </div>
                </div>
              ))
            : seg.routines.map((r: Routine) => (
                <Bubble key={r.id} compact title={r.name} subtitle={r.hint} draft={r.draft} done={countRoutine(r)} total={r.activities.length} color={seg.color} onClick={() => go({ seg: seg.id, routine: r.id })} />
              ))}
        </div>
        {editing ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <TextField
              label="New routine"
              placeholder="Add a routine"
              value={adding}
              onChange={setAdding}
              onEnter={() => {
                const t = adding.trim();
                if (!t) return;
                updateSeg(seg.id, (s: Segment) => ({ ...s, routines: s.routines.concat([{ id: newId(), name: t, draft: true, activities: [] }]) }));
                setAdding("");
              }}
            />
            <IconButton
              wide
              label="Add routine"
              onClick={() => {
                const t = adding.trim();
                if (!t) return;
                updateSeg(seg.id, (s: Segment) => ({ ...s, routines: s.routines.concat([{ id: newId(), name: t, draft: true, activities: [] }]) }));
                setAdding("");
              }}
            >
              Add
            </IconButton>
          </div>
        ) : null}
      </div>
    );
  } else {
    const dateLabel = shownDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    screen = (
      <div key={"home" + (editing ? "-e" : "")} className="hb-fade">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, color: theme.text.secondary }}>{dateLabel}</div>
            <h1 style={{ margin: "2px 0 0", fontSize: 30, fontWeight: 600, lineHeight: 1.15 }}>Weekday Habits</h1>
          </div>
          {editButton}
        </div>

        {!editable ? (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 14, background: theme.fill.secondary, color: theme.text.secondary, fontSize: 13 }}>
            Weekend: tracking is paused and streaks carry over to Monday. Showing {dateLabel}.
          </div>
        ) : null}

        <div
          className={perfectToday ? "hb-glow" : ""}
          style={{
            ...card,
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            borderColor: perfectToday ? PERFECT : theme.border.default,
            transition: "border-color 600ms ease",
          }}
        >
          <Ring pct={allPct} complete={perfectToday} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, color: theme.text.secondary }}>{perfectToday ? "Perfect day" : "Today"}</div>
            <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
              {allDone} of {allTotal} done
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <StreakMark streak={perfectStreak} />
                <span style={{ fontWeight: 400, color: theme.text.secondary, fontSize: 13 }}>perfect-day streak</span>
              </span>
              <span style={{ fontSize: 13, color: theme.text.secondary }}>Best {perfectBest}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          {config.map((s: Segment) => {
            const c = countSegment(s);
            return (
              <Bubble
                key={s.id}
                title={s.name}
                subtitle={s.subtitle}
                note={s.note}
                draft={s.routines.length > 0 && s.routines.every((r: Routine) => !!r.draft)}
                done={c.done}
                total={c.total}
                color={s.color}
                onClick={() => go({ seg: s.id, routine: null })}
              />
            );
          })}
        </div>

        <div style={{ marginTop: 16 }}>{weekView}</div>

        {editing ? (
          <div style={{ ...card, marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, color: theme.text.secondary }}>Open a segment to add, rename, reorder or delete routines and activities.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <IconButton
                wide
                active={confirm === "reset-layout"}
                label="Reset layout to default"
                onClick={() =>
                  askDelete("reset-layout", () => {
                    setConfig(cloneDefaults());
                    go({ seg: null, routine: null });
                  })
                }
              >
                {confirm === "reset-layout" ? "Tap again to reset layout" : "Reset layout to default"}
              </IconButton>
              <IconButton wide active={confirm === "clear-history"} label="Clear check-off history" onClick={() => askDelete("clear-history", () => setLog({}))}>
                {confirm === "clear-history" ? "Tap again to clear history" : "Clear history"}
              </IconButton>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ---------- streak history sheet ---------- */
  let sheet: any = null;
  if (detail) {
    let found: Activity | null = null;
    let color = ACCENT;
    config.forEach((s: Segment) =>
      s.routines.forEach((r: Routine) =>
        r.activities.forEach((a: Activity) => {
          if (a.id === detail) {
            found = a;
            color = s.color;
          }
        })
      )
    );
    const act = found as Activity | null;
    if (act) {
      const has = hasId(act.id);
      const cur = currentRun(has, today);
      const best = bestRun(has, log, today);
      const days: Date[] = [];
      let d = shownDay;
      for (let i = 0; i < 14; i++) {
        days.unshift(d);
        d = prevWeekday(d);
      }
      const hits = days.filter((x: Date) => has(x)).length;
      sheet = (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div className="hb-backdrop" onClick={() => setDetail(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)" }} />
          <div
            className="hb-sheet"
            role="dialog"
            aria-label={"Streak history for " + act.label}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              maxWidth: 560,
              margin: "0 auto",
              background: theme.bg.base,
              color: theme.text.primary,
              border: "1px solid " + theme.border.default,
              borderRadius: "28px 28px 0 0",
              padding: "10px 20px calc(env(safe-area-inset-bottom, 0px) + 20px)",
              boxSizing: "border-box",
              boxShadow: "0 -12px 40px rgba(0,0,0,.25)",
            }}
          >
            <div style={{ width: 40, height: 5, borderRadius: 999, background: "rgba(128,128,128,.4)", margin: "0 auto 14px" }} />
            <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>{act.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginTop: 14 }}>
              {[
                { k: "Streak", v: String(cur) },
                { k: "Best", v: String(best) },
                { k: "Last 14", v: hits + "/14" },
              ].map((t: { k: string; v: string }) => (
                <div key={t.k} style={{ borderRadius: 18, background: theme.fill.secondary, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, color: theme.text.secondary }}>{t.k}</div>
                  <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{t.v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: theme.text.secondary }}>Last 14 weekdays</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: "10px 4px", marginTop: 10 }}>
              {days.map((x: Date) => {
                const k = keyOf(x);
                const ok = has(x);
                const isToday = k === todayKey;
                return (
                  <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: ok ? color : "rgba(128,128,128,.22)",
                        border: isToday && !ok ? "2px solid " + color : "none",
                        boxSizing: "border-box",
                      }}
                    >
                      {ok ? <Check size={15} color="#FFFFFF" /> : null}
                    </span>
                    <span style={{ fontSize: 11, color: theme.text.tertiary }}>
                      {DOW[x.getDay()]} {x.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16 }}>
              <IconButton wide label="Close" onClick={() => setDetail(null)}>
                Close
              </IconButton>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div
      className="hb-root"
      style={{
        background: theme.bg.base,
        color: theme.text.primary,
        fontFamily: theme.font.family,
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
        paddingRight: "calc(env(safe-area-inset-right, 0px) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 110px)",
        paddingLeft: "calc(env(safe-area-inset-left, 0px) + 16px)",
      }}
    >
      <style>{CSS}</style>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {crumbs}
        {!storageOk ? (
          <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 14, background: theme.fill.secondary, color: theme.text.secondary, fontSize: 13 }}>
            Saving is turned off in this viewer, so check-offs and edits last until you close it.
          </div>
        ) : null}
        {screen}
        <div style={{ marginTop: 26, fontSize: 12, color: theme.text.tertiary, textAlign: "center" }}>
          Mon to Fri are tracked. {storageOk ? "Saved on this device." : "Not saved."}
        </div>
      </div>

      {celebrate ? <Confetti key={celebrate} colors={config.map((s: Segment) => s.color)} /> : null}

      {undo ? (
        <div
          key={undo.stamp}
          className="hb-toast"
          style={{
            position: "fixed",
            left: "calc(env(safe-area-inset-left, 0px) + 16px)",
            right: "calc(env(safe-area-inset-right, 0px) + 16px)",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
            maxWidth: 528,
            margin: "0 auto",
            zIndex: 45,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "8px 8px 8px 18px",
            borderRadius: 20,
            background: theme.fill.primary,
            color: theme.text.onPrimary,
            boxShadow: "0 10px 30px rgba(0,0,0,.28)",
          }}
        >
          <span style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {undo.wasDone ? "Unchecked" : "Done"}: {undo.label}
          </span>
          <button
            className="hb-spring"
            onClick={doUndo}
            style={{ minHeight: 44, padding: "0 18px", borderRadius: 14, border: "none", background: "rgba(128,128,128,.28)", color: "inherit", fontSize: 15, fontWeight: 600 }}
          >
            Undo
          </button>
        </div>
      ) : null}

      {sheet}
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
