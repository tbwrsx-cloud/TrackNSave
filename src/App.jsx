import { useState, useEffect, useRef } from "react";

const store = {
  async get(key) {
    try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
    catch { return null; }
  },
  async set(key, val) {
    try { await window.storage.set(key, JSON.stringify(val)); } catch {}
  }
};

const INTERVALS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

const SECTIONS = [
  {
    id: "engine_petrol", label: "Engine Bay — Petrol", icon: "⛽", engineType: "petrol",
    items: [
      { id: "ep1", name: "Engine Oil & Filter", schedule: [1,1,1,1,1,1,1,1,1], type: "R" },
      { id: "ep2", name: "Drive Belts", schedule: [0,0,0,1,0,0,0,1,0], type: "I" },
      { id: "ep3", name: "Air Cleaner Filter", schedule: [1,1,2,1,1,2,1,1,2], type: "C/R" },
      { id: "ep4", name: "Battery Condition / Specific Gravity", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "ep5", name: "Throttle Body", schedule: [0,1,1,1,1,1,1,1,1], type: "C" },
      { id: "ep6", name: "Spark Plugs", schedule: [0,0,0,1,0,0,0,1,0], type: "R" },
      { id: "ep7", name: "Vacuum Hoses", schedule: [0,0,0,1,0,0,0,1,0], type: "I" },
      { id: "ep8", name: "Brake / Clutch Fluid", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "ep9", name: "Engine Coolant", schedule: [1,1,1,1,1,1,1,1,2], type: "I/R", note: "Replace at 90k/6Y, then every 40k" },
      { id: "ep10", name: "Manual Transaxle Fluid", schedule: [0,0,0,0,0,0,0,1,0], type: "I" },
      { id: "ep11", name: "CVT Fluid", schedule: [0,0,0,0,0,0,0,0,0], type: "—", note: "No service under normal conditions" },
    ]
  },
  {
    id: "engine_diesel", label: "Engine Bay — Diesel", icon: "🛢️", engineType: "diesel",
    items: [
      { id: "ed1", name: "Engine Oil & Filter", schedule: [1,1,1,1,1,1,1,1,1], type: "R" },
      { id: "ed2", name: "Drive Belts", schedule: [0,0,0,1,0,0,0,1,0], type: "I" },
      { id: "ed3", name: "Air Cleaner Filter", schedule: [1,1,2,1,1,2,1,1,2], type: "C/R" },
      { id: "ed4", name: "Battery Condition", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "ed5", name: "Brake / Clutch Fluid", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "ed6", name: "Engine Coolant", schedule: [1,1,1,1,1,1,1,1,2], type: "I/R", note: "Replace at 90k/6Y" },
      { id: "ed7", name: "Manual Transaxle Fluid", schedule: [0,0,0,0,0,0,0,1,0], type: "I" },
      { id: "ed8", name: "Fuel Filter Cartridge", schedule: [0,0,2,0,2,0,2,0,2], type: "R", note: "Diesel only — every 30k km" },
    ]
  },
  {
    id: "on_floor", label: "Vehicle On Floor", icon: "🔩", engineType: "both",
    items: [
      { id: "f1", name: "Wiper, Wiper Blade & Washer Fluid", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "f2", name: "Brake/Clutch Pedal Free Play, Pipes & Hoses", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "f3", name: "Fuel Filler Cap", schedule: [0,1,1,1,1,1,1,1,1], type: "I" },
      { id: "f4", name: "Climate Control Air Filter", schedule: [1,1,2,1,2,1,2,1,2], type: "C/R" },
      { id: "f5", name: "AC System — Refrigerant & Compressor", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "f6", name: "Cooling System — Water Pump & Hoses", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
    ]
  },
  {
    id: "on_lift", label: "Vehicle On Lift", icon: "🔧", engineType: "both",
    items: [
      { id: "l1", name: "Steering Gear, Rack, Linkage & Boots", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "l2", name: "Exhaust System — Leakages & Damages", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "l3", name: "Fuel Filter (Petrol)", schedule: [0,0,0,1,0,2,0,0,0], type: "I/R" },
      { id: "l4", name: "Charcoal Canister / Vapour Hose (Petrol)", schedule: [0,0,0,0,0,1,0,0,0], type: "I" },
      { id: "l5", name: "Front/Rear Suspension — Linkages & Ball Joints", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "l6", name: "Fuel Lines, Hoses & Connections", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "l7", name: "Drive Shafts & Boots", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "l8", name: "Fluid Leakages (General)", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "l9", name: "Front & Rear Disc/Drum Brakes & Pads", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "l10", name: "Parking Brake Operation", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "l11", name: "Tyre Pressure, Condition & Rotation", schedule: [1,1,1,1,1,1,1,1,1], type: "I+TR" },
    ]
  },
  {
    id: "final", label: "Final Checks", icon: "✅", engineType: "both",
    items: [
      { id: "fc1", name: "Bolts & Nuts on Chassis & Body", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "fc2", name: "Locks & Hinges Lubrication", schedule: [0,1,1,1,1,1,1,1,1], type: "L" },
      { id: "fc3", name: "All Electrical Systems & Drive Belts/Alternator", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "fc4", name: "Warning Lights & GDS System Check", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "fc5", name: "Exterior/Interior Lights, Horn & Gauges", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "fc6", name: "Power Window & Sunroof Operation", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
      { id: "fc7", name: "All Seat Belt Operation", schedule: [1,1,1,1,1,1,1,1,1], type: "I" },
    ]
  }
];

const OBD_PARAMS = [
  { id: "coolant_temp", name: "Coolant Temp", unit: "°C", min: 85, max: 100, danger: 105, icon: "🌡️", group: "engine" },
  { id: "rpm", name: "Idle RPM", unit: "rpm", min: 700, max: 900, danger: 1100, icon: "⚙️", group: "engine" },
  { id: "intake_temp", name: "Intake Air Temp", unit: "°C", min: 20, max: 50, danger: 65, icon: "🌬️", group: "engine" },
  { id: "engine_load", name: "Engine Load", unit: "%", min: 0, max: 80, danger: 95, icon: "💪", group: "engine" },
  { id: "throttle_pos", name: "Throttle Position", unit: "%", min: 0, max: 100, danger: null, icon: "🎚️", group: "engine" },
  { id: "battery_off", name: "Battery (engine off)", unit: "V", min: 12.4, max: 12.7, danger: 12.0, icon: "🔋", group: "electrical" },
  { id: "battery_on", name: "Battery (engine on)", unit: "V", min: 13.7, max: 14.7, danger: 13.5, icon: "⚡", group: "electrical" },
  { id: "fuel_trim_st", name: "Fuel Trim ST", unit: "%", min: -5, max: 5, danger: 10, icon: "⛽", group: "fuel" },
  { id: "fuel_trim_lt", name: "Fuel Trim LT", unit: "%", min: -5, max: 5, danger: 10, icon: "📊", group: "fuel" },
  { id: "fuel_efficiency", name: "Fuel Efficiency", unit: "km/L", min: 10, max: 20, danger: 7, icon: "🚗", group: "fuel" },
];

const DTC_CODES = {
  "P0300": "Random/Multiple Cylinder Misfire Detected",
  "P0171": "System Too Lean (Bank 1) — check for vacuum leak or MAF issue",
  "P0172": "System Too Rich (Bank 1) — check O2 sensor or injectors",
  "P0420": "Catalyst System Efficiency Below Threshold — catalytic converter issue",
  "P0113": "Intake Air Temperature Sensor High Input",
  "P0117": "Engine Coolant Temperature Sensor Low Input",
  "P0301": "Cylinder 1 Misfire Detected",
  "P0302": "Cylinder 2 Misfire Detected",
  "P0303": "Cylinder 3 Misfire Detected",
  "P0304": "Cylinder 4 Misfire Detected",
  "P0340": "Camshaft Position Sensor Circuit Malfunction",
  "P0500": "Vehicle Speed Sensor Malfunction",
  "P0562": "System Voltage Low — check battery/alternator",
  "P0563": "System Voltage High — check voltage regulator",
  "P0101": "Mass Air Flow Sensor Range/Performance Problem",
  "P0401": "EGR Flow Insufficient — common in diesel",
  "P0087": "Fuel Rail/System Pressure Too Low — diesel fuel pump issue",
};

const C = {
  bg: "#0b0e1a", surface: "#131726", card: "#1c2035",
  border: "#262d47", accent: "#f97316",
  green: "#22c55e", red: "#ef4444", yellow: "#eab308",
  blue: "#3b82f6", cyan: "#06b6d4",
  text: "#e2e8f0", muted: "#64748b", dimmed: "#94a3b8",
};

const Badge = ({ color, children }) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}44`,
    borderRadius: 5, padding: "2px 7px", fontSize: 10, fontWeight: 700,
    letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap",
  }}>{children}</span>
);

const Btn = ({ onClick, color = C.accent, children, small, outline, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: outline ? "transparent" : color, color: outline ? color : "#fff",
    border: `1.5px solid ${color}`, borderRadius: 8,
    padding: small ? "5px 12px" : "9px 20px", fontSize: small ? 12 : 14,
    fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, letterSpacing: 0.3,
  }}>{children}</button>
);

const Input = ({ label, value, onChange, type = "text", placeholder, small }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {label && <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>{label}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: small ? "6px 10px" : "9px 12px", color: C.text, fontSize: small ? 12 : 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" }} />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {label && <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>{label}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 14, outline: "none", width: "100%", fontFamily: "inherit" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000aa", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 30px 80px #000000aa" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ── SCHEDULE PAGE ─────────────────────────────────────────────────────────────
function SchedulePage({ engineType }) {
  const [checks, setChecks] = useState({});
  const [selInterval, setSelInterval] = useState(10);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ note: "", date: "", odo: "" });

  useEffect(() => { store.get("schedule_checks").then(d => { if (d) setChecks(d); }); }, []);

  const key = (id, km) => `${id}_${km}`;
  const getStatus = (id, km) => checks[key(id, km)]?.status || "pending";

  const openModal = (item, km) => {
    const ex = checks[key(item.id, km)];
    setForm({ note: ex?.note || "", date: ex?.date || new Date().toISOString().split("T")[0], odo: ex?.odo || "" });
    setModal({ item, km });
  };

  const saveStatus = async (status) => {
    if (!modal) return;
    const k = key(modal.item.id, modal.km);
    const updated = { ...checks, [k]: { status, ...form, updatedAt: new Date().toISOString() } };
    setChecks(updated); await store.set("schedule_checks", updated); setModal(null);
  };

  const filtered = SECTIONS.filter(s => s.engineType === "both" || s.engineType === engineType);
  const idx = INTERVALS.indexOf(selInterval);
  const allDue = filtered.flatMap(s => s.items.filter(i => i.schedule[idx] > 0));
  const done = allDue.filter(i => getStatus(i.id, selInterval) === "done");
  const pct = allDue.length > 0 ? Math.round((done.length / allDue.length) * 100) : 0;

  const typeColor = { "R": C.red, "I": C.blue, "C": C.yellow, "C/R": C.accent, "I/R": C.accent, "L": C.green, "I+TR": C.cyan, "—": C.muted };

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 0.6 }}>SERVICE INTERVAL (km)</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? C.green : pct > 60 ? C.yellow : C.accent }}>{done.length}/{allDue.length} · {pct}%</span>
        </div>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 }}>
          {INTERVALS.map(km => {
            const ki = INTERVALS.indexOf(km);
            const kd = filtered.flatMap(s => s.items.filter(i => i.schedule[ki] > 0));
            const kDone = kd.filter(i => getStatus(i.id, km) === "done");
            const done100 = kd.length > 0 && kDone.length === kd.length;
            return (
              <button key={km} onClick={() => setSelInterval(km)} style={{
                background: selInterval === km ? C.accent : C.card, color: selInterval === km ? "#fff" : done100 ? C.green : C.muted,
                border: `1.5px solid ${selInterval === km ? C.accent : done100 ? C.green + "55" : C.border}`,
                borderRadius: 7, padding: "5px 13px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, position: "relative",
              }}>
                {km}k {done100 && "✓"}
              </button>
            );
          })}
        </div>
        <div style={{ height: 3, background: C.border, borderRadius: 4, marginTop: 10 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? C.green : C.accent, borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ padding: "12px 12px 0" }}>
        {filtered.map(section => {
          const due = section.items.filter(item => item.schedule[idx] > 0);
          if (due.length === 0) return null;
          return (
            <div key={section.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: C.surface, borderRadius: "10px 10px 0 0", borderLeft: `3px solid ${C.accent}` }}>
                <span style={{ fontSize: 15 }}>{section.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.dimmed, letterSpacing: 0.8 }}>{section.label.toUpperCase()}</span>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                {due.map((item, i) => {
                  const status = getStatus(item.id, selInterval);
                  const isR = item.schedule[idx] === 2;
                  const tc = typeColor[item.type] || C.muted;
                  const closed = checks[key(item.id, selInterval)];
                  return (
                    <div key={item.id} onClick={() => openModal(item, selInterval)} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      background: i % 2 === 0 ? C.card : C.surface, cursor: "pointer",
                      borderBottom: i < due.length - 1 ? `1px solid ${C.border}` : "none",
                    }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: status === "done" ? C.green + "22" : status === "skipped" ? C.red + "22" : C.surface, border: `2px solid ${status === "done" ? C.green : status === "skipped" ? C.red : C.border}`, color: status === "done" ? C.green : status === "skipped" ? C.red : C.muted }}>
                        {status === "done" ? "✓" : status === "skipped" ? "✗" : "○"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: status === "done" ? C.muted : C.text, textDecoration: status === "done" ? "line-through" : "none" }}>{item.name}</div>
                        {item.note && <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{item.note}</div>}
                        {closed?.date && <div style={{ fontSize: 10, color: C.green, marginTop: 2 }}>✓ {closed.date}{closed.odo ? ` · ${closed.odo} km` : ""}{closed.note ? ` · ${closed.note.substring(0, 30)}` : ""}</div>}
                      </div>
                      <Badge color={isR ? C.red : tc}>{isR ? "REPLACE" : item.type}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.item.name}>
        {modal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 8 }}><Badge color={C.blue}>{modal.km}k km</Badge><Badge color={C.accent}>{modal.item.type}</Badge></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Closure Date" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
              <Input label="Odometer (km)" type="number" value={form.odo} onChange={v => setForm({ ...form, odo: v })} placeholder="42500" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Notes / Observations</label>
              <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={3} placeholder="Part used, workshop, cost, observations..." style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn onClick={() => saveStatus("done")} color={C.green}>✓ Mark Done</Btn>
              <Btn onClick={() => saveStatus("skipped")} color={C.red} outline>✗ Skip</Btn>
              <Btn onClick={() => saveStatus("pending")} color={C.muted} outline>↺ Reset</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── REPAIRS PAGE ──────────────────────────────────────────────────────────────
function RepairsPage() {
  const [repairs, setRepairs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const blank = { date: new Date().toISOString().split("T")[0], odo: "", part: "", workshop: "", cost: "", category: "mechanical", notes: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => { store.get("repairs").then(d => { if (d) setRepairs(d); }); }, []);

  const save = async () => {
    if (!form.part) return;
    const updated = editId ? repairs.map(r => r.id === editId ? { ...form, id: editId } : r) : [{ ...form, id: Date.now().toString() }, ...repairs];
    setRepairs(updated); await store.set("repairs", updated);
    setShowForm(false); setEditId(null); setForm(blank);
  };

  const del = async (id) => { const u = repairs.filter(r => r.id !== id); setRepairs(u); await store.set("repairs", u); };

  const catColor = { mechanical: C.accent, electrical: C.blue, ac: C.cyan, body: C.yellow, tyre: C.green, other: C.muted };
  const totalCost = repairs.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.6 }}>TOTAL REPAIR SPEND</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.accent, letterSpacing: -0.5 }}>₹{totalCost.toLocaleString("en-IN")}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{repairs.length} entr{repairs.length !== 1 ? "ies" : "y"}</div>
        </div>
        <Btn onClick={() => { setShowForm(true); setEditId(null); setForm(blank); }}>+ Log Repair</Btn>
      </div>

      <div style={{ padding: 12 }}>
        {repairs.length === 0 && (
          <div style={{ textAlign: "center", padding: "70px 20px", color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
            <div style={{ fontSize: 14, color: C.dimmed }}>No repairs logged yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Log repairs, part replacements and workshop visits</div>
          </div>
        )}
        {repairs.map(r => (
          <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${catColor[r.category] || C.muted}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.part}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                  <Badge color={catColor[r.category] || C.muted}>{r.category}</Badge>
                  <span style={{ fontSize: 11, color: C.muted }}>📅 {r.date}</span>
                  {r.odo && <span style={{ fontSize: 11, color: C.muted }}>🚗 {parseInt(r.odo).toLocaleString("en-IN")} km</span>}
                </div>
                {r.workshop && <div style={{ fontSize: 12, color: C.dimmed, marginTop: 5 }}>🏪 {r.workshop}</div>}
                {r.notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 3, fontStyle: "italic" }}>{r.notes}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {r.cost && <div style={{ fontSize: 16, fontWeight: 900, color: C.accent }}>₹{parseFloat(r.cost).toLocaleString("en-IN")}</div>}
                <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                  <Btn small outline color={C.blue} onClick={() => { setForm(r); setEditId(r.id); setShowForm(true); }}>Edit</Btn>
                  <Btn small outline color={C.red} onClick={() => del(r.id)}>Del</Btn>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditId(null); }} title={editId ? "Edit Repair" : "Log Repair"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Part / Work Done *" value={form.part} onChange={v => setForm({ ...form, part: v })} placeholder="e.g. Slave Cylinder Replacement" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Date *" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
            <Input label="Odometer (km)" type="number" value={form.odo} onChange={v => setForm({ ...form, odo: v })} placeholder="42500" />
          </div>
          <Select label="Category" value={form.category} onChange={v => setForm({ ...form, category: v })} options={[
            { value: "mechanical", label: "⚙️ Mechanical" }, { value: "electrical", label: "⚡ Electrical" },
            { value: "ac", label: "❄️ AC / Cooling" }, { value: "body", label: "🚗 Body / Paint" },
            { value: "tyre", label: "🔄 Tyre / Suspension" }, { value: "other", label: "📋 Other" },
          ]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Workshop / Dealer" value={form.workshop} onChange={v => setForm({ ...form, workshop: v })} placeholder="Workshop name" />
            <Input label="Cost (₹)" type="number" value={form.cost} onChange={v => setForm({ ...form, cost: v })} placeholder="12500" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Parts used, warranty, observations..." style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={save} color={C.green}>💾 {editId ? "Update" : "Save Repair"}</Btn>
            <Btn onClick={() => { setShowForm(false); setEditId(null); }} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── DOCS PAGE ─────────────────────────────────────────────────────────────────
function DocsPage() {
  const [docs, setDocs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null);
  const blank = { name: "", category: "service_bill", date: new Date().toISOString().split("T")[0], notes: "", fileData: null, fileName: null, fileType: null };
  const [form, setForm] = useState(blank);
  const fileRef = useRef();

  useEffect(() => { store.get("documents").then(d => { if (d) setDocs(d); }); }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert("File too large. Max 4MB."); return; }
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, fileData: ev.target.result, fileName: file.name, fileType: file.type }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name) return;
    const updated = [{ ...form, id: Date.now().toString() }, ...docs];
    setDocs(updated); await store.set("documents", updated);
    setShowForm(false); setForm(blank);
  };

  const del = async (id) => { const u = docs.filter(d => d.id !== id); setDocs(u); await store.set("documents", u); };

  const catMeta = {
    service_bill: { label: "Service Bill", color: C.accent, icon: "🔧" },
    repair_bill: { label: "Repair Bill", color: C.red, icon: "🛠️" },
    insurance: { label: "Insurance", color: C.green, icon: "🛡️" },
    rc: { label: "RC / Registration", color: C.blue, icon: "📋" },
    puc: { label: "PUC Certificate", color: C.cyan, icon: "💨" },
    warranty: { label: "Warranty", color: C.yellow, icon: "⭐" },
    other: { label: "Other", color: C.muted, icon: "📁" },
  };

  const grouped = {};
  docs.forEach(d => { if (!grouped[d.category]) grouped[d.category] = []; grouped[d.category].push(d); });

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: C.muted }}>{docs.length} document{docs.length !== 1 ? "s" : ""} stored</div>
        <Btn onClick={() => { setShowForm(true); setForm(blank); }}>+ Add Document</Btn>
      </div>

      {docs.length === 0 && (
        <div style={{ textAlign: "center", padding: "70px 20px", color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 14, color: C.dimmed }}>No documents yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Upload service bills, insurance, RC, PUC and warranty docs</div>
        </div>
      )}

      <div style={{ padding: 12 }}>
        {Object.entries(grouped).map(([cat, catDocs]) => {
          const meta = catMeta[cat] || catMeta.other;
          return (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span>{meta.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: meta.color, letterSpacing: 0.8 }}>{meta.label.toUpperCase()} ({catDocs.length})</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {catDocs.map(doc => (
                  <div key={doc.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", borderTop: `3px solid ${meta.color}` }}>
                    <div onClick={() => doc.fileData && setViewing(doc)} style={{ cursor: doc.fileData ? "pointer" : "default" }}>
                      {doc.fileData && doc.fileType?.startsWith("image/") ? (
                        <div style={{ height: 85, overflow: "hidden" }}><img src={doc.fileData} alt={doc.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                      ) : (
                        <div style={{ height: 85, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, fontSize: 34, color: meta.color }}>
                          {doc.fileType?.includes("pdf") ? "📄" : doc.fileData ? "📎" : meta.icon}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{doc.date}</div>
                      {doc.notes && <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.notes}</div>}
                      <button onClick={() => del(doc.id)} style={{ marginTop: 6, background: "none", border: "none", color: C.red, fontSize: 11, cursor: "pointer", padding: 0 }}>🗑 Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Document">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Document Name *" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Service Bill — 40k" />
          <Select label="Category" value={form.category} onChange={v => setForm({ ...form, category: v })} options={Object.entries(catMeta).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))} />
          <Input label="Date" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} />
          <div>
            <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Upload File (Image / PDF · max 4MB)</label>
            <div style={{ marginTop: 8 }}>
              <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} style={{ display: "none" }} />
              <Btn onClick={() => fileRef.current.click()} color={C.blue} outline>
                {form.fileName ? `📎 ${form.fileName.length > 24 ? form.fileName.substring(0, 24) + "…" : form.fileName}` : "📎 Choose File"}
              </Btn>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Amount, validity, remarks..." style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={save} color={C.green}>💾 Save Document</Btn>
            <Btn onClick={() => setShowForm(false)} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name}>
        {viewing && (
          <div>
            {viewing.fileType?.startsWith("image/") && <img src={viewing.fileData} alt={viewing.name} style={{ width: "100%", borderRadius: 8 }} />}
            {viewing.fileType?.includes("pdf") && (
              <div style={{ textAlign: "center", padding: 24 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <a href={viewing.fileData} download={viewing.fileName} style={{ color: C.accent, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>⬇️ Download {viewing.fileName}</a>
              </div>
            )}
            {!viewing.fileData && <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>No file attached to this document</div>}
            {viewing.notes && <div style={{ marginTop: 12, fontSize: 13, color: C.muted, fontStyle: "italic", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>{viewing.notes}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── OBD HEALTH PAGE ───────────────────────────────────────────────────────────
function OBDPage() {
  const [readings, setReadings] = useState([]);
  const [dtcs, setDtcs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDTC, setShowDTC] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({});
  const [dtcForm, setDtcForm] = useState({ code: "", description: "", date: new Date().toISOString().split("T")[0], odo: "", status: "active" });
  const [csvMsg, setCsvMsg] = useState("");
  const [activeGroup, setActiveGroup] = useState("engine");
  const csvRef = useRef();

  useEffect(() => {
    store.get("obd_readings").then(d => { if (d) setReadings(d); });
    store.get("obd_dtcs").then(d => { if (d) setDtcs(d); });
  }, []);

  const getHealth = (param, val) => {
    if (val === "" || val === undefined || val === null) return "unknown";
    const v = parseFloat(val); if (isNaN(v)) return "unknown";
    if (param.danger !== null) {
      if (param.id.includes("trim")) { if (Math.abs(v) > param.danger) return "danger"; }
      else if (param.id === "battery_off" || param.id === "battery_on") { if (v < param.danger) return "danger"; }
      else { if (v >= param.danger) return "danger"; }
    }
    return v >= param.min && v <= param.max ? "good" : "warn";
  };

  const hC = { good: C.green, warn: C.yellow, danger: C.red, unknown: C.muted };
  const hL = { good: "Normal", warn: "Check", danger: "Alert!", unknown: "N/A" };

  const latest = readings[0] || {};
  const scored = OBD_PARAMS.map(p => getHealth(p, latest[p.id])).filter(s => s !== "unknown");
  const score = scored.length === 0 ? null : Math.round((scored.filter(s => s === "good").length / scored.length) * 100);
  const alerts = OBD_PARAMS.filter(p => ["danger","warn"].includes(getHealth(p, latest[p.id])));
  const activeDtcs = dtcs.filter(d => d.status === "active");

  const saveReading = async () => {
    const entry = { ...form, date: form.date || new Date().toISOString().split("T")[0], id: Date.now().toString() };
    const updated = [entry, ...readings];
    setReadings(updated); await store.set("obd_readings", updated);
    setShowForm(false); setForm({});
  };

  const saveDTC = async () => {
    if (!dtcForm.code) return;
    const desc = dtcForm.description || DTC_CODES[dtcForm.code.toUpperCase()] || "Unknown fault code";
    const updated = [{ ...dtcForm, code: dtcForm.code.toUpperCase(), description: desc, id: Date.now().toString() }, ...dtcs];
    setDtcs(updated); await store.set("obd_dtcs", updated);
    setShowDTC(false);
    setDtcForm({ code: "", description: "", date: new Date().toISOString().split("T")[0], odo: "", status: "active" });
  };

  const clearDTC = async (id) => { const u = dtcs.map(d => d.id === id ? { ...d, status: "cleared" } : d); setDtcs(u); await store.set("obd_dtcs", u); };
  const delDTC = async (id) => { const u = dtcs.filter(d => d.id !== id); setDtcs(u); await store.set("obd_dtcs", u); };

  const handleCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const lines = ev.target.result.split("\n").filter(l => l.trim());
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, "_"));
        const paramMap = {
          "engine_coolant_temperature__c_": "coolant_temp", "engine_coolant_temperature": "coolant_temp",
          "engine_rpm__rpm_": "rpm", "engine_rpm": "rpm",
          "battery_voltage__v_": "battery_on", "battery_voltage": "battery_on",
          "intake_air_temp__c_": "intake_temp", "intake_air_temperature__c_": "intake_temp",
          "short_term_fuel_trim_bank_1____": "fuel_trim_st", "long_term_fuel_trim_bank_1____": "fuel_trim_lt",
          "calculated_load_value____": "engine_load", "engine_load____": "engine_load",
          "absolute_throttle_position____": "throttle_pos",
          "fuel_economy__mpg_": "fuel_efficiency",
        };
        const imported = [];
        for (let i = 1; i < Math.min(lines.length, 501); i++) {
          const vals = lines[i].split(",");
          const entry = { id: `csv_${i}_${Date.now()}`, date: new Date().toISOString().split("T")[0] };
          headers.forEach((h, idx) => {
            const mapped = paramMap[h];
            if (mapped) entry[mapped] = vals[idx]?.trim() || "";
            if (h.includes("gps_time") || h.includes("device_time")) { const d = vals[idx]?.split(" ")[0]; if (d) entry.date = d; }
          });
          imported.push(entry);
        }
        const updated = [...imported, ...readings];
        setReadings(updated); await store.set("obd_readings", updated);
        setCsvMsg(`✅ Imported ${imported.length} rows from Torque Pro CSV`);
        setTimeout(() => setCsvMsg(""), 5000);
      } catch { setCsvMsg("❌ Could not parse. Use Torque Pro / Car Scanner CSV export."); setTimeout(() => setCsvMsg(""), 5000); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  const Sparkline = ({ paramId, color }) => {
    const data = readings.slice(0, 12).reverse().map((r, i) => ({ x: i, y: parseFloat(r[paramId]) })).filter(d => !isNaN(d.y));
    if (data.length < 2) return <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>No trend yet</div>;
    const W = 90, H = 26;
    const ys = data.map(d => d.y), lo = Math.min(...ys) * 0.98, hi = Math.max(...ys) * 1.02;
    const px = i => (i / (data.length - 1)) * W;
    const py = v => H - ((v - lo) / ((hi - lo) || 1)) * H;
    return (
      <svg width={W} height={H} style={{ marginTop: 6 }}>
        <polyline points={data.map((d, i) => `${px(i)},${py(d.y)}`).join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" opacity={0.8} />
        <circle cx={px(data.length - 1)} cy={py(data[data.length - 1].y)} r={2.5} fill={color} />
      </svg>
    );
  };

  const groups = ["engine", "electrical", "fuel"];
  const filteredParams = OBD_PARAMS.filter(p => p.group === activeGroup);

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Score header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <div style={{ width: 58, height: 58, borderRadius: "50%", flexShrink: 0, background: `conic-gradient(${score === null ? C.muted : score > 80 ? C.green : score > 50 ? C.yellow : C.red} ${score || 0}%, ${C.border} 0%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: score === null ? C.muted : score > 80 ? C.green : score > 50 ? C.yellow : C.red }}>
              {score === null ? "?" : score}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.6 }}>CAR HEALTH SCORE</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              {score === null ? "No data yet" : score > 80 ? "🟢 All Good" : score > 50 ? "🟡 Monitor Needed" : "🔴 Attention Required"}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{readings.length} readings · {activeDtcs.length} active DTC{activeDtcs.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {alerts.length > 0 && (
          <div style={{ background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.red, letterSpacing: 0.5, marginBottom: 4 }}>⚠️ PARAMETERS OUTSIDE NORMAL RANGE</div>
            {alerts.map(p => <div key={p.id} style={{ fontSize: 12, color: C.dimmed, marginTop: 2 }}>{p.icon} {p.name}: <span style={{ color: hC[getHealth(p, latest[p.id])] }}>{latest[p.id] || "—"} {p.unit}</span></div>)}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn small onClick={() => setShowForm(true)}>+ Manual Entry</Btn>
          <Btn small color={C.blue} outline onClick={() => csvRef.current.click()}>📊 Import CSV</Btn>
          <Btn small color={C.red} outline onClick={() => setShowDTC(true)}>⚠️ Log DTC</Btn>
          {readings.length > 0 && <Btn small color={C.muted} outline onClick={() => setShowHistory(true)}>📜 History ({readings.length})</Btn>}
        </div>
        <input ref={csvRef} type="file" accept=".csv,.CSV" onChange={handleCSV} style={{ display: "none" }} />
      </div>

      {csvMsg && <div style={{ margin: "8px 12px", padding: "10px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }}>{csvMsg}</div>}

      <div style={{ margin: "10px 12px 0", padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        <span style={{ color: C.accent, fontWeight: 700 }}>💡 How to get OBD data:</span> Plug an <span style={{ color: C.text }}>ELM327 Bluetooth dongle</span> into the OBD2 port under your dashboard (driver side). Open <span style={{ color: C.text }}>Torque Pro</span> or <span style={{ color: C.text }}>Car Scanner</span> app, connect, log a trip, then export as CSV → tap <span style={{ color: C.blue }}>Import CSV</span>. Or type readings manually.
      </div>

      {/* Group tabs */}
      <div style={{ padding: "12px 12px 0" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {groups.map(g => (
            <button key={g} onClick={() => setActiveGroup(g)} style={{ background: activeGroup === g ? C.accent : C.card, color: activeGroup === g ? "#fff" : C.muted, border: `1px solid ${activeGroup === g ? C.accent : C.border}`, borderRadius: 7, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", letterSpacing: 0.5 }}>
              {g === "engine" ? "🔥 Engine" : g === "electrical" ? "⚡ Electrical" : "⛽ Fuel"}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
          {filteredParams.map(param => {
            const val = latest[param.id];
            const health = getHealth(param, val);
            const color = hC[health];
            return (
              <div key={param.id} style={{ background: C.card, borderRadius: 12, padding: 14, border: `1px solid ${health === "danger" ? C.red + "88" : health === "warn" ? C.yellow + "55" : C.border}`, boxShadow: health === "danger" ? `0 0 20px ${C.red}22` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20 }}>{param.icon}</span>
                  <Badge color={color}>{hL[health]}</Badge>
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 6 }}>{param.name}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color, marginTop: 2, letterSpacing: -0.5 }}>
                  {val !== undefined && val !== "" ? val : "—"}
                  <span style={{ fontSize: 11, fontWeight: 400, color: C.muted, marginLeft: 3 }}>{param.unit}</span>
                </div>
                <Sparkline paramId={param.id} color={color} />
                <div style={{ marginTop: 5, fontSize: 10, color: C.muted }}>Normal: {param.min}–{param.max} {param.unit}</div>
              </div>
            );
          })}
        </div>
      </div>

      {dtcs.length > 0 && (
        <div style={{ padding: "16px 12px 0" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, letterSpacing: 0.8, marginBottom: 10 }}>FAULT CODES (DTCs)</div>
          {dtcs.map(dtc => (
            <div key={dtc.id} style={{ background: C.card, borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${dtc.status === "active" ? C.red + "55" : C.border}`, borderLeft: `3px solid ${dtc.status === "active" ? C.red : C.green}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: dtc.status === "active" ? C.red : C.green }}>{dtc.code}</span>
                    <Badge color={dtc.status === "active" ? C.red : C.green}>{dtc.status}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: C.dimmed, marginTop: 3 }}>{dtc.description}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>📅 {dtc.date}{dtc.odo && ` · 🚗 ${dtc.odo} km`}</div>
                </div>
                <div style={{ display: "flex", gap: 5, marginLeft: 8 }}>
                  {dtc.status === "active" && <Btn small color={C.green} outline onClick={() => clearDTC(dtc.id)}>Clear</Btn>}
                  <Btn small color={C.red} outline onClick={() => delDTC(dtc.id)}>Del</Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Entry */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Manual OBD Reading">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Date" type="date" value={form.date || new Date().toISOString().split("T")[0]} onChange={v => setForm({ ...form, date: v })} />
            <Input label="Odometer (km)" type="number" value={form.odo || ""} onChange={v => setForm({ ...form, odo: v })} placeholder="42500" />
          </div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.5 }}>READINGS (leave blank if not available)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {OBD_PARAMS.map(p => (
              <Input key={p.id} small label={`${p.icon} ${p.name} (${p.unit})`} type="number" value={form[p.id] || ""} onChange={v => setForm({ ...form, [p.id]: v })} placeholder={`${p.min}–${p.max}`} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={saveReading} color={C.green}>💾 Save Reading</Btn>
            <Btn onClick={() => setShowForm(false)} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* DTC */}
      <Modal open={showDTC} onClose={() => setShowDTC(false)} title="Log Fault Code (DTC)">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="DTC Code (e.g. P0300)" value={dtcForm.code}
            onChange={v => setDtcForm({ ...dtcForm, code: v, description: DTC_CODES[v.toUpperCase()] || dtcForm.description })}
            placeholder="P0300" />
          {DTC_CODES[dtcForm.code?.toUpperCase()] && (
            <div style={{ background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.dimmed }}>⚠️ {DTC_CODES[dtcForm.code.toUpperCase()]}</div>
          )}
          <Input label="Description (auto-filled above, edit if needed)" value={dtcForm.description} onChange={v => setDtcForm({ ...dtcForm, description: v })} placeholder="Fault description" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Date" type="date" value={dtcForm.date} onChange={v => setDtcForm({ ...dtcForm, date: v })} />
            <Input label="Odometer (km)" type="number" value={dtcForm.odo} onChange={v => setDtcForm({ ...dtcForm, odo: v })} placeholder="42500" />
          </div>
          <Select label="Status" value={dtcForm.status} onChange={v => setDtcForm({ ...dtcForm, status: v })}
            options={[{ value: "active", label: "🔴 Active — Check Engine Light On" }, { value: "cleared", label: "🟢 Cleared — Already fixed" }]} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={saveDTC} color={C.red}>⚠️ Log DTC</Btn>
            <Btn onClick={() => setShowDTC(false)} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* History */}
      <Modal open={showHistory} onClose={() => setShowHistory(false)} title={`Reading History (${readings.length})`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
          {readings.slice(0, 50).map(r => (
            <div key={r.id} style={{ background: C.surface, borderRadius: 8, padding: "9px 12px", border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.dimmed }}>📅 {r.date}</span>
                {r.odo && <span style={{ fontSize: 10, color: C.muted }}>🚗 {r.odo} km</span>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {OBD_PARAMS.filter(p => r[p.id] !== undefined && r[p.id] !== "").map(p => (
                  <span key={p.id} style={{ fontSize: 11, color: hC[getHealth(p, r[p.id])] }}>{p.icon} {r[p.id]}{p.unit}</span>
                ))}
              </div>
            </div>
          ))}
          {readings.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>No readings yet</div>}
        </div>
      </Modal>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("schedule");
  const [engineType, setEngineType] = useState("petrol");
  const [carInfo, setCarInfo] = useState({ name: "My Elite i20", year: "2019", odo: "", reg: "" });
  const [showCarInfo, setShowCarInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({});

  useEffect(() => {
    store.get("car_info").then(d => { if (d) setCarInfo(d); });
    store.get("engine_type").then(d => { if (d) setEngineType(d); });
  }, []);

  const saveCarInfo = async () => {
    setCarInfo(infoForm); await store.set("car_info", infoForm);
    if (infoForm.engineType) { setEngineType(infoForm.engineType); await store.set("engine_type", infoForm.engineType); }
    setShowCarInfo(false);
  };

  const tabs = [
    { id: "schedule", icon: "📋", label: "Schedule" },
    { id: "repairs", icon: "🔧", label: "Repairs" },
    { id: "docs", icon: "📁", label: "Docs" },
    { id: "health", icon: "🩺", label: "OBD Health" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", maxWidth: 680, margin: "0 auto" }}>
      {/* Top bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", position: "sticky", top: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.text, letterSpacing: -0.3 }}>🚗 {carInfo.name}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
            {carInfo.year}{carInfo.reg ? ` · ${carInfo.reg}` : ""} · {engineType === "petrol" ? "⛽ Petrol" : "🛢️ Diesel"}
            {carInfo.odo ? ` · ${parseInt(carInfo.odo).toLocaleString("en-IN")} km` : ""}
          </div>
        </div>
        <button onClick={() => { setInfoForm({ ...carInfo, engineType }); setShowCarInfo(true); }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", color: C.muted, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          ⚙️ Car Info
        </button>
      </div>

      {tab === "schedule" && <SchedulePage engineType={engineType} />}
      {tab === "repairs" && <RepairsPage />}
      {tab === "docs" && <DocsPage />}
      {tab === "health" && <OBDPage />}

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 680, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 200 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", padding: "10px 0 8px", color: tab === t.id ? C.accent : C.muted, cursor: "pointer", borderTop: `2px solid ${tab === t.id ? C.accent : "transparent"}` }}>
            <div style={{ fontSize: 18 }}>{t.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, letterSpacing: 0.4 }}>{t.label.toUpperCase()}</div>
          </button>
        ))}
      </div>

      {/* Car Info Modal */}
      <Modal open={showCarInfo} onClose={() => setShowCarInfo(false)} title="Car Information">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Car Name / Nickname" value={infoForm.name || ""} onChange={v => setInfoForm({ ...infoForm, name: v })} placeholder="My Elite i20" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Year" type="number" value={infoForm.year || ""} onChange={v => setInfoForm({ ...infoForm, year: v })} placeholder="2019" />
            <Input label="Current Odometer (km)" type="number" value={infoForm.odo || ""} onChange={v => setInfoForm({ ...infoForm, odo: v })} placeholder="42500" />
          </div>
          <Input label="Registration Number" value={infoForm.reg || ""} onChange={v => setInfoForm({ ...infoForm, reg: v })} placeholder="MH 01 AB 1234" />
          <Select label="Engine Type" value={infoForm.engineType || "petrol"} onChange={v => setInfoForm({ ...infoForm, engineType: v })} options={[
            { value: "petrol", label: "⛽ Petrol (1.2L / 1.4L)" },
            { value: "diesel", label: "🛢️ Diesel (1.4L CRDI)" },
          ]} />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={saveCarInfo} color={C.green}>💾 Save</Btn>
            <Btn onClick={() => setShowCarInfo(false)} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}