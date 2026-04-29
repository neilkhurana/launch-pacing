import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine, Cell,
} from "recharts";

const C = {
  bg: "#f8f9fb", card: "#ffffff", border: "#e5e7eb", borderLight: "#f0f1f4",
  text: "#1a1d26", muted: "#6b7280", dim: "#9ca3af",
  blue: "#3b82f6", blueBg: "#eff6ff",
  green: "#059669", greenBg: "#ecfdf5", greenLight: "#34d399",
  amber: "#d97706", amberBg: "#fffbeb",
  purple: "#7c3aed", purpleBg: "#f5f3ff",
  red: "#dc2626",
  cyan: "#0891b2", pink: "#db2777",
  grid: "#f0f1f4",
};

const mono = "'JetBrains Mono', 'SF Mono', 'Consolas', monospace";
const sans = "'DM Sans', system-ui, -apple-system, sans-serif";

const cohortHistorical = [
  { c: "Jan 25", cw: 477, m0: 175, m1: 200, m2: 33, m3: 17, nl: 52,  p0: 0.367, p1: 0.786, p2: 0.85535, p3: 0.89099 },
  { c: "Feb 25", cw: 437, m0: 133, m1: 177, m2: 36, m3: 23, nl: 68,  p0: 0.304, p1: 0.709, p2: 0.79176, p3: 0.84439 },
  { c: "Mar 25", cw: 535, m0: 129, m1: 221, m2: 58, m3: 28, nl: 99,  p0: 0.241, p1: 0.654, p2: 0.76262, p3: 0.81495 },
  { c: "Apr 25", cw: 572, m0: 145, m1: 227, m2: 53, m3: 37, nl: 110,  p0: 0.254, p1: 0.65, p2: 0.74301, p3: 0.80769 },
  { c: "May 25", cw: 580, m0: 138, m1: 243, m2: 90, m3: 42, nl: 67,  p0: 0.238, p1: 0.657, p2: 0.81207, p3: 0.88448 },
  { c: "Jun 25", cw: 588, m0: 137, m1: 254, m2: 65, m3: 26, nl: 106,  p0: 0.233, p1: 0.665, p2: 0.77551, p3: 0.81973 },
  { c: "Jul 25", cw: 637, m0: 220, m1: 268, m2: 53, m3: 25, nl: 71,  p0: 0.345, p1: 0.766, p2: 0.84929, p3: 0.88854 },
  { c: "Aug 25", cw: 618, m0: 209, m1: 224, m2: 59, m3: 35, nl: 91,  p0: 0.338, p1: 0.701, p2: 0.79612, p3: 0.85275 },
  { c: "Sep 25", cw: 641, m0: 239, m1: 223, m2: 65, m3: 36, nl: 78,  p0: 0.373, p1: 0.721, p2: 0.82215, p3: 0.87832 },
  { c: "Oct 25", cw: 771, m0: 275, m1: 255, m2: 79, m3: 33, nl: 129,  p0: 0.357, p1: 0.687, p2: 0.78988, p3: 0.83268 },
  { c: "Nov 25", cw: 605, m0: 217, m1: 229, m2: 52, m3: 27, nl: 80,  p0: 0.359, p1: 0.737, p2: 0.82314, p3: 0.86777 },
  { c: "Dec 25", cw: 831, m0: 288, m1: 305, m2: 77, m3: 23, nl: 138,  p0: 0.347, p1: 0.714, p2: 0.80626, p3: 0.83394 },
  { c: "Jan 26", cw: 810, m0: 218, m1: 314, m2: 95, m3: 22, nl: 161,  p0: 0.269, p1: 0.657, p2: 0.77407, p3: 0.80123 },
  { c: "Feb 26", cw: 839, m0: 188, m1: 338, m2: 95, m3: 0, nl: 218,  p0: 0.224, p1: 0.627, p2: 0.74017, p3: null },
  { c: "Mar 26", cw: 1142, m0: 216, m1: 338, m2: 0, m3: 0, nl: 588,  p0: 0.189, p1: 0.485, p2: null, p3: null },
  { c: "Apr 26", cw: 960, m0: 102, m1: 0, m2: 0, m3: 0, nl: 858,  p0: 0.106, p1: 0.106, p2: null, p3: null },
];

const MAR_AVG = { p0: 0.30395, p1: 0.70101, p2: 0.80298, p3: 0.85337 }; // milestones matured before Mar '26
const AVG     = { p0: 0.31337, p1: 0.70442, p2: 0.80271, p3: 0.85159 }; // milestones matured before Apr '26
const CUR = { decM3: 0.83394, janM2: 0.77407, febM1: 0.62694, marM0: 0.18914 };
const MTD  = { preJan: 4, jan: 22, feb: 95, mar: 338 };
const MTD_TOTAL = 570; // includes 111 from pre-Dec '25 cohorts
const PREV = { preJan: 0.80626, jan: 0.65679, feb: 0.22408, mar: 0.0 };
const FIXED = { preJan: 831, jan: 810, feb: 839 };

const defaultAdj = {
  preJan: 0.82912,
  jan: 0.77407,
  feb: 0.62694,
  mar: 0.19002,
};

// April model — end-of-March rates as baseline
const APR_PREV = { jan: 0.77407, feb: 0.62693, mar: 0.19003, apr: 0.0 };
const APR_FIXED = { jan: 810, feb: 839, mar: 1142 };
const APR_CUR  = { janM3: 0.79136, febM2: 0.70084, marM1: 0.41068, aprM0: 0.03613 };
const APR_MTD  = { jan: 14, feb: 62, mar: 252, apr: 28 };
const APR_MTD_TOTAL = 367; // includes 11 from pre-Jan '26 cohorts

const defaultAprAdj = {
  jan: 0.79,
  feb: 0.70,
  mar: 0.62,
  apr: 0.187,
};

const pf = (v) => `${(v * 100).toFixed(1)}%`;

const WaterfallTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, fontFamily: sans, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: C.text }}>{d.name}</div>
      <div style={{ color: C.muted }}>Launches: <span style={{ color: C.text, fontFamily: mono, fontWeight: 600 }}>{Math.round(d.value)}</span></div>
      {!d.isTotal && <div style={{ color: C.muted }}>Running total: <span style={{ color: C.text, fontFamily: mono, fontWeight: 600 }}>{Math.round(d.cumEnd)}</span></div>}
    </div>
  );
};

const CumTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, fontFamily: sans, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: C.text }}>{label}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 1 }}>{p.name}: {(p.value * 100).toFixed(1)}%</div>
      ))}
    </div>
  );
};

const EditableRate = ({ value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  return editing ? (
    <input autoFocus value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={() => { const n = parseFloat(raw); if (!isNaN(n) && n >= 0 && n <= 100) onChange(n / 100); setEditing(false); }}
      onKeyDown={e => { if (e.key === "Enter") { const n = parseFloat(raw); if (!isNaN(n) && n >= 0 && n <= 100) onChange(n / 100); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      style={{ width: 64, background: C.blueBg, border: `1.5px solid ${C.blue}`, borderRadius: 4, color: C.text, fontSize: 13, fontFamily: mono, padding: "2px 6px", textAlign: "right", outline: "none" }}
    />
  ) : (
    <span onClick={() => { setRaw((value * 100).toFixed(1)); setEditing(true); }}
      style={{ color: C.green, fontFamily: mono, fontSize: 13, cursor: "pointer", padding: "2px 6px", borderRadius: 4, border: `1px dashed ${C.border}`, display: "inline-block", minWidth: 56, textAlign: "right" }}>
      {pf(value)}
    </span>
  );
};

const EditableNumber = ({ value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  return editing ? (
    <input autoFocus value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={() => { const n = parseInt(raw); if (!isNaN(n) && n > 0) onChange(n); setEditing(false); }}
      onKeyDown={e => { if (e.key === "Enter") { const n = parseInt(raw); if (!isNaN(n) && n > 0) onChange(n); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
      style={{ width: 64, background: C.purpleBg, border: `1.5px solid ${C.purple}`, borderRadius: 4, color: C.text, fontSize: 13, fontFamily: mono, padding: "2px 6px", textAlign: "right", outline: "none" }}
    />
  ) : (
    <span onClick={() => { setRaw(String(value)); setEditing(true); }}
      style={{ color: C.purple, fontFamily: mono, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "2px 6px", borderRadius: 4, border: `1px dashed ${C.border}`, display: "inline-block", minWidth: 56, textAlign: "right" }}>
      {value.toLocaleString()}
    </span>
  );
};

const WaterfallChart = ({ data, color }) => {
  const chartData = useMemo(() => {
    let cum = 0;
    return data.map(d => {
      if (d.isTotal) return { ...d, invisible: 0, bar: d.value, cumEnd: d.value };
      const start = cum;
      cum += d.value;
      return { ...d, invisible: start, bar: d.value, cumEnd: cum };
    });
  }, [data]);

  const CustomLabel = ({ x, y, width, value, index }) => {
    const d = chartData[index];
    if (!d) return null;
    return (
      <text x={x + width / 2} y={y - 8} textAnchor="middle" fill={C.text} fontSize={12} fontFamily={mono} fontWeight={600}>
        {Math.round(d.value)}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 28, right: 20, bottom: 5, left: 10 }} barSize={64}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 12, fontFamily: sans }} axisLine={{ stroke: C.border }} tickLine={false} />
        <YAxis tick={{ fill: C.muted, fontSize: 11, fontFamily: mono }} axisLine={false} tickLine={false} />
        <Tooltip content={<WaterfallTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
        <Bar dataKey="invisible" stackId="stack" fill="transparent" />
        <Bar dataKey="bar" stackId="stack" radius={[4, 4, 0, 0]} label={<CustomLabel />}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.isTotal ? `${color}` : `${color}bb`} stroke={d.isTotal ? color : "none"} strokeWidth={d.isTotal ? 2 : 0} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default function Dashboard() {
  const [tab, setTab] = useState("aprilModel");
  const [marchCW, setMarchCW] = useState(1142);
  const [adjRates, setAdjRates] = useState(defaultAdj);
  const [waterfallMode, setWaterfallMode] = useState("adjusted");
  const [aprilCW, setAprilCW] = useState(1014);
  const [aprilAdjRates, setAprilAdjRates] = useState(defaultAprAdj);
  const [aprilWaterfallMode, setAprilWaterfallMode] = useState("adjusted");

  const setRate = useCallback((k, v) => setAdjRates(prev => ({ ...prev, [k]: v })), []);
  const setAprilRate = useCallback((k, v) => setAprilAdjRates(prev => ({ ...prev, [k]: v })), []);

  const model = useMemo(() => {
    const rows = [
      { key: "preJan", label: "Dec '25", cw: FIXED.preJan, avgRate: MAR_AVG.p3, curRate: CUR.decM3, adjRate: adjRates.preJan, note: "M3+ avg", mtd: MTD.preJan, prevRate: PREV.preJan },
      { key: "jan", label: "Jan '26", cw: FIXED.jan, avgRate: MAR_AVG.p2, curRate: CUR.janM2, adjRate: adjRates.jan, note: "M2 avg", mtd: MTD.jan, prevRate: PREV.jan },
      { key: "feb", label: "Feb '26", cw: FIXED.feb, avgRate: MAR_AVG.p1, curRate: CUR.febM1, adjRate: adjRates.feb, note: "M1 avg", mtd: MTD.feb, prevRate: PREV.feb },
      { key: "mar", label: "Mar '26", cw: marchCW, avgRate: MAR_AVG.p0, curRate: CUR.marM0, adjRate: adjRates.mar, note: "M0 avg", mtd: MTD.mar, prevRate: PREV.mar },
    ].map(r => ({
      ...r,
      avgLaunches: r.cw * (r.avgRate - r.prevRate),
      adjLaunches: r.cw * (r.adjRate - r.prevRate),
    }));
    return { rows, totalAvg: rows.reduce((s, r) => s + r.avgLaunches, 0), totalAdj: rows.reduce((s, r) => s + r.adjLaunches, 0) };
  }, [marchCW, adjRates]);

  const aprilModel = useMemo(() => {
    const rows = [
      { key: "jan", label: "Jan '26", cw: APR_FIXED.jan, avgRate: AVG.p3, curRate: APR_CUR.janM3, adjRate: aprilAdjRates.jan, note: "M3+ avg", mtd: APR_MTD.jan, prevRate: APR_PREV.jan },
      { key: "feb", label: "Feb '26", cw: APR_FIXED.feb, avgRate: AVG.p2, curRate: APR_CUR.febM2, adjRate: aprilAdjRates.feb, note: "M2 avg", mtd: APR_MTD.feb, prevRate: APR_PREV.feb },
      { key: "mar", label: "Mar '26", cw: APR_FIXED.mar, avgRate: AVG.p1, curRate: APR_CUR.marM1, adjRate: aprilAdjRates.mar, note: "M1 avg", mtd: APR_MTD.mar, prevRate: APR_PREV.mar },
      { key: "apr", label: "Apr '26", cw: aprilCW, avgRate: AVG.p0, curRate: APR_CUR.aprM0, adjRate: aprilAdjRates.apr, note: "M0 avg", mtd: APR_MTD.apr, prevRate: APR_PREV.apr },
    ].map(r => ({
      ...r,
      avgLaunches: r.cw * (r.avgRate - r.prevRate),
      adjLaunches: r.cw * (r.adjRate - r.prevRate),
    }));
    return { rows, totalAvg: rows.reduce((s, r) => s + r.avgLaunches, 0), totalAdj: rows.reduce((s, r) => s + r.adjLaunches, 0) };
  }, [aprilCW, aprilAdjRates]);

  const waterfallData = useMemo(() => {
    const isAdj = waterfallMode === "adjusted";
    const items = model.rows.map(r => ({ name: r.label, value: isAdj ? r.adjLaunches : r.avgLaunches, isTotal: false }));
    items.push({ name: "Total", value: isAdj ? model.totalAdj : model.totalAvg, isTotal: true });
    return items;
  }, [model, waterfallMode]);

  const aprilWaterfallData = useMemo(() => {
    const isAdj = aprilWaterfallMode === "adjusted";
    const items = aprilModel.rows.map(r => ({ name: r.label, value: isAdj ? r.adjLaunches : r.avgLaunches, isTotal: false }));
    items.push({ name: "Total", value: isAdj ? aprilModel.totalAdj : aprilModel.totalAvg, isTotal: true });
    return items;
  }, [aprilModel, aprilWaterfallMode]);

  const cumData = cohortHistorical.map(c => ({ cohort: c.c, "Cum M0%": c.p0, "Cum M1%": c.p1, "Cum M2%": c.p2, "Cum M3+%": c.p3 }));

  const th = { padding: "8px 12px", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `2px solid ${C.border}`, textAlign: "right", whiteSpace: "nowrap" };
  const td = { padding: "7px 12px", fontSize: 13, fontFamily: mono, textAlign: "right", borderBottom: `1px solid ${C.borderLight}` };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: sans, padding: "24px 32px", maxWidth: 1100, margin: "0 auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 2px", letterSpacing: "-0.02em" }}>CW Cohort Launch Waterfall</h1>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Go Live Date only — pre-2026 averages as baseline · Closed Won cohorts</p>
      </div>

      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `2px solid ${C.border}` }}>
        {[{ k: "model", l: "March Model" }, { k: "aprilModel", l: "April Model" }, { k: "historical", l: "Historical Activations" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            background: "none", border: "none", borderBottom: tab === t.k ? `2px solid ${C.blue}` : "2px solid transparent",
            padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: sans,
            color: tab === t.k ? C.blue : C.muted, marginBottom: -2, transition: "all 0.15s",
          }}>{t.l}</button>
        ))}
      </div>

      {tab === "model" && (
        <>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Expected March Launches by Cohort</h2>
              <div style={{ display: "flex", gap: 2, background: C.bg, borderRadius: 6, padding: 2, border: `1px solid ${C.border}` }}>
                {[{ k: "average", l: "Average" }, { k: "adjusted", l: "Adjusted" }].map(t => (
                  <button key={t.k} onClick={() => setWaterfallMode(t.k)} style={{
                    background: waterfallMode === t.k ? C.card : "transparent",
                    color: waterfallMode === t.k ? C.text : C.muted,
                    border: waterfallMode === t.k ? `1px solid ${C.border}` : "1px solid transparent",
                    borderRadius: 5, padding: "4px 14px", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: sans, transition: "all 0.15s",
                    boxShadow: waterfallMode === t.k ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                  }}>{t.l}</button>
                ))}
              </div>
            </div>
            <WaterfallChart data={waterfallData} color={waterfallMode === "adjusted" ? C.green : C.blue} />
          </div>

          <div style={{ display: "flex", gap: 20, marginBottom: 20, alignItems: "flex-start" }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", width: 300, flexShrink: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Model Inputs</h2>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>March Closed Won</div>
                <EditableNumber value={marchCW} onChange={setMarchCW} />
                <span style={{ fontSize: 11, color: C.dim, marginLeft: 8 }}>target</span>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Adjusted Activation Rates</div>
                {[
                  { k: "preJan", l: "Dec '25", n: `Curr: ${pf(CUR.decM3)}` },
                  { k: "jan", l: "Jan '26", n: `Curr: ${pf(CUR.janM2)}` },
                  { k: "feb", l: "Feb '26", n: `Curr: ${pf(CUR.febM1)}` },
                  { k: "mar", l: "Mar '26", n: `Curr: ${pf(CUR.marM0)}` },
                ].map(({ k, l, n }) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{l}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{n}</div>
                    </div>
                    <EditableRate value={adjRates[k]} onChange={v => setRate(k, v)} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                <button onClick={() => { setAdjRates(defaultAdj); setMarchCW(974); }} style={{
                  width: "100%", background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.muted, fontSize: 12, fontWeight: 500, padding: "7px 0",
                  cursor: "pointer", fontFamily: sans,
                }}>Reset all defaults</button>
                <button onClick={() => setMarchCW(974)} style={{
                  width: "100%", background: "transparent", border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.muted, fontSize: 12, fontWeight: 500, padding: "7px 0",
                  cursor: "pointer", fontFamily: sans,
                }}>Reset closed won target</button>
                <button onClick={() => setAdjRates(defaultAdj)} style={{
                  width: "100%", background: "transparent", border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.muted, fontSize: 12, fontWeight: 500, padding: "7px 0",
                  cursor: "pointer", fontFamily: sans,
                }}>Reset activation rates</button>
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", flex: 1, overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Model Detail</h2>
                <span style={{ fontSize: 11, color: C.dim }}>Adjusted rates are based on manual inputs</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}>Cohort</th>
                    <th style={th}>Closed Won</th>
                    <th style={th}>Mar Launches (Act.)</th>
                    <th style={th}>Adj Rate</th>
                    <th style={th}>Adj Launches</th>
                    <th style={th}>Current Rate</th>
                    <th style={th}>Avg Rate</th>
                    <th style={th}>Avg Launches</th>
                  </tr>
                </thead>
                <tbody>
                  {model.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...td, textAlign: "left", fontFamily: sans, fontWeight: 600 }}>{r.label}</td>
                      <td style={{ ...td, color: r.key === "mar" ? C.purple : C.text, fontWeight: r.key === "mar" ? 600 : 400 }}>{r.cw.toLocaleString()}</td>
                      <td style={{ ...td, color: C.amber, fontWeight: 600 }}>{r.mtd}</td>
                      <td style={{ ...td, color: C.green }}>{pf(r.adjRate)}</td>
                      <td style={{ ...td, color: C.green, fontWeight: 600 }}>{Math.round(r.adjLaunches)}</td>
                      <td style={{ ...td, color: C.dim }}>{pf(r.curRate)}</td>
                      <td style={{ ...td, color: C.blue }}>{pf(r.avgRate)}</td>
                      <td style={{ ...td, color: C.blue, fontWeight: 600 }}>{Math.round(r.avgLaunches)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.text}` }}>
                    <td style={{ ...td, textAlign: "left", fontFamily: sans, fontWeight: 700, fontSize: 14, borderBottom: "none" }}>Total</td>
                    <td style={{ ...td, borderBottom: "none" }} />
                    <td style={{ ...td, color: C.amber, fontWeight: 700, fontSize: 14, borderBottom: "none" }}>
                      {MTD_TOTAL}
                      <div style={{ fontSize: 10, color: C.dim, fontWeight: 400, fontFamily: sans }}>incl. 14 from pre-Dec '25</div>
                    </td>
                    <td style={{ ...td, borderBottom: "none" }} />
                    <td style={{ ...td, color: C.green, fontWeight: 700, fontSize: 14, borderBottom: "none" }}>{Math.round(model.totalAdj)}</td>
                    <td style={{ ...td, borderBottom: "none" }} />
                    <td style={{ ...td, borderBottom: "none" }} />
                    <td style={{ ...td, color: C.blue, fontWeight: 700, fontSize: 14, borderBottom: "none" }}>{Math.round(model.totalAvg)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "aprilModel" && (
        <>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Expected April Launches by Cohort</h2>
              <div style={{ display: "flex", gap: 2, background: C.bg, borderRadius: 6, padding: 2, border: `1px solid ${C.border}` }}>
                {[{ k: "average", l: "Average" }, { k: "adjusted", l: "Adjusted" }].map(t => (
                  <button key={t.k} onClick={() => setAprilWaterfallMode(t.k)} style={{
                    background: aprilWaterfallMode === t.k ? C.card : "transparent",
                    color: aprilWaterfallMode === t.k ? C.text : C.muted,
                    border: aprilWaterfallMode === t.k ? `1px solid ${C.border}` : "1px solid transparent",
                    borderRadius: 5, padding: "4px 14px", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: sans, transition: "all 0.15s",
                    boxShadow: aprilWaterfallMode === t.k ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                  }}>{t.l}</button>
                ))}
              </div>
            </div>
            <WaterfallChart data={aprilWaterfallData} color={aprilWaterfallMode === "adjusted" ? C.green : C.blue} />
          </div>

          <div style={{ display: "flex", gap: 20, marginBottom: 20, alignItems: "flex-start" }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", width: 300, flexShrink: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Model Inputs</h2>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>April Closed Won</div>
                <EditableNumber value={aprilCW} onChange={setAprilCW} />
                <span style={{ fontSize: 11, color: C.dim, marginLeft: 8 }}>target</span>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Adjusted Activation Rates</div>
                {[
                  { k: "jan", l: "Jan '26", n: `Curr: ${pf(APR_CUR.janM3)}` },
                  { k: "feb", l: "Feb '26", n: `Curr: ${pf(APR_CUR.febM2)}` },
                  { k: "mar", l: "Mar '26", n: `Curr: ${pf(APR_CUR.marM1)}` },
                  { k: "apr", l: "Apr '26", n: `Curr: ${pf(APR_CUR.aprM0)}` },
                ].map(({ k, l, n }) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{l}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{n}</div>
                    </div>
                    <EditableRate value={aprilAdjRates[k]} onChange={v => setAprilRate(k, v)} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                <button onClick={() => { setAprilAdjRates(defaultAprAdj); setAprilCW(900); }} style={{
                  width: "100%", background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.muted, fontSize: 12, fontWeight: 500, padding: "7px 0",
                  cursor: "pointer", fontFamily: sans,
                }}>Reset all defaults</button>
                <button onClick={() => setAprilCW(900)} style={{
                  width: "100%", background: "transparent", border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.muted, fontSize: 12, fontWeight: 500, padding: "7px 0",
                  cursor: "pointer", fontFamily: sans,
                }}>Reset closed won target</button>
                <button onClick={() => setAprilAdjRates(defaultAprAdj)} style={{
                  width: "100%", background: "transparent", border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.muted, fontSize: 12, fontWeight: 500, padding: "7px 0",
                  cursor: "pointer", fontFamily: sans,
                }}>Reset activation rates</button>
              </div>
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", flex: 1, overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Model Detail</h2>
                <span style={{ fontSize: 11, color: C.dim }}>Adjusted rates are based on manual inputs</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}>Cohort</th>
                    <th style={th}>Closed Won</th>
                    <th style={th}>Apr Launches (Act.)</th>
                    <th style={th}>Adj Rate</th>
                    <th style={th}>Adj Launches</th>
                    <th style={th}>Current Rate</th>
                    <th style={th}>Avg Rate</th>
                    <th style={th}>Avg Launches</th>
                  </tr>
                </thead>
                <tbody>
                  {aprilModel.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...td, textAlign: "left", fontFamily: sans, fontWeight: 600 }}>{r.label}</td>
                      <td style={{ ...td, color: r.key === "apr" ? C.purple : C.text, fontWeight: r.key === "apr" ? 600 : 400 }}>{r.cw.toLocaleString()}</td>
                      <td style={{ ...td, color: C.amber, fontWeight: 600 }}>{r.mtd || "—"}</td>
                      <td style={{ ...td, color: C.green }}>{pf(r.adjRate)}</td>
                      <td style={{ ...td, color: C.green, fontWeight: 600 }}>{Math.round(r.adjLaunches)}</td>
                      <td style={{ ...td, color: C.dim }}>{pf(r.curRate)}</td>
                      <td style={{ ...td, color: C.blue }}>{pf(r.avgRate)}</td>
                      <td style={{ ...td, color: C.blue, fontWeight: 600 }}>{Math.round(r.avgLaunches)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${C.text}` }}>
                    <td style={{ ...td, textAlign: "left", fontFamily: sans, fontWeight: 700, fontSize: 14, borderBottom: "none" }}>Total</td>
                    <td style={{ ...td, borderBottom: "none" }} />
                    <td style={{ ...td, color: C.amber, fontWeight: 700, fontSize: 14, borderBottom: "none" }}>
                      {APR_MTD_TOTAL || "—"}
                    </td>
                    <td style={{ ...td, borderBottom: "none" }} />
                    <td style={{ ...td, color: C.green, fontWeight: 700, fontSize: 14, borderBottom: "none" }}>{Math.round(aprilModel.totalAdj)}</td>
                    <td style={{ ...td, borderBottom: "none" }} />
                    <td style={{ ...td, borderBottom: "none" }} />
                    <td style={{ ...td, color: C.blue, fontWeight: 700, fontSize: 14, borderBottom: "none" }}>{Math.round(aprilModel.totalAvg)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "historical" && (
        <>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Cumulative Activation Rate by Cohort</h2>
              <div style={{ display: "flex", gap: 14, fontSize: 11, flexShrink: 0 }}>
                {[["Cum M0%", C.cyan], ["Cum M1%", C.blue], ["Cum M2%", C.purple], ["Cum M3+%", C.pink]].map(([l, c]) => (
                  <span key={l} style={{ color: c, fontWeight: 500 }}>● {l.replace("Cum ", "")}</span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={cumData} margin={{ top: 5, right: 15, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
                <XAxis dataKey="cohort" tick={{ fill: C.muted, fontSize: 10 }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: C.muted, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} domain={[0, 1]} />
                <Tooltip content={<CumTooltip />} />
                <ReferenceLine y={AVG.p0} stroke={C.cyan} strokeDasharray="5 4" strokeOpacity={0.35} />
                <ReferenceLine y={AVG.p1} stroke={C.blue} strokeDasharray="5 4" strokeOpacity={0.35} />
                <ReferenceLine y={AVG.p2} stroke={C.purple} strokeDasharray="5 4" strokeOpacity={0.35} />
                <ReferenceLine y={AVG.p3} stroke={C.pink} strokeDasharray="5 4" strokeOpacity={0.35} />
                <Line type="monotone" dataKey="Cum M0%" stroke={C.cyan} strokeWidth={2} dot={{ r: 2.5, fill: C.cyan }} connectNulls={false} />
                <Line type="monotone" dataKey="Cum M1%" stroke={C.blue} strokeWidth={2} dot={{ r: 2.5, fill: C.blue }} connectNulls={false} />
                <Line type="monotone" dataKey="Cum M2%" stroke={C.purple} strokeWidth={2} dot={{ r: 2.5, fill: C.purple }} connectNulls={false} />
                <Line type="monotone" dataKey="Cum M3+%" stroke={C.pink} strokeWidth={2} dot={{ r: 2.5, fill: C.pink }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 24px", overflowX: "auto" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Current Launch Pacing — Launched Locs Only</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}>CW Cohort</th>
                  <th style={th}>Total Closed Won</th>
                  <th style={th}>Month 0</th>
                  <th style={th}>Month 1</th>
                  <th style={th}>Month 2</th>
                  <th style={th}>Month 3+</th>
                  <th style={th}>Not Launched</th>
                  <th style={{ ...th, borderLeft: `2px solid ${C.border}` }}>Cum M0%</th>
                  <th style={th}>Cum M1%</th>
                  <th style={th}>Cum M2%</th>
                  <th style={th}>Cum M3+%</th>
                </tr>
              </thead>
              <tbody>
                {cohortHistorical.map((r, i) => {
                  const is2026 = r.c.includes("26");
                  return (
                    <tr key={i} style={{ background: is2026 ? "#fafbfd" : "transparent" }}>
                      <td style={{ ...td, textAlign: "left", fontFamily: sans, fontWeight: 600, color: is2026 ? C.blue : C.text }}>{r.c}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.cw}</td>
                      <td style={td}>{r.m0}</td>
                      <td style={td}>{r.m1 || "\u2014"}</td>
                      <td style={td}>{r.m2 || "\u2014"}</td>
                      <td style={td}>{r.m3 != null && r.m3 > 0 ? r.m3 : "\u2014"}</td>
                      <td style={td}>{r.nl}</td>
                      <td style={{ ...td, borderLeft: `2px solid ${C.border}`, color: C.cyan, fontWeight: 500 }}>{pf(r.p0)}</td>
                      <td style={{ ...td, color: C.blue, fontWeight: 500 }}>{r.p1 != null ? pf(r.p1) : "\u2014"}</td>
                      <td style={{ ...td, color: C.purple, fontWeight: 500 }}>{r.p2 != null ? pf(r.p2) : "\u2014"}</td>
                      <td style={{ ...td, color: C.pink, fontWeight: 500 }}>{r.p3 != null ? pf(r.p3) : "\u2014"}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: C.blueBg, borderTop: `2px solid ${C.blue}` }}>
                  <td style={{ ...td, textAlign: "left", fontFamily: sans, fontWeight: 700, color: C.blue, fontSize: 13, borderBottom: "none" }}>Average (Pre-2026)</td>
                  <td style={{ ...td, borderBottom: "none" }} />
                  <td style={{ ...td, borderBottom: "none" }} />
                  <td style={{ ...td, borderBottom: "none" }} />
                  <td style={{ ...td, borderBottom: "none" }} />
                  <td style={{ ...td, borderBottom: "none" }} />
                  <td style={{ ...td, borderBottom: "none" }} />
                  <td style={{ ...td, borderLeft: `2px solid ${C.border}`, color: C.cyan, fontWeight: 700, fontSize: 13, borderBottom: "none" }}>{pf(AVG.p0)}</td>
                  <td style={{ ...td, color: C.blue, fontWeight: 700, fontSize: 13, borderBottom: "none" }}>{pf(AVG.p1)}</td>
                  <td style={{ ...td, color: C.purple, fontWeight: 700, fontSize: 13, borderBottom: "none" }}>{pf(AVG.p2)}</td>
                  <td style={{ ...td, color: C.pink, fontWeight: 700, fontSize: 13, borderBottom: "none" }}>{pf(AVG.p3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
