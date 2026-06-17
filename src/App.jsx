import { useState, useEffect, useRef } from "react";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const store = {
  async get(key) {
    try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
    catch { return null; }
  },
  async set(key, val) {
    try { await window.storage.set(key, JSON.stringify(val)); } catch {}
  }
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0d16", surface: "#111520", card: "#181e2e",
  border: "#1f2844", borderLight: "#2a3554",
  accent: "#f97316", green: "#22c55e", red: "#ef4444",
  yellow: "#eab308", blue: "#3b82f6", cyan: "#06b6d4", purple: "#a855f7",
  text: "#e8eaf0", muted: "#5a6480", dimmed: "#8892a8",
};

// ─── VEHICLE LOGIC ────────────────────────────────────────────────────────────
function getOilInterval(year) {
  const y = parseInt(year);
  if (y >= 2011) return 10000;
  if (y >= 2000) return 7500;
  return 5000;
}

function needsTimingBelt(year, fuel, timingType) {
  if (timingType === "chain") return false;
  if (timingType === "belt") return true;
  if (fuel === "diesel") return false;
  if (parseInt(year) >= 2015) return false;
  return "unknown";
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function getKmUntilDue(item, currentOdo) {
  if (!item.nextDueKm) return null;
  return item.nextDueKm - currentOdo;
}

function getItemStatus(item, currentOdo) {
  const kmLeft = item.nextDueKm ? getKmUntilDue(item, currentOdo) : null;
  const daysLeft = item.nextDueDate ? getDaysUntil(item.nextDueDate) : null;
  const relevant = kmLeft !== null ? kmLeft : daysLeft;
  if (relevant === null) return "ok";
  if (relevant < 0) return "overdue";
  if (relevant < (item.nextDueKm ? 1000 : 14)) return "due-soon";
  return "ok";
}

function generateSchedule(vehicle) {
  const oilKm = getOilInterval(vehicle.year);
  const hasBelt = needsTimingBelt(vehicle.year, vehicle.fuel, vehicle.timing);
  const isOld = parseInt(vehicle.year) < 2005;
  const today = new Date().toISOString().split("T")[0];

  const items = [
    { id: "oil", name: "Engine Oil & Filter", intervalKm: oilKm, intervalMonths: null, type: "replace", notes: `${oilKm / 1000}k km interval based on ${vehicle.year} model year`, category: "engine" },
    { id: "airfilter", name: "Air Filter", intervalKm: 20000, intervalMonths: null, type: "inspect", notes: "Clean at 20k km · Replace at 40k km", category: "engine" },
    { id: "cabinfilter", name: "Cabin Air Filter", intervalKm: 15000, intervalMonths: null, type: "clean", notes: "Clean at 15k km · Replace at 30k km", category: "cabin" },
    { id: "brakefluid", name: "Brake Fluid", intervalKm: null, intervalMonths: 24, type: "replace", notes: "Replace every 2 years — absorbs moisture regardless of km", category: "brakes" },
    { id: "coolant", name: "Engine Coolant", intervalKm: isOld ? 40000 : 60000, intervalMonths: null, type: "inspect", notes: `Inspect at ${isOld ? 40 : 60}k km · Replace at ${isOld ? 60 : 80}k km`, category: "engine" },
    { id: "brakepads", name: "Brake Pads / Shoes", intervalKm: 30000, intervalMonths: null, type: "inspect", notes: "Check thickness — replace if under 3mm", category: "brakes" },
    { id: "tyrerotation", name: "Tyre Rotation & Pressure", intervalKm: 10000, intervalMonths: null, type: "rotate", notes: "Rotate and check pressure + tread depth every 10k km", category: "tyres" },
    { id: "battery", name: "Battery Health", intervalKm: null, intervalMonths: 12, type: "inspect", notes: "Check terminals, voltage, and electrolyte level annually", category: "electrical" },
    { id: "wipers", name: "Wiper Blades", intervalKm: null, intervalMonths: 12, type: "replace", notes: "Replace annually or when smearing / streaking noticed", category: "cabin" },
    { id: "drivebelts", name: "Drive Belts / Alternator Belt", intervalKm: 60000, intervalMonths: null, type: "inspect", notes: "Check for cracks, glazing, and tension at 60k km", category: "engine" },
    { id: "fuelfilter", name: "Fuel Filter", intervalKm: vehicle.fuel === "diesel" ? 30000 : 40000, intervalMonths: null, type: "replace", notes: vehicle.fuel === "diesel" ? "Diesel — replace every 30k km" : "Petrol — replace every 40k km", category: "fuel" },
    { id: "exhaustcheck", name: "Exhaust System", intervalKm: 20000, intervalMonths: null, type: "inspect", notes: "Check for leaks, rust, loose hangers", category: "engine" },
    { id: "tyrereplace", name: "Tyre Condition & Age", intervalKm: 40000, intervalMonths: null, type: "inspect", notes: "Check tread depth (replace under 1.6mm) and age (replace after 5 years)", category: "tyres" },
    { id: "acservice", name: "AC Service & Refrigerant", intervalKm: null, intervalMonths: 12, type: "inspect", notes: "Check cooling performance and refrigerant level every season", category: "cabin" },
    { id: "sparkplugs", name: "Spark Plugs", intervalKm: 40000, intervalMonths: null, type: "replace", notes: "Standard plugs 40k · Iridium plugs up to 80k km", category: "engine", skipFor: "diesel" },
  ];

  if (vehicle.fuel === "diesel") {
    items.push({ id: "glowplugs", name: "Glow Plugs", intervalKm: 60000, intervalMonths: null, type: "inspect", notes: "Check at 60k km — symptoms: hard starting in cold weather", category: "engine" });
  }

  if (hasBelt === true) {
    items.push({ id: "timingbelt", name: "Timing Belt", intervalKm: 60000, intervalMonths: null, type: "replace", notes: "⚠️ CRITICAL — engine damage if missed. Replace at 60k km or 5 years whichever comes first.", category: "engine" });
  } else if (hasBelt === "unknown") {
    items.push({ id: "timingbelt", name: "Timing Belt (Verify)", intervalKm: 60000, intervalMonths: null, type: "replace", notes: "❓ Verify with owner manual — petrol cars before 2015 may have a belt. If confirmed chain, disable this item.", category: "engine" });
  }

  if (vehicle.gearbox === "auto") {
    items.push({ id: "atfluid", name: "Automatic Transmission Fluid", intervalKm: 60000, intervalMonths: null, type: "replace", notes: "Replace at 60k km — skipping causes expensive damage", category: "transmission" });
  } else if (vehicle.gearbox === "cvt") {
    items.push({ id: "cvtfluid", name: "CVT Fluid", intervalKm: 40000, intervalMonths: null, type: "replace", notes: "Replace at 40k km — critical for CVT longevity", category: "transmission" });
  } else if (vehicle.gearbox === "dct") {
    items.push({ id: "dctfluid", name: "DCT / DSG Fluid", intervalKm: 60000, intervalMonths: null, type: "replace", notes: "Replace at 60k km — often skipped causing gear hesitation", category: "transmission" });
  } else {
    items.push({ id: "gearboxoil", name: "Manual Gearbox Oil", intervalKm: 80000, intervalMonths: null, type: "inspect", notes: "Check level at 80k km — replace if discolored or contaminated", category: "transmission" });
  }

  return items
    .filter(i => !i.skipFor || i.skipFor !== vehicle.fuel)
    .map((item, idx) => ({
      ...item,
      order: idx,
      isBuiltIn: true,
      isActive: true,
      lastDoneKm: null,
      lastDoneDate: null,
      nextDueKm: item.intervalKm ? (vehicle.odo || 0) + item.intervalKm : null,
      nextDueDate: item.intervalMonths ? addMonths(new Date(), item.intervalMonths).toISOString().split("T")[0] : null,
    }));
}

// ─── SYMPTOMS DATA ────────────────────────────────────────────────────────────
const SYMPTOM_SYSTEMS = {
  clutch: {
    label: "Clutch", icon: "🔄", color: C.purple,
    symptoms: [
      "Clutch slipping — engine revs but car doesn't accelerate",
      "High biting point — pedal nearly fully released before engaging",
      "Difficulty engaging or changing gears",
      "Grinding or crunching when shifting gears",
      "Spongy or soft clutch pedal feel",
      "Pedal going all the way to the floor",
      "Burning smell after hill starts or heavy traffic",
      "Vibration or judder when releasing clutch",
      "Clutch pedal sticking or not returning properly",
    ]
  },
  gearbox: {
    label: "Gearbox", icon: "⚙️", color: C.cyan,
    symptoms: [
      "Gear popping out on its own — especially 2nd or 3rd",
      "Grinding or crunching when changing gears",
      "Difficulty getting into reverse gear",
      "Whining or humming noise in specific gears",
      "Gear lever feels loose, wobbly, or vague",
      "Hard to select gears, especially when engine is cold",
      "Gearbox making noise when in neutral",
      "Gear jumps out under hard acceleration",
    ]
  },
  suspension: {
    label: "Suspension", icon: "🚗", color: C.yellow,
    symptoms: [
      "Car bouncing excessively after going over bumps",
      "Pulling to one side while driving straight or braking",
      "Uneven tyre wear — inner or outer edge worn more than center",
      "Clunking or knocking sound when going over bumps",
      "Car nose-diving heavily under braking",
      "Steering feels vague, loose, or imprecise at highway speeds",
      "Squeaking from corners or wheel area over bumps",
      "Car sitting noticeably lower on one side",
      "Excessive body roll when cornering",
    ]
  }
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Badge = ({ color, children, small }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 5, padding: small ? "1px 6px" : "2px 8px", fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</span>
);

const Btn = ({ onClick, color = C.accent, children, small, outline, disabled, full }) => (
  <button onClick={onClick} disabled={disabled} style={{ background: outline ? "transparent" : color, color: outline ? color : "#fff", border: `1.5px solid ${color}`, borderRadius: 8, padding: small ? "5px 12px" : "9px 20px", fontSize: small ? 11 : 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, letterSpacing: 0.3, width: full ? "100%" : "auto", fontFamily: "inherit" }}>{children}</button>
);

const Field = ({ label, value, onChange, type = "text", placeholder, small, required }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {label && <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>{label}{required && <span style={{ color: C.red }}> *</span>}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: small ? "6px 10px" : "9px 12px", color: C.text, fontSize: small ? 12 : 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" }} />
  </div>
);

const Dropdown = ({ label, value, onChange, options, required }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {label && <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>{label}{required && <span style={{ color: C.red }}> *</span>}</label>}
    <select value={value} onChange={e => onChange(e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 14, outline: "none", width: "100%", fontFamily: "inherit" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000bb", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: wide ? 640 : 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 40px 100px #000000cc" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Divider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
    <div style={{ flex: 1, height: 1, background: C.border }} />
    {label && <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.6 }}>{label}</span>}
    <div style={{ flex: 1, height: 1, background: C.border }} />
  </div>
);

// ─── VEHICLE FORM ─────────────────────────────────────────────────────────────
function VehicleForm({ initial, onSave, onCancel }) {
  const blank = { make: "", model: "", year: new Date().getFullYear().toString(), fuel: "petrol", gearbox: "manual", timing: "unknown", reg: "", odo: "" };
  const [form, setForm] = useState(initial || blank);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const oilInterval = form.year ? getOilInterval(parseInt(form.year)) : null;
  const beltStatus = form.year && form.fuel ? needsTimingBelt(parseInt(form.year), form.fuel, form.timing) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Make (Brand)" required value={form.make} onChange={v => f("make", v)} placeholder="e.g. Hyundai" />
        <Field label="Model" required value={form.model} onChange={v => f("model", v)} placeholder="e.g. Elite i20" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Year of Manufacture" required type="number" value={form.year} onChange={v => f("year", v)} placeholder="e.g. 2019" />
        <Field label="Registration No." value={form.reg} onChange={v => f("reg", v)} placeholder="KA 01 AB 1234" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Dropdown label="Fuel" required value={form.fuel} onChange={v => f("fuel", v)} options={[
          { value: "petrol", label: "⛽ Petrol" }, { value: "diesel", label: "🛢️ Diesel" },
          { value: "cng", label: "🟢 CNG" }, { value: "electric", label: "⚡ EV" },
        ]} />
        <Dropdown label="Gearbox" required value={form.gearbox} onChange={v => f("gearbox", v)} options={[
          { value: "manual", label: "Manual" }, { value: "auto", label: "Automatic" },
          { value: "cvt", label: "CVT" }, { value: "dct", label: "DCT/DSG" }, { value: "amt", label: "AMT" },
        ]} />
        <Dropdown label="Timing" value={form.timing} onChange={v => f("timing", v)} options={[
          { value: "unknown", label: "Don't know" }, { value: "chain", label: "⛓ Chain" }, { value: "belt", label: "🔄 Belt" },
        ]} />
      </div>
      <Field label="Current Odometer (km)" type="number" value={form.odo} onChange={v => f("odo", v)} placeholder="e.g. 42500" />

      {oilInterval && (
        <div style={{ padding: "12px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: 0.6, marginBottom: 8 }}>📋 SCHEDULE PREVIEW FOR THIS VEHICLE</div>
          <div style={{ fontSize: 12, color: C.dimmed, lineHeight: 2 }}>
            <div>🛢️ Oil change: <span style={{ color: C.text, fontWeight: 700 }}>every {oilInterval / 1000}k km</span> <span style={{ color: C.muted }}>(year {form.year} rule)</span></div>
            {beltStatus === true && <div style={{ color: C.red }}>⚠️ Timing belt: <span style={{ fontWeight: 700 }}>replace at 60,000 km</span> — engine damage risk if missed</div>}
            {beltStatus === "unknown" && <div style={{ color: C.yellow }}>❓ Timing type unclear — item added to verify with owner manual</div>}
            {beltStatus === false && <div style={{ color: C.green }}>✓ Timing chain assumed — no replacement scheduled</div>}
            <div>⚙️ {form.gearbox === "cvt" ? "CVT fluid: every 40k km" : form.gearbox === "auto" ? "AT fluid: every 60k km" : form.gearbox === "dct" ? "DCT fluid: every 60k km" : form.gearbox === "amt" ? "AMT fluid: check at 80k km" : "Gearbox oil: check at 80k km"}</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={() => { if (!form.make || !form.model || !form.year) return; onSave(form); }} color={C.green}>💾 {initial ? "Update Vehicle" : "Add to Garage"}</Btn>
        <Btn onClick={onCancel} color={C.muted} outline>Cancel</Btn>
      </div>
    </div>
  );
}

// ─── GARAGE PAGE ──────────────────────────────────────────────────────────────
function GaragePage({ vehicles, schedules, workshopVisits, onSelect, onAdd, onEdit }) {
  const getAlerts = (v) => {
    const items = (schedules[v.id] || []).filter(i => i.isActive);
    return {
      overdue: items.filter(i => getItemStatus(i, v.odo) === "overdue").length,
      dueSoon: items.filter(i => getItemStatus(i, v.odo) === "due-soon").length,
    };
  };

  const getNextVisit = (id) => {
    const upcoming = (workshopVisits[id] || []).filter(v => v.status === "upcoming");
    if (!upcoming.length) return null;
    return upcoming.sort((a, b) => new Date(a.tentativeDate) - new Date(b.tentativeDate))[0];
  };

  return (
    <div style={{ padding: "16px 12px 80px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -1 }}>
          <span style={{ color: C.accent }}>Track</span><span style={{ color: C.text }}>N</span><span style={{ color: C.green }}>Save</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Track your vehicle · Save on repairs</div>
      </div>

      {vehicles.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: C.surface, borderRadius: 16, border: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🚗</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 8 }}>Your garage is empty</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>Add your vehicle to start tracking maintenance and avoid costly repairs</div>
          <Btn onClick={onAdd}>+ Add Your First Vehicle</Btn>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.7 }}>MY GARAGE — {vehicles.length} VEHICLE{vehicles.length !== 1 ? "S" : ""}</span>
            <Btn small onClick={onAdd}>+ Add Vehicle</Btn>
          </div>

          {vehicles.map(v => {
            const alerts = getAlerts(v);
            const visit = getNextVisit(v.id);
            const daysToVisit = visit ? getDaysUntil(visit.tentativeDate) : null;
            const hColor = alerts.overdue > 0 ? C.red : alerts.dueSoon > 0 ? C.yellow : C.green;
            const hLabel = alerts.overdue > 0 ? "Overdue" : alerts.dueSoon > 0 ? "Due Soon" : "On Track";

            return (
              <div key={v.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${hColor}`, borderRadius: 14, marginBottom: 12, overflow: "hidden" }}>
                <div onClick={() => onSelect(v)} style={{ padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{v.make} {v.model}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                        <Badge color={C.blue}>{v.year}</Badge>
                        <Badge color={v.fuel === "petrol" ? C.accent : v.fuel === "diesel" ? C.yellow : C.green}>{v.fuel}</Badge>
                        <Badge color={C.muted}>{v.gearbox}</Badge>
                        {v.reg && <span style={{ fontSize: 11, color: C.muted }}>· {v.reg}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.dimmed, marginTop: 6 }}>
                        🚗 {v.odo ? parseInt(v.odo).toLocaleString("en-IN") + " km" : "Odometer not set"}
                        <span style={{ color: C.muted }}> · Oil every {getOilInterval(v.year) / 1000}k km</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <Badge color={hColor}>{hLabel}</Badge>
                      {alerts.overdue > 0 && <div style={{ fontSize: 10, color: C.red, marginTop: 4 }}>{alerts.overdue} item{alerts.overdue !== 1 ? "s" : ""} overdue</div>}
                      {alerts.dueSoon > 0 && <div style={{ fontSize: 10, color: C.yellow, marginTop: 2 }}>{alerts.dueSoon} due soon</div>}
                    </div>
                  </div>

                  {visit && (
                    <div style={{ marginTop: 10, padding: "7px 10px", background: C.surface, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, color: C.dimmed }}>🏪 {visit.workshop || "Workshop visit planned"}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: daysToVisit < 7 ? C.red : daysToVisit < 14 ? C.yellow : C.green }}>
                        {daysToVisit < 0 ? "Overdue" : daysToVisit === 0 ? "Today!" : `${daysToVisit}d away`}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, display: "flex" }}>
                  <button onClick={() => onSelect(v)} style={{ flex: 2, background: "none", border: "none", padding: "9px", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Open Vehicle →</button>
                  <button onClick={() => onEdit(v)} style={{ flex: 1, background: "none", border: "none", padding: "9px", color: C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer", borderLeft: `1px solid ${C.border}` }}>✏️ Edit</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── SCHEDULE PAGE ────────────────────────────────────────────────────────────
function SchedulePage({ vehicle, schedule, onUpdate }) {
  const [items, setItems] = useState(schedule || []);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [doneForm, setDoneForm] = useState({ date: "", odo: "", cost: "", notes: "", workshop: "" });
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");

  useEffect(() => setItems(schedule || []), [schedule]);

  const persist = async (updated) => { setItems(updated); await onUpdate(updated); };

  const markDone = async () => {
    const odo = parseFloat(doneForm.odo) || vehicle.odo || 0;
    const updated = items.map(i => {
      if (i.id !== selected.id) return i;
      return {
        ...i,
        lastDoneKm: odo, lastDoneDate: doneForm.date,
        nextDueKm: i.intervalKm ? odo + i.intervalKm : i.nextDueKm,
        nextDueDate: i.intervalMonths ? addMonths(new Date(doneForm.date || new Date()), i.intervalMonths).toISOString().split("T")[0] : i.nextDueDate,
        lastCost: doneForm.cost, lastWorkshop: doneForm.workshop, lastNotes: doneForm.notes,
      };
    });
    await persist(updated); setModal(null);
  };

  const saveEdit = async () => {
    const updated = items.map(i => i.id === editForm.id ? { ...i, ...editForm, intervalKm: editForm.intervalKm ? parseInt(editForm.intervalKm) : null, intervalMonths: editForm.intervalMonths ? parseInt(editForm.intervalMonths) : null } : i);
    await persist(updated); setModal(null);
  };

  const addItem = async () => {
    if (!editForm.name) return;
    const newItem = {
      id: `custom_${Date.now()}`, name: editForm.name,
      intervalKm: editForm.intervalKm ? parseInt(editForm.intervalKm) : null,
      intervalMonths: editForm.intervalMonths ? parseInt(editForm.intervalMonths) : null,
      type: editForm.type || "inspect", notes: editForm.notes || "",
      category: editForm.category || "other",
      isBuiltIn: false, isActive: true,
      lastDoneKm: null, lastDoneDate: null,
      nextDueKm: editForm.intervalKm ? (vehicle.odo || 0) + parseInt(editForm.intervalKm) : null,
      nextDueDate: editForm.intervalMonths ? addMonths(new Date(), parseInt(editForm.intervalMonths)).toISOString().split("T")[0] : null,
      order: items.length,
    };
    await persist([...items, newItem]); setModal(null); setEditForm({});
  };

  const toggleActive = async (id) => persist(items.map(i => i.id === id ? { ...i, isActive: !i.isActive } : i));
  const deleteItem = async (id) => persist(items.filter(i => i.id !== id));

  const typeColor = { replace: C.red, inspect: C.blue, clean: C.yellow, rotate: C.cyan, lubricate: C.green };
  const statusColor = { overdue: C.red, "due-soon": C.yellow, ok: C.green };
  const cats = ["all", ...new Set(items.map(i => i.category).filter(Boolean))];

  const filtered = items
    .filter(i => catFilter === "all" || i.category === catFilter)
    .filter(i => {
      const s = getItemStatus(i, vehicle.odo);
      if (filter === "overdue") return s === "overdue";
      if (filter === "due-soon") return s === "due-soon" || s === "overdue";
      return true;
    })
    .sort((a, b) => {
      const order = { overdue: 0, "due-soon": 1, ok: 2 };
      return (order[getItemStatus(a, vehicle.odo)] || 2) - (order[getItemStatus(b, vehicle.odo)] || 2);
    });

  const overdueN = items.filter(i => i.isActive && getItemStatus(i, vehicle.odo) === "overdue").length;
  const dueSoonN = items.filter(i => i.isActive && getItemStatus(i, vehicle.odo) === "due-soon").length;

  const EditFields = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Item Name" required value={editForm.name || ""} onChange={v => setEditForm(p => ({ ...p, name: v }))} placeholder="e.g. Differential Oil Check" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Interval — km (blank if time-based)" type="number" value={editForm.intervalKm || ""} onChange={v => setEditForm(p => ({ ...p, intervalKm: v }))} placeholder="e.g. 10000" />
        <Field label="Interval — months (blank if km-based)" type="number" value={editForm.intervalMonths || ""} onChange={v => setEditForm(p => ({ ...p, intervalMonths: v }))} placeholder="e.g. 12" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Dropdown label="Type" value={editForm.type || "inspect"} onChange={v => setEditForm(p => ({ ...p, type: v }))} options={[
          { value: "inspect", label: "🔍 Inspect" }, { value: "replace", label: "🔄 Replace" },
          { value: "clean", label: "🧹 Clean" }, { value: "rotate", label: "↻ Rotate" }, { value: "lubricate", label: "💧 Lubricate" },
        ]} />
        <Dropdown label="Category" value={editForm.category || "other"} onChange={v => setEditForm(p => ({ ...p, category: v }))} options={[
          { value: "engine", label: "Engine" }, { value: "brakes", label: "Brakes" }, { value: "tyres", label: "Tyres" },
          { value: "cabin", label: "Cabin" }, { value: "electrical", label: "Electrical" }, { value: "transmission", label: "Transmission" },
          { value: "fuel", label: "Fuel" }, { value: "other", label: "Other" },
        ]} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Notes</label>
        <textarea value={editForm.notes || ""} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Description, warning signs, what to check for..." style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{vehicle.make} {vehicle.model} · {vehicle.year}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              🚗 {vehicle.odo ? parseInt(vehicle.odo).toLocaleString("en-IN") + " km" : "Odometer not set"} · {items.length} items tracked
            </div>
          </div>
          <Btn small onClick={() => { setEditForm({ name: "", intervalKm: "", intervalMonths: "", type: "inspect", category: "other", notes: "" }); setModal("add"); }}>+ Add Item</Btn>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[{ k: "all", l: `All (${items.length})`, c: C.blue }, { k: "overdue", l: `Overdue (${overdueN})`, c: C.red }, { k: "due-soon", l: `Due Soon (${dueSoonN})`, c: C.yellow }].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{ background: filter === f.k ? f.c + "22" : "transparent", color: filter === f.k ? f.c : C.muted, border: `1px solid ${filter === f.k ? f.c : C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{f.l}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 }}>
          {cats.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)} style={{ background: catFilter === cat ? C.accent + "22" : "transparent", color: catFilter === cat ? C.accent : C.muted, border: `1px solid ${catFilter === cat ? C.accent : C.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, textTransform: "capitalize" }}>{cat}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 12px 0" }}>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: C.muted }}>No items match this filter</div>}
        {filtered.map(item => {
          const status = getItemStatus(item, vehicle.odo);
          const kmLeft = item.nextDueKm ? getKmUntilDue(item, vehicle.odo) : null;
          const daysLeft = item.nextDueDate ? getDaysUntil(item.nextDueDate) : null;
          const sc = statusColor[status] || C.muted;
          return (
            <div key={item.id} style={{ background: C.card, border: `1px solid ${status === "overdue" ? C.red + "55" : C.border}`, borderLeft: `3px solid ${sc}`, borderRadius: 12, marginBottom: 10, opacity: item.isActive ? 1 : 0.4 }}>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: item.isActive ? C.text : C.muted }}>{item.name}</span>
                      {!item.isBuiltIn && <Badge color={C.purple} small>Custom</Badge>}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <Badge color={typeColor[item.type] || C.muted}>{item.type}</Badge>
                      {item.intervalKm && <span style={{ fontSize: 10, color: C.muted }}>Every {item.intervalKm / 1000}k km</span>}
                      {item.intervalMonths && <span style={{ fontSize: 10, color: C.muted }}>Every {item.intervalMonths} months</span>}
                    </div>
                    {item.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: "italic", lineHeight: 1.5 }}>{item.notes}</div>}
                    {item.lastDoneKm && (
                      <div style={{ fontSize: 10, color: C.green, marginTop: 5 }}>
                        ✓ Last done: {parseInt(item.lastDoneKm).toLocaleString("en-IN")} km · {item.lastDoneDate}
                        {item.lastCost && ` · ₹${parseFloat(item.lastCost).toLocaleString("en-IN")}`}
                        {item.lastWorkshop && ` · ${item.lastWorkshop}`}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                    <Badge color={sc}>{status === "overdue" ? "Overdue" : status === "due-soon" ? "Due Soon" : "OK"}</Badge>
                    {kmLeft !== null && <div style={{ fontSize: 11, fontWeight: 700, color: sc, marginTop: 4 }}>{kmLeft < 0 ? `${Math.abs(kmLeft).toLocaleString("en-IN")} km over` : `${kmLeft.toLocaleString("en-IN")} km left`}</div>}
                    {daysLeft !== null && <div style={{ fontSize: 11, fontWeight: 700, color: sc, marginTop: 2 }}>{daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}</div>}
                    {item.nextDueKm && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Due at {parseInt(item.nextDueKm).toLocaleString("en-IN")} km</div>}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, display: "flex" }}>
                <button onClick={() => { setSelected(item); setDoneForm({ date: new Date().toISOString().split("T")[0], odo: vehicle.odo || "", cost: "", notes: "", workshop: "" }); setModal("done"); }} style={{ flex: 1, background: "none", border: "none", padding: "8px", color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✓ Done</button>
                <button onClick={() => { setEditForm({ ...item, intervalKm: item.intervalKm || "", intervalMonths: item.intervalMonths || "" }); setModal("edit"); }} style={{ flex: 1, background: "none", border: "none", padding: "8px", color: C.blue, fontSize: 11, fontWeight: 600, cursor: "pointer", borderLeft: `1px solid ${C.border}` }}>✏️ Edit</button>
                <button onClick={() => toggleActive(item.id)} style={{ flex: 1, background: "none", border: "none", padding: "8px", color: C.muted, fontSize: 11, cursor: "pointer", borderLeft: `1px solid ${C.border}` }}>{item.isActive ? "⊘ Off" : "✓ On"}</button>
                {!item.isBuiltIn && <button onClick={() => deleteItem(item.id)} style={{ flex: 1, background: "none", border: "none", padding: "8px", color: C.red, fontSize: 11, cursor: "pointer", borderLeft: `1px solid ${C.border}` }}>🗑</button>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modal === "done"} onClose={() => setModal(null)} title={`Mark Done: ${selected?.name}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date Done" type="date" value={doneForm.date} onChange={v => setDoneForm(p => ({ ...p, date: v }))} />
            <Field label="Odometer (km)" type="number" value={doneForm.odo} onChange={v => setDoneForm(p => ({ ...p, odo: v }))} placeholder={vehicle.odo} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Workshop / Dealer" value={doneForm.workshop} onChange={v => setDoneForm(p => ({ ...p, workshop: v }))} placeholder="Workshop name" />
            <Field label="Cost (₹)" type="number" value={doneForm.cost} onChange={v => setDoneForm(p => ({ ...p, cost: v }))} placeholder="0" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Notes / Observations</label>
            <textarea value={doneForm.notes} onChange={e => setDoneForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Part brand used, mechanic recommendations, observations..." style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={markDone} color={C.green}>✓ Save & Update Schedule</Btn>
            <Btn onClick={() => setModal(null)} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "edit"} onClose={() => setModal(null)} title={`Edit: ${editForm.name}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <EditFields />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={saveEdit} color={C.green}>💾 Save Changes</Btn>
            <Btn onClick={() => setModal(null)} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "add"} onClose={() => setModal(null)} title="Add Custom Item">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <EditFields />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={addItem} color={C.green}>+ Add Item</Btn>
            <Btn onClick={() => setModal(null)} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── HEALTH PAGE ──────────────────────────────────────────────────────────────
function HealthPage({ vehicle, symptoms, onUpdate, onPushToWorkshop }) {
  const [activeSystem, setActiveSystem] = useState("clutch");
  const [logModal, setLogModal] = useState(null);
  const [logForm, setLogForm] = useState({ severity: "mild", notes: "", date: new Date().toISOString().split("T")[0], odo: "" });
  const [historyModal, setHistoryModal] = useState(null);

  const logs = symptoms || {};

  const logSymptom = async (symptomText) => {
    const entry = { id: Date.now().toString(), system: activeSystem, symptom: symptomText, severity: logForm.severity, notes: logForm.notes, date: logForm.date, odo: logForm.odo || vehicle.odo, workshopFlagged: logForm.severity === "severe" };
    const updated = { ...logs, [activeSystem]: [entry, ...(logs[activeSystem] || [])] };
    await onUpdate(updated);
    if (logForm.severity === "severe") onPushToWorkshop({ system: activeSystem, symptom: symptomText });
    setLogModal(null);
    setLogForm({ severity: "mild", notes: "", date: new Date().toISOString().split("T")[0], odo: "" });
  };

  const getSystemHealth = (key) => {
    const recent = (logs[key] || []).filter(l => getDaysUntil(l.date) > -90);
    const severe = recent.filter(l => l.severity === "severe").length;
    const mod = recent.filter(l => l.severity === "moderate").length;
    if (severe > 0) return { color: C.red, label: "Urgent" };
    if (mod >= 2) return { color: C.red, label: "Attention" };
    if (mod >= 1 || recent.length >= 3) return { color: C.yellow, label: "Monitor" };
    if (recent.length >= 1) return { color: C.yellow, label: "Watch" };
    return { color: C.green, label: "OK" };
  };

  const sys = SYMPTOM_SYSTEMS[activeSystem];
  const sysLogs = logs[activeSystem] || [];
  const sysHealth = getSystemHealth(activeSystem);

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: 16 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
          Log symptoms as you notice them. We track patterns and flag when a workshop visit is needed.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(SYMPTOM_SYSTEMS).map(([key, s]) => {
            const h = getSystemHealth(key);
            const active = activeSystem === key;
            return (
              <button key={key} onClick={() => setActiveSystem(key)} style={{ flex: 1, background: active ? h.color + "18" : C.card, border: `1.5px solid ${active ? h.color : C.border}`, borderRadius: 10, padding: "10px 6px", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 22 }}>{s.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: active ? h.color : C.muted, marginTop: 3 }}>{s.label.toUpperCase()}</div>
                <div style={{ marginTop: 5 }}><Badge color={h.color} small>{h.label}</Badge></div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>{(logs[key] || []).length} logged</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "12px 12px 0" }}>
        {sysLogs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.7 }}>RECENT OBSERVATIONS ({sysLogs.length})</span>
              <button onClick={() => setHistoryModal(activeSystem)} style={{ background: "none", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View All →</button>
            </div>
            {sysLogs.slice(0, 3).map(log => (
              <div key={log.id} style={{ background: C.card, borderLeft: `3px solid ${log.severity === "severe" ? C.red : log.severity === "moderate" ? C.yellow : C.green}`, border: `1px solid ${log.severity === "severe" ? C.red + "44" : C.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{log.symptom}</div>
                    {log.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 3, fontStyle: "italic" }}>{log.notes}</div>}
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>📅 {log.date}{log.odo && ` · 🚗 ${log.odo} km`}</div>
                  </div>
                  <Badge color={log.severity === "severe" ? C.red : log.severity === "moderate" ? C.yellow : C.green}>{log.severity}</Badge>
                </div>
                {log.workshopFlagged && <div style={{ fontSize: 10, color: C.red, marginTop: 5 }}>⚠️ Flagged for workshop visit</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.7 }}>{sys.icon} {sys.label.toUpperCase()} — TAP A SYMPTOM TO LOG IT</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {sys.symptoms.map((symptom, i) => {
            const recentlyLogged = sysLogs.some(l => l.symptom === symptom && getDaysUntil(l.date) > -30);
            return (
              <div key={i} onClick={() => { setLogModal(symptom); setLogForm({ severity: "mild", notes: "", date: new Date().toISOString().split("T")[0], odo: vehicle.odo || "" }); }}
                style={{ background: recentlyLogged ? C.yellow + "0e" : C.card, border: `1px solid ${recentlyLogged ? C.yellow + "44" : C.border}`, borderRadius: 10, padding: "11px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.text, flex: 1, lineHeight: 1.4 }}>{symptom}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 10 }}>
                  {recentlyLogged && <Badge color={C.yellow} small>Logged</Badge>}
                  <span style={{ color: C.accent, fontSize: 18, fontWeight: 300, lineHeight: 1 }}>+</span>
                </div>
              </div>
            );
          })}
        </div>

        {sysHealth.label !== "OK" && (
          <div style={{ marginTop: 16, padding: 14, background: C.red + "0f", border: `1px solid ${C.red}33`, borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 8 }}>⚠️ {sys.label} issues detected — workshop visit recommended</div>
            <Btn small color={C.red} onClick={() => onPushToWorkshop({ system: activeSystem, reason: `${sys.label} symptoms flagged` })}>
              Schedule Workshop Visit →
            </Btn>
          </div>
        )}
      </div>

      <Modal open={!!logModal} onClose={() => setLogModal(null)} title="Log Symptom Observation">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ padding: "10px 12px", background: C.surface, borderRadius: 8, fontSize: 13, color: C.text, borderLeft: `3px solid ${sys?.color}`, lineHeight: 1.5 }}>{logModal}</div>
          <Dropdown label="How bad is it?" value={logForm.severity} onChange={v => setLogForm(p => ({ ...p, severity: v }))} options={[
            { value: "mild", label: "🟢 Mild — occasional, not affecting drive" },
            { value: "moderate", label: "🟡 Moderate — noticeable, seems to be getting worse" },
            { value: "severe", label: "🔴 Severe — affecting safety or driveability" },
          ]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date" type="date" value={logForm.date} onChange={v => setLogForm(p => ({ ...p, date: v }))} />
            <Field label="Odometer (km)" type="number" value={logForm.odo} onChange={v => setLogForm(p => ({ ...p, odo: v }))} placeholder={vehicle.odo} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Your Observation</label>
            <textarea value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="When does it happen? How often? Getting worse? Any pattern?" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          {logForm.severity === "severe" && (
            <div style={{ padding: "8px 12px", background: C.red + "11", border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 12, color: C.red }}>
              ⚠️ Severe issues are automatically flagged for workshop visit scheduling
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => logSymptom(logModal)} color={C.accent}>Log Observation</Btn>
            <Btn onClick={() => setLogModal(null)} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={!!historyModal} onClose={() => setHistoryModal(null)} title={`${SYMPTOM_SYSTEMS[historyModal || "clutch"]?.label} — Full History`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {(logs[historyModal] || []).length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>No observations logged yet</div>}
          {(logs[historyModal] || []).map(log => (
            <div key={log.id} style={{ background: C.surface, borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${log.severity === "severe" ? C.red : log.severity === "moderate" ? C.yellow : C.green}` }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{log.symptom}</div>
              {log.notes && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontStyle: "italic" }}>{log.notes}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center" }}>
                <Badge color={log.severity === "severe" ? C.red : log.severity === "moderate" ? C.yellow : C.green}>{log.severity}</Badge>
                <span style={{ fontSize: 10, color: C.muted }}>📅 {log.date}{log.odo && ` · 🚗 ${log.odo} km`}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─── WORKSHOP PAGE ────────────────────────────────────────────────────────────
function WorkshopPage({ vehicle, visits, schedule, onUpdate }) {
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [actualCost, setActualCost] = useState("");

  const overdueItems = (schedule || []).filter(i => i.isActive && getItemStatus(i, vehicle.odo) === "overdue");
  const dueSoonItems = (schedule || []).filter(i => i.isActive && getItemStatus(i, vehicle.odo) === "due-soon");
  const allScheduleItems = (schedule || []).filter(i => i.isActive);

  const blank = () => ({
    tentativeDate: "", workshop: "", estimatedCost: "",
    notes: "", items: [...overdueItems.map(i => i.name), ...dueSoonItems.map(i => i.name)],
    status: "upcoming", symptomReasons: [],
  });

  const saveVisit = async () => {
    if (!form.tentativeDate) return;
    const updated = selected
      ? visits.map(v => v.id === selected.id ? { ...form, id: selected.id } : v)
      : [{ ...form, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...visits];
    await onUpdate(updated); setModal(null); setSelected(null);
  };

  const completeVisit = async (visitId) => {
    const updated = visits.map(v => v.id === visitId ? { ...v, status: "completed", completedDate: new Date().toISOString().split("T")[0], actualCost: actualCost || v.estimatedCost } : v);
    await onUpdate(updated); setModal(null); setActualCost("");
  };

  const deleteVisit = async (id) => onUpdate(visits.filter(v => v.id !== id));

  const upcoming = visits.filter(v => v.status === "upcoming").sort((a, b) => new Date(a.tentativeDate) - new Date(b.tentativeDate));
  const completed = visits.filter(v => v.status === "completed").sort((a, b) => new Date(b.completedDate || b.tentativeDate) - new Date(a.completedDate || a.tentativeDate));

  const VisitCard = ({ visit }) => {
    const daysLeft = getDaysUntil(visit.tentativeDate);
    const urg = visit.status === "completed" ? C.green : daysLeft < 0 ? C.red : daysLeft < 7 ? C.red : daysLeft < 14 ? C.yellow : C.blue;
    return (
      <div style={{ background: C.card, border: `1px solid ${urg + "44"}`, borderLeft: `4px solid ${urg}`, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{visit.status === "completed" ? "✅" : "🏪"} Workshop Visit</span>
                <Badge color={urg}>{visit.status === "completed" ? "Completed" : daysLeft < 0 ? "Overdue" : "Upcoming"}</Badge>
              </div>
              {visit.workshop && <div style={{ fontSize: 12, color: C.dimmed }}>📍 {visit.workshop}</div>}
              <div style={{ fontSize: 12, color: C.dimmed, marginTop: 3 }}>
                📅 {visit.status === "completed" ? `Completed ${visit.completedDate || visit.tentativeDate}` : `Planned ${visit.tentativeDate}`}
                {visit.status !== "completed" && daysLeft !== null && (
                  <span style={{ color: urg, fontWeight: 700, marginLeft: 6 }}>
                    {daysLeft < 0 ? `(${Math.abs(daysLeft)}d overdue)` : daysLeft === 0 ? "(Today!)" : `(${daysLeft}d away)`}
                  </span>
                )}
              </div>
            </div>
            {(visit.actualCost || visit.estimatedCost) && (
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: C.accent }}>₹{parseFloat(visit.actualCost || visit.estimatedCost).toLocaleString("en-IN")}</div>
                <div style={{ fontSize: 9, color: C.muted }}>{visit.actualCost ? "actual" : "estimated"}</div>
              </div>
            )}
          </div>

          {visit.items?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 5 }}>ITEMS ({visit.items.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {visit.items.map((item, i) => <Badge key={i} color={C.blue}>{item}</Badge>)}
              </div>
            </div>
          )}

          {visit.symptomReasons?.length > 0 && (
            <div style={{ marginTop: 8, padding: "6px 10px", background: C.red + "0f", borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: C.red, fontWeight: 700, marginBottom: 2 }}>⚠️ SYMPTOM FLAGS</div>
              {visit.symptomReasons.map((r, i) => <div key={i} style={{ fontSize: 11, color: C.dimmed }}>{r}</div>)}
            </div>
          )}

          {visit.notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 8, fontStyle: "italic" }}>{visit.notes}</div>}
        </div>

        {visit.status !== "completed" && (
          <div style={{ borderTop: `1px solid ${C.border}`, display: "flex" }}>
            <button onClick={() => { setSelected(visit); setForm({ ...visit }); setModal("edit"); }} style={{ flex: 1, background: "none", border: "none", padding: "9px", color: C.blue, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✏️ Edit</button>
            <button onClick={() => { setSelected(visit); setModal("complete"); }} style={{ flex: 1, background: "none", border: "none", padding: "9px", color: C.green, fontSize: 11, fontWeight: 700, cursor: "pointer", borderLeft: `1px solid ${C.border}` }}>✓ Complete</button>
            <button onClick={() => deleteVisit(visit.id)} style={{ flex: 1, background: "none", border: "none", padding: "9px", color: C.red, fontSize: 11, fontWeight: 600, cursor: "pointer", borderLeft: `1px solid ${C.border}` }}>🗑 Delete</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Workshop Visits</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{upcoming.length} upcoming · {completed.length} completed</div>
          </div>
          <Btn small onClick={() => { setForm(blank()); setSelected(null); setModal("edit"); }}>+ Plan Visit</Btn>
        </div>

        {(overdueItems.length > 0 || dueSoonItems.length > 0) && upcoming.length === 0 && (
          <div style={{ padding: "10px 12px", background: C.yellow + "0f", border: `1px solid ${C.yellow}44`, borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.yellow, marginBottom: 4 }}>💡 Service attention needed</div>
            {overdueItems.length > 0 && <div style={{ fontSize: 11, color: C.red }}>{overdueItems.length} overdue: {overdueItems.slice(0, 2).map(i => i.name).join(", ")}{overdueItems.length > 2 ? ` +${overdueItems.length - 2} more` : ""}</div>}
            {dueSoonItems.length > 0 && <div style={{ fontSize: 11, color: C.yellow, marginTop: 2 }}>{dueSoonItems.length} due soon: {dueSoonItems.slice(0, 2).map(i => i.name).join(", ")}{dueSoonItems.length > 2 ? ` +${dueSoonItems.length - 2} more` : ""}</div>}
            <button onClick={() => { setForm(blank()); setSelected(null); setModal("edit"); }} style={{ marginTop: 8, background: "none", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>Plan a workshop visit now →</button>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 12px 0" }}>
        {upcoming.length === 0 && completed.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
            <div style={{ fontSize: 14, color: C.dimmed, marginBottom: 6 }}>No workshop visits planned</div>
            <div style={{ fontSize: 12, marginBottom: 20 }}>Plan in advance — avoid emergency repair stress</div>
            <Btn onClick={() => { setForm(blank()); setSelected(null); setModal("edit"); }}>+ Plan First Visit</Btn>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.7, marginBottom: 10 }}>UPCOMING ({upcoming.length})</div>
            {upcoming.map(v => <VisitCard key={v.id} visit={v} />)}
          </>
        )}

        {completed.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.7, marginBottom: 10, marginTop: upcoming.length > 0 ? 16 : 0 }}>COMPLETED ({completed.length})</div>
            {completed.map(v => <VisitCard key={v.id} visit={v} />)}
          </>
        )}
      </div>

      {/* Edit/Add Visit Modal */}
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title={selected ? "Edit Workshop Visit" : "Plan Workshop Visit"} wide>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Planned Date *" type="date" value={form.tentativeDate || ""} onChange={v => setForm(p => ({ ...p, tentativeDate: v }))} required />
            <Field label="Workshop / Dealer" value={form.workshop || ""} onChange={v => setForm(p => ({ ...p, workshop: v }))} placeholder="Workshop name or location" />
          </div>
          <Field label="Estimated Cost (₹)" type="number" value={form.estimatedCost || ""} onChange={v => setForm(p => ({ ...p, estimatedCost: v }))} placeholder="0" />

          <div>
            <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Items to Address — tap to select</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {allScheduleItems.map(item => {
                const sel = (form.items || []).includes(item.name);
                const s = getItemStatus(item, vehicle.odo);
                const sc = s === "overdue" ? C.red : s === "due-soon" ? C.yellow : C.muted;
                return (
                  <button key={item.id} onClick={() => {
                    const cur = form.items || [];
                    setForm(p => ({ ...p, items: sel ? cur.filter(i => i !== item.name) : [...cur, item.name] }));
                  }} style={{ background: sel ? sc + "22" : "transparent", border: `1px solid ${sel ? sc : C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: sel ? sc : C.muted, cursor: "pointer", fontWeight: sel ? 700 : 400 }}>
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Notes for Workshop</label>
            <textarea value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Instructions, questions to ask, parts to source, concerns to raise..." style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={saveVisit} color={C.green}>💾 {selected ? "Update Visit" : "Save Visit"}</Btn>
            <Btn onClick={() => setModal(null)} color={C.muted} outline>Cancel</Btn>
          </div>
        </div>
      </Modal>

      {/* Complete Visit Modal */}
      <Modal open={modal === "complete"} onClose={() => setModal(null)} title="Mark Visit Complete">
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: C.dimmed, lineHeight: 1.6 }}>This will mark the visit as done and update your records.</div>
            {selected.items?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>ITEMS COMPLETED</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selected.items.map((item, i) => <Badge key={i} color={C.green}>{item}</Badge>)}
                </div>
              </div>
            )}
            <Field label="Actual Cost (₹)" type="number" value={actualCost} onChange={setActualCost} placeholder={selected.estimatedCost || "0"} />
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => completeVisit(selected.id)} color={C.green}>✓ Mark as Complete</Btn>
              <Btn onClick={() => setModal(null)} color={C.muted} outline>Cancel</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [vehicles, setVehicles] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [symptoms, setSymptoms] = useState({});
  const [workshopVisits, setWorkshopVisits] = useState({});
  const [activeVehicleId, setActiveVehicleId] = useState(null);
  const [tab, setTab] = useState("garage");
  const [vehicleModal, setVehicleModal] = useState(null);

  useEffect(() => {
    const load = async () => {
      const v = await store.get("tnv_vehicles"); if (v) setVehicles(v);
      const s = await store.get("tnv_schedules"); if (s) setSchedules(s);
      const sym = await store.get("tnv_symptoms"); if (sym) setSymptoms(sym);
      const w = await store.get("tnv_visits"); if (w) setWorkshopVisits(w);
    };
    load();
  }, []);

  const activeVehicle = vehicles.find(v => v.id === activeVehicleId);

  const saveVehicles = async (v) => { setVehicles(v); await store.set("tnv_vehicles", v); };
  const saveSchedules = async (s) => { setSchedules(s); await store.set("tnv_schedules", s); };
  const saveSymptoms = async (s) => { setSymptoms(s); await store.set("tnv_symptoms", s); };
  const saveVisits = async (v) => { setWorkshopVisits(v); await store.set("tnv_visits", v); };

  const addVehicle = async (form) => {
    const id = `v_${Date.now()}`;
    const vehicle = { ...form, id, year: parseInt(form.year), odo: parseFloat(form.odo) || 0 };
    await saveVehicles([...vehicles, vehicle]);
    await saveSchedules({ ...schedules, [id]: generateSchedule(vehicle) });
    setActiveVehicleId(id); setTab("schedule"); setVehicleModal(null);
  };

  const editVehicle = async (form) => {
    const vehicle = { ...form, year: parseInt(form.year), odo: parseFloat(form.odo) || 0 };
    await saveVehicles(vehicles.map(v => v.id === vehicle.id ? vehicle : v));
    setVehicleModal(null);
  };

  const tabs = [
    { id: "garage", icon: "🏠", label: "Garage" },
    { id: "schedule", icon: "📋", label: "Schedule" },
    { id: "health", icon: "🩺", label: "Health" },
    { id: "workshop", icon: "🏪", label: "Workshop" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", maxWidth: 680, margin: "0 auto" }}>
      {/* Top bar */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", position: "sticky", top: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div onClick={() => setTab("garage")} style={{ cursor: "pointer" }}>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.5 }}>
            <span style={{ color: C.accent }}>Track</span><span style={{ color: C.text }}>N</span><span style={{ color: C.green }}>Save</span>
          </div>
          {activeVehicle && tab !== "garage" && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
              {activeVehicle.make} {activeVehicle.model} · {activeVehicle.year} · {activeVehicle.odo ? parseInt(activeVehicle.odo).toLocaleString("en-IN") + " km" : "odo not set"}
            </div>
          )}
        </div>
        {tab !== "garage" && activeVehicle && (
          <button onClick={() => setTab("garage")} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 10px", color: C.muted, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>← Garage</button>
        )}
      </div>

      {tab === "garage" && <GaragePage vehicles={vehicles} schedules={schedules} workshopVisits={workshopVisits} onSelect={v => { setActiveVehicleId(v.id); setTab("schedule"); }} onAdd={() => setVehicleModal("add")} onEdit={v => setVehicleModal(v)} />}
      {tab === "schedule" && activeVehicle && <SchedulePage vehicle={activeVehicle} schedule={schedules[activeVehicleId] || []} onUpdate={u => saveSchedules({ ...schedules, [activeVehicleId]: u })} />}
      {tab === "health" && activeVehicle && <HealthPage vehicle={activeVehicle} symptoms={symptoms[activeVehicleId] || {}} onUpdate={u => saveSymptoms({ ...symptoms, [activeVehicleId]: u })} onPushToWorkshop={() => setTab("workshop")} />}
      {tab === "workshop" && activeVehicle && <WorkshopPage vehicle={activeVehicle} visits={workshopVisits[activeVehicleId] || []} schedule={schedules[activeVehicleId] || []} onUpdate={u => saveVisits({ ...workshopVisits, [activeVehicleId]: u })} />}

      {tab !== "garage" && !activeVehicle && (
        <div style={{ textAlign: "center", padding: "80px 20px", color: C.muted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
          <div style={{ fontSize: 14, color: C.dimmed, marginBottom: 16 }}>Select a vehicle first</div>
          <Btn onClick={() => setTab("garage")} color={C.accent}>← Go to Garage</Btn>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 680, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 200 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", padding: "10px 0 8px", color: tab === t.id ? C.accent : C.muted, cursor: "pointer", borderTop: `2px solid ${tab === t.id ? C.accent : "transparent"}` }}>
            <div style={{ fontSize: 18 }}>{t.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, letterSpacing: 0.4 }}>{t.label.toUpperCase()}</div>
          </button>
        ))}
      </div>

      <Modal open={!!vehicleModal} onClose={() => setVehicleModal(null)} title={vehicleModal === "add" ? "Add Vehicle to Garage" : `Edit — ${vehicleModal?.make} ${vehicleModal?.model}`} wide>
        <VehicleForm initial={vehicleModal === "add" ? null : vehicleModal} onSave={vehicleModal === "add" ? addVehicle : editVehicle} onCancel={() => setVehicleModal(null)} />
      </Modal>
    </div>
  );
}