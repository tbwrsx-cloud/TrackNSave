import { useState, useEffect, useRef } from "react";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const store = {
  async get(k) { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  async set(k, v) { try { await window.storage.set(k, JSON.stringify(v)); } catch {} }
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0d16", surface: "#111520", card: "#181e2e",
  border: "#1f2844", accent: "#f97316",
  green: "#22c55e", red: "#ef4444", yellow: "#eab308",
  blue: "#3b82f6", cyan: "#06b6d4", purple: "#a855f7",
  text: "#e8eaf0", muted: "#5a6480", dimmed: "#8892a8",
};

// ─── VEHICLE LOGIC ────────────────────────────────────────────────────────────
function getOilInterval(year) {
  const y = parseInt(year);
  if (y >= 2011) return 10000;
  if (y >= 2000) return 7500;
  return 5000;
}
function needsTimingBelt(year, fuel, timing) {
  if (timing === "chain") return false;
  if (timing === "belt") return true;
  if (fuel === "diesel") return false;
  if (parseInt(year) >= 2015) return false;
  return "unknown";
}
function addMonths(date, m) { const d = new Date(date); d.setMonth(d.getMonth() + m); return d; }
function getDaysUntil(ds) { if (!ds) return null; return Math.ceil((new Date(ds) - new Date()) / 86400000); }
function getKmLeft(item, odo) { return item.nextDueKm ? item.nextDueKm - odo : null; }
function getItemStatus(item, odo) {
  const km = item.nextDueKm ? getKmLeft(item, odo) : null;
  const days = item.nextDueDate ? getDaysUntil(item.nextDueDate) : null;
  const v = km !== null ? km : days;
  if (v === null) return "ok";
  if (v < 0) return "overdue";
  if (v < (item.nextDueKm ? 1000 : 14)) return "due-soon";
  return "ok";
}

function generateSchedule(vehicle) {
  const oilKm = getOilInterval(vehicle.year);
  const hasBelt = needsTimingBelt(vehicle.year, vehicle.fuel, vehicle.timing);
  const isOld = parseInt(vehicle.year) < 2005;
  const odo = vehicle.odo || 0;

  const base = [
    { id: "oil", name: "Engine Oil & Filter", intervalKm: oilKm, type: "replace", notes: `${oilKm/1000}k km interval — year ${vehicle.year} rule`, category: "engine" },
    { id: "airfilter", name: "Air Filter", intervalKm: 20000, type: "inspect", notes: "Clean at 20k · Replace at 40k", category: "engine" },
    { id: "cabinfilter", name: "Cabin Air Filter", intervalKm: 15000, type: "clean", notes: "Clean at 15k · Replace at 30k", category: "cabin" },
    { id: "brakefluid", name: "Brake Fluid", intervalMonths: 24, type: "replace", notes: "Replace every 2 years — absorbs moisture", category: "brakes" },
    { id: "coolant", name: "Engine Coolant", intervalKm: isOld ? 40000 : 60000, type: "inspect", notes: `Inspect at ${isOld?40:60}k · Replace at ${isOld?60:80}k`, category: "engine" },
    { id: "brakepads", name: "Brake Pads / Shoes", intervalKm: 30000, type: "inspect", notes: "Check thickness — replace if under 3mm", category: "brakes" },
    { id: "tyrerotation", name: "Tyre Rotation & Pressure", intervalKm: 10000, type: "rotate", notes: "Rotate and check pressure + tread depth", category: "tyres" },
    { id: "battery", name: "Battery Health", intervalMonths: 12, type: "inspect", notes: "Check terminals, voltage, electrolyte annually", category: "electrical" },
    { id: "wipers", name: "Wiper Blades", intervalMonths: 12, type: "replace", notes: "Replace annually or when smearing noticed", category: "cabin" },
    { id: "drivebelts", name: "Drive Belts / Alternator Belt", intervalKm: 60000, type: "inspect", notes: "Check for cracks and tension at 60k", category: "engine" },
    { id: "fuelfilter", name: "Fuel Filter", intervalKm: vehicle.fuel === "diesel" ? 30000 : 40000, type: "replace", notes: vehicle.fuel === "diesel" ? "Diesel — replace every 30k" : "Petrol — replace every 40k", category: "fuel" },
    { id: "exhaustcheck", name: "Exhaust System", intervalKm: 20000, type: "inspect", notes: "Check for leaks, rust, loose hangers", category: "engine" },
    { id: "tyrereplace", name: "Tyre Condition & Age", intervalKm: 40000, type: "inspect", notes: "Tread under 1.6mm or over 5 years — replace", category: "tyres" },
    { id: "acservice", name: "AC Service & Refrigerant", intervalMonths: 12, type: "inspect", notes: "Check cooling performance and refrigerant annually", category: "cabin" },
  ];

  if (vehicle.fuel !== "diesel") base.push({ id: "sparkplugs", name: "Spark Plugs", intervalKm: 40000, type: "replace", notes: "Standard 40k · Iridium up to 80k", category: "engine" });
  if (vehicle.fuel === "diesel") base.push({ id: "glowplugs", name: "Glow Plugs", intervalKm: 60000, type: "inspect", notes: "Check at 60k — hard cold starts indicate failure", category: "engine" });
  if (hasBelt === true) base.push({ id: "timingbelt", name: "Timing Belt", intervalKm: 60000, type: "replace", notes: "⚠️ CRITICAL — engine damage if missed. Replace at 60k or 5 years.", category: "engine" });
  if (hasBelt === "unknown") base.push({ id: "timingbelt", name: "Timing Belt (Verify)", intervalKm: 60000, type: "replace", notes: "❓ Verify with owner manual — pre-2015 petrol may have belt not chain.", category: "engine" });
  if (vehicle.gearbox === "auto") base.push({ id: "atfluid", name: "Automatic Transmission Fluid", intervalKm: 60000, type: "replace", notes: "Replace at 60k — skipping causes expensive damage", category: "transmission" });
  else if (vehicle.gearbox === "cvt") base.push({ id: "cvtfluid", name: "CVT Fluid", intervalKm: 40000, type: "replace", notes: "Replace at 40k — critical for CVT longevity", category: "transmission" });
  else if (vehicle.gearbox === "dct") base.push({ id: "dctfluid", name: "DCT / DSG Fluid", intervalKm: 60000, type: "replace", notes: "Replace at 60k — often skipped causing hesitation", category: "transmission" });
  else base.push({ id: "gearboxoil", name: "Manual Gearbox Oil", intervalKm: 80000, type: "inspect", notes: "Check level at 80k km", category: "transmission" });

  return base.map((item, idx) => ({
    ...item, order: idx, isBuiltIn: true, isActive: true,
    intervalKm: item.intervalKm || null, intervalMonths: item.intervalMonths || null,
    lastDoneKm: null, lastDoneDate: null,
    nextDueKm: item.intervalKm ? odo + item.intervalKm : null,
    nextDueDate: item.intervalMonths ? addMonths(new Date(), item.intervalMonths).toISOString().split("T")[0] : null,
  }));
}

// ─── OBD PARAMS ───────────────────────────────────────────────────────────────
const OBD_PARAMS = [
  { id: "coolant_temp", name: "Coolant Temp", unit: "°C", min: 85, max: 100, danger: 105, icon: "🌡️", group: "engine" },
  { id: "rpm", name: "Idle RPM", unit: "rpm", min: 700, max: 900, danger: 1100, icon: "⚙️", group: "engine" },
  { id: "intake_temp", name: "Intake Air Temp", unit: "°C", min: 20, max: 50, danger: 65, icon: "🌬️", group: "engine" },
  { id: "engine_load", name: "Engine Load", unit: "%", min: 0, max: 80, danger: 95, icon: "💪", group: "engine" },
  { id: "throttle_pos", name: "Throttle Position", unit: "%", min: 0, max: 100, danger: null, icon: "🎚️", group: "engine" },
  { id: "battery_off", name: "Battery (off)", unit: "V", min: 12.4, max: 12.7, danger: 12.0, icon: "🔋", group: "electrical" },
  { id: "battery_on", name: "Battery (on)", unit: "V", min: 13.7, max: 14.7, danger: 13.5, icon: "⚡", group: "electrical" },
  { id: "fuel_trim_st", name: "Fuel Trim ST", unit: "%", min: -5, max: 5, danger: 10, icon: "⛽", group: "fuel" },
  { id: "fuel_trim_lt", name: "Fuel Trim LT", unit: "%", min: -5, max: 5, danger: 10, icon: "📊", group: "fuel" },
  { id: "fuel_efficiency", name: "Fuel Efficiency", unit: "km/L", min: 10, max: 20, danger: 7, icon: "🚗", group: "fuel" },
];

const SYMPTOM_SYSTEMS = {
  clutch: { label: "Clutch", icon: "🔄", color: C.purple, symptoms: ["Clutch slipping — revs but no acceleration","High biting point — pedal nearly fully released","Difficulty engaging or changing gears","Grinding or crunching when shifting","Spongy or soft clutch pedal","Pedal going all the way to the floor","Burning smell after hill starts or traffic","Vibration when releasing clutch","Clutch pedal sticking or not returning"] },
  gearbox: { label: "Gearbox", icon: "⚙️", color: C.cyan, symptoms: ["Gear popping out on its own — 2nd or 3rd","Grinding or crunching when changing gears","Difficulty getting into reverse","Whining or humming in specific gears","Gear lever loose, wobbly, or vague","Hard to select gears when cold","Noise from gearbox when in neutral","Gear jumps out under hard acceleration"] },
  suspension: { label: "Suspension", icon: "🚗", color: C.yellow, symptoms: ["Bouncing excessively after bumps","Pulling to one side while driving or braking","Uneven tyre wear — inner or outer edge","Clunking or knocking over bumps","Car nose-diving under heavy braking","Steering vague or loose at highway speeds","Squeaking from corners over bumps","Car sitting lower on one side","Excessive body roll cornering"] },
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Badge = ({ color, children, small }) => (
  <span style={{ background: color+"22", color, border: `1px solid ${color}44`, borderRadius: 5, padding: small?"1px 6px":"2px 8px", fontSize: small?9:10, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", whiteSpace:"nowrap" }}>{children}</span>
);
const Btn = ({ onClick, color=C.accent, children, small, outline, disabled, full }) => (
  <button onClick={onClick} disabled={disabled} style={{ background:outline?"transparent":color, color:outline?color:"#fff", border:`1.5px solid ${color}`, borderRadius:8, padding:small?"5px 12px":"9px 20px", fontSize:small?11:14, fontWeight:600, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, letterSpacing:0.3, width:full?"100%":"auto", fontFamily:"inherit" }}>{children}</button>
);
const F = ({ label, value, onChange, type="text", placeholder, small, required }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={{ fontSize:10, color:C.muted, fontWeight:700, letterSpacing:0.7, textTransform:"uppercase" }}>{label}{required&&<span style={{color:C.red}}> *</span>}</label>}
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:small?"6px 10px":"9px 12px", color:C.text, fontSize:small?12:14, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" }} />
  </div>
);
const DD = ({ label, value, onChange, options, required }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={{ fontSize:10, color:C.muted, fontWeight:700, letterSpacing:0.7, textTransform:"uppercase" }}>{label}{required&&<span style={{color:C.red}}> *</span>}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 12px", color:C.text, fontSize:14, outline:"none", width:"100%", fontFamily:"inherit" }}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);
const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"#000000bb", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:24, width:"100%", maxWidth:wide?640:520, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 40px 100px #000000cc" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontSize:16, fontWeight:800, color:C.text }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, fontSize:24, cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
};
const TA = ({ label, value, onChange, placeholder, rows=3 }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={{ fontSize:10, color:C.muted, fontWeight:700, letterSpacing:0.7, textTransform:"uppercase" }}>{label}</label>}
    <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"9px 12px", color:C.text, fontSize:13, outline:"none", resize:"vertical", fontFamily:"inherit" }} />
  </div>
);

// ─── VEHICLE FORM ─────────────────────────────────────────────────────────────
function VehicleForm({ initial, onSave, onCancel }) {
  const blank = { make:"", model:"", year:new Date().getFullYear().toString(), fuel:"petrol", gearbox:"manual", timing:"unknown", reg:"", odo:"" };
  const [form, setForm] = useState(initial||blank);
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const oil = form.year ? getOilInterval(parseInt(form.year)) : null;
  const belt = form.year && form.fuel ? needsTimingBelt(parseInt(form.year), form.fuel, form.timing) : null;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <F label="Make" required value={form.make} onChange={v=>f("make",v)} placeholder="e.g. Hyundai" />
        <F label="Model" required value={form.model} onChange={v=>f("model",v)} placeholder="e.g. Elite i20" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <F label="Year" required type="number" value={form.year} onChange={v=>f("year",v)} placeholder="2019" />
        <F label="Registration" value={form.reg} onChange={v=>f("reg",v)} placeholder="KA 01 AB 1234" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        <DD label="Fuel" required value={form.fuel} onChange={v=>f("fuel",v)} options={[{value:"petrol",label:"⛽ Petrol"},{value:"diesel",label:"🛢️ Diesel"},{value:"cng",label:"🟢 CNG"},{value:"electric",label:"⚡ EV"}]} />
        <DD label="Gearbox" required value={form.gearbox} onChange={v=>f("gearbox",v)} options={[{value:"manual",label:"Manual"},{value:"auto",label:"Auto"},{value:"cvt",label:"CVT"},{value:"dct",label:"DCT"},{value:"amt",label:"AMT"}]} />
        <DD label="Timing" value={form.timing} onChange={v=>f("timing",v)} options={[{value:"unknown",label:"Unknown"},{value:"chain",label:"⛓ Chain"},{value:"belt",label:"🔄 Belt"}]} />
      </div>
      <F label="Current Odometer (km)" type="number" value={form.odo} onChange={v=>f("odo",v)} placeholder="42500" />
      {oil && (
        <div style={{ padding:"12px 14px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:10 }}>
          <div style={{ fontSize:10, fontWeight:700, color:C.accent, letterSpacing:0.6, marginBottom:8 }}>📋 SCHEDULE PREVIEW</div>
          <div style={{ fontSize:12, color:C.dimmed, lineHeight:2 }}>
            <div>🛢️ Oil change: <span style={{color:C.text,fontWeight:700}}>every {oil/1000}k km</span></div>
            {belt===true && <div style={{color:C.red}}>⚠️ Timing belt: <span style={{fontWeight:700}}>replace at 60,000 km</span></div>}
            {belt==="unknown" && <div style={{color:C.yellow}}>❓ Timing unknown — verify with owner manual</div>}
            {belt===false && <div style={{color:C.green}}>✓ Timing chain — no replacement needed</div>}
            <div>⚙️ {form.gearbox==="cvt"?"CVT fluid: 40k":form.gearbox==="auto"?"AT fluid: 60k":form.gearbox==="dct"?"DCT fluid: 60k":"Gearbox oil: check at 80k"}</div>
          </div>
        </div>
      )}
      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={()=>{ if(!form.make||!form.model||!form.year) return; onSave(form); }} color={C.green}>💾 {initial?"Update Vehicle":"Add to Garage"}</Btn>
        <Btn onClick={onCancel} color={C.muted} outline>Cancel</Btn>
      </div>
    </div>
  );
}

// ─── GARAGE ───────────────────────────────────────────────────────────────────
function GaragePage({ vehicles, schedules, visits, onSelect, onAdd, onEdit }) {
  const alerts = (v) => {
    const items = (schedules[v.id]||[]).filter(i=>i.isActive);
    return { overdue: items.filter(i=>getItemStatus(i,v.odo)==="overdue").length, dueSoon: items.filter(i=>getItemStatus(i,v.odo)==="due-soon").length };
  };
  const nextVisit = (id) => {
    const up = (visits[id]||[]).filter(v=>v.status==="upcoming").sort((a,b)=>new Date(a.date)-new Date(b.date));
    return up[0]||null;
  };
  return (
    <div style={{ padding:"16px 12px 80px" }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:26, fontWeight:900, letterSpacing:-1 }}><span style={{color:C.accent}}>Track</span><span style={{color:C.text}}>N</span><span style={{color:C.green}}>Save</span></div>
        <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>Track your vehicle · Save on repairs</div>
      </div>
      {vehicles.length===0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", background:C.surface, borderRadius:16, border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🚗</div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:8 }}>Your garage is empty</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:24, lineHeight:1.6 }}>Add your first vehicle to start tracking maintenance</div>
          <Btn onClick={onAdd}>+ Add Your First Vehicle</Btn>
        </div>
      ) : (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <span style={{ fontSize:10, fontWeight:700, color:C.muted, letterSpacing:0.7 }}>MY GARAGE — {vehicles.length} VEHICLE{vehicles.length!==1?"S":""}</span>
            <Btn small onClick={onAdd}>+ Add Vehicle</Btn>
          </div>
          {vehicles.map(v => {
            const a = alerts(v);
            const nv = nextVisit(v.id);
            const days = nv ? getDaysUntil(nv.date) : null;
            const hc = a.overdue>0?C.red:a.dueSoon>0?C.yellow:C.green;
            return (
              <div key={v.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`4px solid ${hc}`, borderRadius:14, marginBottom:12, overflow:"hidden" }}>
                <div onClick={()=>onSelect(v)} style={{ padding:"14px 16px", cursor:"pointer" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{v.make} {v.model}</div>
                      <div style={{ display:"flex", gap:6, marginTop:5, flexWrap:"wrap", alignItems:"center" }}>
                        <Badge color={C.blue}>{v.year}</Badge>
                        <Badge color={v.fuel==="petrol"?C.accent:v.fuel==="diesel"?C.yellow:C.green}>{v.fuel}</Badge>
                        <Badge color={C.muted}>{v.gearbox}</Badge>
                        {v.reg && <span style={{fontSize:11,color:C.muted}}>· {v.reg}</span>}
                      </div>
                      <div style={{ fontSize:11, color:C.dimmed, marginTop:6 }}>
                        🚗 {v.odo?parseInt(v.odo).toLocaleString("en-IN")+" km":"Odo not set"}
                        <span style={{color:C.muted}}> · Oil every {getOilInterval(v.year)/1000}k km</span>
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0, marginLeft:12 }}>
                      <Badge color={hc}>{a.overdue>0?"Overdue":a.dueSoon>0?"Due Soon":"On Track"}</Badge>
                      {a.overdue>0 && <div style={{fontSize:10,color:C.red,marginTop:4}}>{a.overdue} overdue</div>}
                      {a.dueSoon>0 && <div style={{fontSize:10,color:C.yellow,marginTop:2}}>{a.dueSoon} due soon</div>}
                    </div>
                  </div>
                  {nv && (
                    <div style={{ marginTop:10, padding:"7px 10px", background:C.surface, borderRadius:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{fontSize:11,color:C.dimmed}}>🏪 {nv.workshop||"Workshop visit planned"}</div>
                      <div style={{fontSize:11,fontWeight:700,color:days<7?C.red:days<14?C.yellow:C.green}}>{days<0?"Overdue":days===0?"Today!":days+"d away"}</div>
                    </div>
                  )}
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, display:"flex" }}>
                  <button onClick={()=>onSelect(v)} style={{ flex:2, background:"none", border:"none", padding:"9px", color:C.accent, fontSize:11, fontWeight:700, cursor:"pointer" }}>Open Vehicle →</button>
                  <button onClick={()=>onEdit(v)} style={{ flex:1, background:"none", border:"none", padding:"9px", color:C.muted, fontSize:11, fontWeight:600, cursor:"pointer", borderLeft:`1px solid ${C.border}` }}>✏️ Edit</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── PERIODIC MAINTENANCE ─────────────────────────────────────────────────────
function MaintenancePage({ vehicle, schedule, onUpdate, onPushToWorkshop }) {
  const [items, setItems] = useState(schedule||[]);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [doneForm, setDoneForm] = useState({ date:"", odo:"", cost:"", notes:"", workshop:"" });
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");

  useEffect(()=>setItems(schedule||[]),[schedule]);
  const persist = async (u) => { setItems(u); await onUpdate(u); };

  const markDone = async () => {
    const odo = parseFloat(doneForm.odo)||vehicle.odo||0;
    const u = items.map(i => i.id!==selected.id ? i : {
      ...i, lastDoneKm:odo, lastDoneDate:doneForm.date,
      nextDueKm: i.intervalKm ? odo+i.intervalKm : i.nextDueKm,
      nextDueDate: i.intervalMonths ? addMonths(new Date(doneForm.date||new Date()),i.intervalMonths).toISOString().split("T")[0] : i.nextDueDate,
      lastCost:doneForm.cost, lastWorkshop:doneForm.workshop, lastNotes:doneForm.notes,
    });
    await persist(u); setModal(null);
  };

  const saveEdit = async () => {
    const u = items.map(i => i.id===editForm.id ? {...i,...editForm, intervalKm:editForm.intervalKm?parseInt(editForm.intervalKm):null, intervalMonths:editForm.intervalMonths?parseInt(editForm.intervalMonths):null} : i);
    await persist(u); setModal(null);
  };

  const addItem = async () => {
    if (!editForm.name) return;
    const ni = { id:`custom_${Date.now()}`, name:editForm.name, intervalKm:editForm.intervalKm?parseInt(editForm.intervalKm):null, intervalMonths:editForm.intervalMonths?parseInt(editForm.intervalMonths):null, type:editForm.type||"inspect", notes:editForm.notes||"", category:editForm.category||"other", isBuiltIn:false, isActive:true, lastDoneKm:null, lastDoneDate:null, nextDueKm:editForm.intervalKm?(vehicle.odo||0)+parseInt(editForm.intervalKm):null, nextDueDate:editForm.intervalMonths?addMonths(new Date(),parseInt(editForm.intervalMonths)).toISOString().split("T")[0]:null, order:items.length };
    await persist([...items,ni]); setModal(null); setEditForm({});
  };

  const toggleActive = async (id) => persist(items.map(i=>i.id===id?{...i,isActive:!i.isActive}:i));
  const deleteItem = async (id) => persist(items.filter(i=>i.id!==id));

  const tColor = { replace:C.red, inspect:C.blue, clean:C.yellow, rotate:C.cyan, lubricate:C.green };
  const sColor = { overdue:C.red, "due-soon":C.yellow, ok:C.green };
  const cats = ["all",...new Set(items.map(i=>i.category).filter(Boolean))];

  const filtered = items
    .filter(i=>catFilter==="all"||i.category===catFilter)
    .filter(i=>{ const s=getItemStatus(i,vehicle.odo); if(filter==="overdue") return s==="overdue"; if(filter==="due-soon") return s==="overdue"||s==="due-soon"; return true; })
    .sort((a,b)=>({overdue:0,"due-soon":1,ok:2}[getItemStatus(a,vehicle.odo)]||2)-({overdue:0,"due-soon":1,ok:2}[getItemStatus(b,vehicle.odo)]||2));

  const overN = items.filter(i=>i.isActive&&getItemStatus(i,vehicle.odo)==="overdue").length;
  const dueN = items.filter(i=>i.isActive&&getItemStatus(i,vehicle.odo)==="due-soon").length;
  const overdueItems = items.filter(i=>i.isActive&&getItemStatus(i,vehicle.odo)==="overdue");
  const dueSoonItems = items.filter(i=>i.isActive&&getItemStatus(i,vehicle.odo)==="due-soon");

  const EditFields = () => (
    <>
      <F label="Item Name" required value={editForm.name||""} onChange={v=>setEditForm(p=>({...p,name:v}))} placeholder="e.g. Differential Oil Check" />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <F label="Interval km" type="number" value={editForm.intervalKm||""} onChange={v=>setEditForm(p=>({...p,intervalKm:v}))} placeholder="10000" />
        <F label="Interval months" type="number" value={editForm.intervalMonths||""} onChange={v=>setEditForm(p=>({...p,intervalMonths:v}))} placeholder="12" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <DD label="Type" value={editForm.type||"inspect"} onChange={v=>setEditForm(p=>({...p,type:v}))} options={[{value:"inspect",label:"🔍 Inspect"},{value:"replace",label:"🔄 Replace"},{value:"clean",label:"🧹 Clean"},{value:"rotate",label:"↻ Rotate"},{value:"lubricate",label:"💧 Lubricate"}]} />
        <DD label="Category" value={editForm.category||"other"} onChange={v=>setEditForm(p=>({...p,category:v}))} options={[{value:"engine",label:"Engine"},{value:"brakes",label:"Brakes"},{value:"tyres",label:"Tyres"},{value:"cabin",label:"Cabin"},{value:"electrical",label:"Electrical"},{value:"transmission",label:"Transmission"},{value:"fuel",label:"Fuel"},{value:"other",label:"Other"}]} />
      </div>
      <TA label="Notes" value={editForm.notes||""} onChange={v=>setEditForm(p=>({...p,notes:v}))} placeholder="Description, warning signs..." />
    </>
  );

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"12px 12px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:11, color:C.muted }}>{items.length} items · {overN} overdue · {dueN} due soon</div>
          <Btn small onClick={()=>{ setEditForm({name:"",intervalKm:"",intervalMonths:"",type:"inspect",category:"other",notes:""}); setModal("add"); }}>+ Add Item</Btn>
        </div>

        {(overN>0||dueN>0) && (
          <div style={{ padding:"10px 12px", background:C.red+"0f", border:`1px solid ${C.red}33`, borderRadius:10, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.red, marginBottom:6 }}>⚠️ {overN+dueN} item{overN+dueN!==1?"s":""} need attention</div>
            <Btn small color={C.red} onClick={()=>onPushToWorkshop([...overdueItems,...dueSoonItems])}>Schedule Workshop Visit →</Btn>
          </div>
        )}

        <div style={{ display:"flex", gap:5, marginBottom:8 }}>
          {[{k:"all",l:`All (${items.length})`,c:C.blue},{k:"overdue",l:`Overdue (${overN})`,c:C.red},{k:"due-soon",l:`Due Soon (${dueN})`,c:C.yellow}].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{ background:filter===f.k?f.c+"22":"transparent", color:filter===f.k?f.c:C.muted, border:`1px solid ${filter===f.k?f.c:C.border}`, borderRadius:6, padding:"3px 9px", fontSize:10, fontWeight:700, cursor:"pointer" }}>{f.l}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:5, marginBottom:12, overflowX:"auto", paddingBottom:2 }}>
          {cats.map(cat=>(
            <button key={cat} onClick={()=>setCatFilter(cat)} style={{ background:catFilter===cat?C.accent+"22":"transparent", color:catFilter===cat?C.accent:C.muted, border:`1px solid ${catFilter===cat?C.accent:C.border}`, borderRadius:6, padding:"2px 9px", fontSize:10, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, textTransform:"capitalize" }}>{cat}</button>
          ))}
        </div>

        {filtered.map(item=>{
          const st = getItemStatus(item,vehicle.odo);
          const kmL = item.nextDueKm?getKmLeft(item,vehicle.odo):null;
          const dL = item.nextDueDate?getDaysUntil(item.nextDueDate):null;
          const sc = sColor[st]||C.muted;
          return (
            <div key={item.id} style={{ background:C.card, border:`1px solid ${st==="overdue"?C.red+"55":C.border}`, borderLeft:`3px solid ${sc}`, borderRadius:12, marginBottom:10, opacity:item.isActive?1:0.4 }}>
              <div style={{ padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{item.name}</span>
                      {!item.isBuiltIn && <Badge color={C.purple} small>Custom</Badge>}
                    </div>
                    <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap", alignItems:"center" }}>
                      <Badge color={tColor[item.type]||C.muted}>{item.type}</Badge>
                      {item.intervalKm && <span style={{fontSize:10,color:C.muted}}>Every {item.intervalKm/1000}k km</span>}
                      {item.intervalMonths && <span style={{fontSize:10,color:C.muted}}>Every {item.intervalMonths}mo</span>}
                    </div>
                    {item.notes && <div style={{ fontSize:11, color:C.muted, marginTop:3, fontStyle:"italic" }}>{item.notes}</div>}
                    {item.lastDoneKm && <div style={{ fontSize:10, color:C.green, marginTop:4 }}>✓ {parseInt(item.lastDoneKm).toLocaleString("en-IN")} km · {item.lastDoneDate}{item.lastCost && ` · ₹${parseFloat(item.lastCost).toLocaleString("en-IN")}`}{item.lastWorkshop && ` · ${item.lastWorkshop}`}</div>}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0, marginLeft:10 }}>
                    <Badge color={sc}>{st==="overdue"?"Overdue":st==="due-soon"?"Due Soon":"OK"}</Badge>
                    {kmL!==null && <div style={{fontSize:11,fontWeight:700,color:sc,marginTop:4}}>{kmL<0?`${Math.abs(kmL).toLocaleString("en-IN")} km over`:`${kmL.toLocaleString("en-IN")} km left`}</div>}
                    {dL!==null && <div style={{fontSize:11,fontWeight:700,color:sc,marginTop:2}}>{dL<0?`${Math.abs(dL)}d overdue`:`${dL}d left`}</div>}
                    {item.nextDueKm && <div style={{fontSize:10,color:C.muted,marginTop:2}}>Due at {parseInt(item.nextDueKm).toLocaleString("en-IN")} km</div>}
                  </div>
                </div>
              </div>
              <div style={{ borderTop:`1px solid ${C.border}`, display:"flex" }}>
                <button onClick={()=>{ setSelected(item); setDoneForm({date:new Date().toISOString().split("T")[0],odo:vehicle.odo||"",cost:"",notes:"",workshop:""}); setModal("done"); }} style={{ flex:1, background:"none", border:"none", padding:"8px", color:C.green, fontSize:11, fontWeight:700, cursor:"pointer" }}>✓ Done</button>
                <button onClick={()=>{ setEditForm({...item,intervalKm:item.intervalKm||"",intervalMonths:item.intervalMonths||""}); setModal("edit"); }} style={{ flex:1, background:"none", border:"none", padding:"8px", color:C.blue, fontSize:11, cursor:"pointer", borderLeft:`1px solid ${C.border}` }}>✏️ Edit</button>
                <button onClick={()=>toggleActive(item.id)} style={{ flex:1, background:"none", border:"none", padding:"8px", color:C.muted, fontSize:11, cursor:"pointer", borderLeft:`1px solid ${C.border}` }}>{item.isActive?"⊘ Off":"✓ On"}</button>
                {!item.isBuiltIn && <button onClick={()=>deleteItem(item.id)} style={{ flex:1, background:"none", border:"none", padding:"8px", color:C.red, fontSize:11, cursor:"pointer", borderLeft:`1px solid ${C.border}` }}>🗑</button>}
                <button onClick={()=>onPushToWorkshop([item])} style={{ flex:1, background:"none", border:"none", padding:"8px", color:C.accent, fontSize:11, cursor:"pointer", borderLeft:`1px solid ${C.border}` }}>🏪</button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modal==="done"} onClose={()=>setModal(null)} title={`Done: ${selected?.name}`}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <F label="Date" type="date" value={doneForm.date} onChange={v=>setDoneForm(p=>({...p,date:v}))} />
            <F label="Odometer (km)" type="number" value={doneForm.odo} onChange={v=>setDoneForm(p=>({...p,odo:v}))} placeholder={vehicle.odo} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <F label="Workshop" value={doneForm.workshop} onChange={v=>setDoneForm(p=>({...p,workshop:v}))} placeholder="Workshop name" />
            <F label="Cost (₹)" type="number" value={doneForm.cost} onChange={v=>setDoneForm(p=>({...p,cost:v}))} placeholder="0" />
          </div>
          <TA label="Notes" value={doneForm.notes} onChange={v=>setDoneForm(p=>({...p,notes:v}))} placeholder="Part used, observations, mechanic notes..." />
          <div style={{ display:"flex", gap:8 }}><Btn onClick={markDone} color={C.green}>✓ Save & Update</Btn><Btn onClick={()=>setModal(null)} color={C.muted} outline>Cancel</Btn></div>
        </div>
      </Modal>
      <Modal open={modal==="edit"} onClose={()=>setModal(null)} title={`Edit: ${editForm.name}`}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}><EditFields /><div style={{ display:"flex", gap:8 }}><Btn onClick={saveEdit} color={C.green}>💾 Save</Btn><Btn onClick={()=>setModal(null)} color={C.muted} outline>Cancel</Btn></div></div>
      </Modal>
      <Modal open={modal==="add"} onClose={()=>setModal(null)} title="Add Custom Item">
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}><EditFields /><div style={{ display:"flex", gap:8 }}><Btn onClick={addItem} color={C.green}>+ Add Item</Btn><Btn onClick={()=>setModal(null)} color={C.muted} outline>Cancel</Btn></div></div>
      </Modal>
    </div>
  );
}

// ─── OBD LOGS ─────────────────────────────────────────────────────────────────
function OBDPage({ vehicle, readings, onUpdate, onPushToWorkshop }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [csvMsg, setCsvMsg] = useState("");
  const [activeGroup, setActiveGroup] = useState("engine");
  const [showHistory, setShowHistory] = useState(false);
  const csvRef = useRef();

  const getHealth = (param, val) => {
    if (val===""||val===undefined||val===null) return "unknown";
    const v = parseFloat(val); if(isNaN(v)) return "unknown";
    if (param.danger!==null) {
      if (param.id.includes("trim")) { if(Math.abs(v)>param.danger) return "danger"; }
      else if (param.id==="battery_off"||param.id==="battery_on") { if(v<param.danger) return "danger"; }
      else { if(v>=param.danger) return "danger"; }
    }
    return v>=param.min&&v<=param.max?"good":"warn";
  };

  const hC = { good:C.green, warn:C.yellow, danger:C.red, unknown:C.muted };
  const hL = { good:"Normal", warn:"Check", danger:"Alert!", unknown:"N/A" };
  const latest = readings[0]||{};
  const scored = OBD_PARAMS.map(p=>getHealth(p,latest[p.id])).filter(s=>s!=="unknown");
  const score = scored.length===0?null:Math.round((scored.filter(s=>s==="good").length/scored.length)*100);
  const alerts = OBD_PARAMS.filter(p=>["danger","warn"].includes(getHealth(p,latest[p.id])));

  const saveReading = async () => {
    const entry = {...form, date:form.date||new Date().toISOString().split("T")[0], id:Date.now().toString()};
    await onUpdate([entry,...readings]); setShowForm(false); setForm({});
  };

  const handleCSV = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const lines = ev.target.result.split("\n").filter(l=>l.trim());
        const headers = lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/[^a-z0-9]/g,"_"));
        const pm = { "engine_coolant_temperature__c_":"coolant_temp","engine_coolant_temperature":"coolant_temp","engine_rpm__rpm_":"rpm","engine_rpm":"rpm","battery_voltage__v_":"battery_on","battery_voltage":"battery_on","intake_air_temp__c_":"intake_temp","short_term_fuel_trim_bank_1____":"fuel_trim_st","long_term_fuel_trim_bank_1____":"fuel_trim_lt","calculated_load_value____":"engine_load","absolute_throttle_position____":"throttle_pos","fuel_economy__mpg_":"fuel_efficiency" };
        const imported = [];
        for (let i=1;i<Math.min(lines.length,501);i++) {
          const vals = lines[i].split(",");
          const entry = { id:`csv_${i}_${Date.now()}`, date:new Date().toISOString().split("T")[0] };
          headers.forEach((h,idx)=>{ const m=pm[h]; if(m) entry[m]=vals[idx]?.trim()||""; if(h.includes("gps_time")||h.includes("device_time")){ const d=vals[idx]?.split(" ")[0]; if(d) entry.date=d; } });
          imported.push(entry);
        }
        await onUpdate([...imported,...readings]);
        setCsvMsg(`✅ Imported ${imported.length} rows`); setTimeout(()=>setCsvMsg(""),4000);
      } catch { setCsvMsg("❌ Could not parse CSV"); setTimeout(()=>setCsvMsg(""),4000); }
    };
    reader.readAsText(file); e.target.value="";
  };

  const Sparkline = ({ paramId, color }) => {
    const data = readings.slice(0,12).reverse().map((r,i)=>({x:i,y:parseFloat(r[paramId])})).filter(d=>!isNaN(d.y));
    if (data.length<2) return <div style={{fontSize:10,color:C.muted,marginTop:4}}>No trend yet</div>;
    const W=90,H=26,ys=data.map(d=>d.y),lo=Math.min(...ys)*0.98,hi=Math.max(...ys)*1.02;
    const px=i=>(i/(data.length-1))*W, py=v=>H-((v-lo)/((hi-lo)||1))*H;
    return (<svg width={W} height={H} style={{marginTop:6}}><polyline points={data.map((d,i)=>`${px(i)},${py(d.y)}`).join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" opacity={0.8}/><circle cx={px(data.length-1)} cy={py(data[data.length-1].y)} r={2.5} fill={color}/></svg>);
  };

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"12px 12px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <div style={{ width:56,height:56,borderRadius:"50%",flexShrink:0,background:`conic-gradient(${score===null?C.muted:score>80?C.green:score>50?C.yellow:C.red} ${score||0}%, ${C.border} 0%)`,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <div style={{ width:42,height:42,borderRadius:"50%",background:C.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:score===null?C.muted:score>80?C.green:score>50?C.yellow:C.red }}>{score===null?"?":score}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:0.5}}>OBD HEALTH SCORE</div>
            <div style={{fontSize:15,fontWeight:800,color:C.text}}>{score===null?"No data yet":score>80?"🟢 All Good":score>50?"🟡 Monitor":"🔴 Attention"}</div>
            <div style={{fontSize:11,color:C.muted}}>{readings.length} readings</div>
          </div>
        </div>

        {alerts.length>0 && (
          <div style={{ padding:"10px 12px", background:C.red+"0f", border:`1px solid ${C.red}33`, borderRadius:10, marginBottom:12 }}>
            <div style={{fontSize:10,fontWeight:700,color:C.red,letterSpacing:0.5,marginBottom:4}}>⚠️ OUT-OF-RANGE PARAMETERS</div>
            {alerts.map(p=><div key={p.id} style={{fontSize:12,color:C.dimmed}}>{p.icon} {p.name}: <span style={{color:hC[getHealth(p,latest[p.id])]}}>{latest[p.id]||"—"} {p.unit}</span></div>)}
            <button onClick={()=>onPushToWorkshop(alerts.map(p=>p.name+" out of range"))} style={{marginTop:8,background:"none",border:"none",color:C.accent,fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}>Flag for workshop →</button>
          </div>
        )}

        <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
          <Btn small onClick={()=>setShowForm(true)}>+ Manual Entry</Btn>
          <Btn small color={C.blue} outline onClick={()=>csvRef.current.click()}>📊 Import CSV</Btn>
          {readings.length>0 && <Btn small color={C.muted} outline onClick={()=>setShowHistory(true)}>📜 History ({readings.length})</Btn>}
        </div>
        <input ref={csvRef} type="file" accept=".csv,.CSV" onChange={handleCSV} style={{display:"none"}} />
        {csvMsg && <div style={{padding:"8px 12px",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12,marginBottom:10}}>{csvMsg}</div>}

        <div style={{ fontSize:11, color:C.muted, marginBottom:12, padding:"8px 12px", background:C.surface, borderRadius:8, lineHeight:1.7 }}>
          💡 Connect <span style={{color:C.text}}>ELM327 Bluetooth dongle</span> to OBD2 port → log with <span style={{color:C.text}}>Torque Pro</span> / <span style={{color:C.text}}>Car Scanner</span> → export CSV → Import above
        </div>

        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          {["engine","electrical","fuel"].map(g=>(
            <button key={g} onClick={()=>setActiveGroup(g)} style={{ background:activeGroup===g?C.accent+"22":C.card, color:activeGroup===g?C.accent:C.muted, border:`1px solid ${activeGroup===g?C.accent:C.border}`, borderRadius:7, padding:"5px 14px", fontSize:11, fontWeight:700, cursor:"pointer", textTransform:"capitalize" }}>{g==="engine"?"🔥 Engine":g==="electrical"?"⚡ Electrical":"⛽ Fuel"}</button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
          {OBD_PARAMS.filter(p=>p.group===activeGroup).map(param=>{
            const val = latest[param.id];
            const h = getHealth(param,val);
            const color = hC[h];
            return (
              <div key={param.id} style={{ background:C.card, borderRadius:12, padding:14, border:`1px solid ${h==="danger"?C.red+"88":h==="warn"?C.yellow+"55":C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <span style={{fontSize:20}}>{param.icon}</span>
                  <Badge color={color}>{hL[h]}</Badge>
                </div>
                <div style={{fontSize:11,color:C.muted,fontWeight:600,marginTop:6}}>{param.name}</div>
                <div style={{fontSize:22,fontWeight:900,color,marginTop:2,letterSpacing:-0.5}}>{val!==undefined&&val!==""?val:"—"}<span style={{fontSize:11,fontWeight:400,color:C.muted,marginLeft:3}}>{param.unit}</span></div>
                <Sparkline paramId={param.id} color={color} />
                <div style={{marginTop:5,fontSize:10,color:C.muted}}>Normal: {param.min}–{param.max} {param.unit}</div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={showForm} onClose={()=>setShowForm(false)} title="Manual OBD Reading">
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <F label="Date" type="date" value={form.date||new Date().toISOString().split("T")[0]} onChange={v=>setForm(p=>({...p,date:v}))} />
            <F label="Odometer (km)" type="number" value={form.odo||""} onChange={v=>setForm(p=>({...p,odo:v}))} placeholder="42500" />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {OBD_PARAMS.map(p=><F key={p.id} small label={`${p.icon} ${p.name} (${p.unit})`} type="number" value={form[p.id]||""} onChange={v=>setForm(p2=>({...p2,[p.id]:v}))} placeholder={`${p.min}–${p.max}`} />)}
          </div>
          <div style={{ display:"flex", gap:8 }}><Btn onClick={saveReading} color={C.green}>💾 Save Reading</Btn><Btn onClick={()=>setShowForm(false)} color={C.muted} outline>Cancel</Btn></div>
        </div>
      </Modal>

      <Modal open={showHistory} onClose={()=>setShowHistory(false)} title={`Reading History (${readings.length})`}>
        <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:420, overflowY:"auto" }}>
          {readings.slice(0,50).map(r=>(
            <div key={r.id} style={{ background:C.surface, borderRadius:8, padding:"9px 12px", border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}><span style={{fontSize:11,fontWeight:700,color:C.dimmed}}>📅 {r.date}</span>{r.odo&&<span style={{fontSize:10,color:C.muted}}>🚗 {r.odo} km</span>}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {OBD_PARAMS.filter(p=>r[p.id]!==undefined&&r[p.id]!=="").map(p=><span key={p.id} style={{fontSize:11,color:hC[getHealth(p,r[p.id])]}}>{p.icon} {r[p.id]}{p.unit}</span>)}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// ─── ISSUES LOG ───────────────────────────────────────────────────────────────
function IssuesPage({ vehicle, issues, onUpdate, onPushToWorkshop }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const blank = { title:"", description:"", date:new Date().toISOString().split("T")[0], odo:"", severity:"mild", status:"open" };
  const [form, setForm] = useState(blank);

  const save = async () => {
    if (!form.title) return;
    const updated = editItem
      ? issues.map(i=>i.id===editItem.id?{...form,id:editItem.id}:i)
      : [{...form,id:Date.now().toString(),odo:form.odo||vehicle.odo},...issues];
    await onUpdate(updated); setShowForm(false); setEditItem(null); setForm(blank);
  };

  const resolve = async (id) => await onUpdate(issues.map(i=>i.id===id?{...i,status:"resolved",resolvedDate:new Date().toISOString().split("T")[0]}:i));
  const del = async (id) => await onUpdate(issues.filter(i=>i.id!==id));

  const open = issues.filter(i=>i.status==="open");
  const resolved = issues.filter(i=>i.status==="resolved");
  const sC = { mild:C.green, moderate:C.yellow, severe:C.red };

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"12px 12px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{fontSize:11,color:C.muted}}>{open.length} open · {resolved.length} resolved</div>
          <Btn small onClick={()=>{ setForm(blank); setEditItem(null); setShowForm(true); }}>+ Log Issue</Btn>
        </div>

        {open.length>0 && (
          <div style={{ padding:"10px 12px", background:C.yellow+"0f", border:`1px solid ${C.yellow}33`, borderRadius:10, marginBottom:12 }}>
            <div style={{fontSize:11,fontWeight:700,color:C.yellow,marginBottom:6}}>{open.length} open issue{open.length!==1?"s":""}</div>
            <Btn small color={C.accent} onClick={()=>onPushToWorkshop(open.map(i=>i.title))}>Schedule Workshop for Open Issues →</Btn>
          </div>
        )}

        {issues.length===0 && (
          <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
            <div style={{fontSize:40,marginBottom:10}}>📝</div>
            <div style={{fontSize:14,color:C.dimmed}}>No issues logged yet</div>
            <div style={{fontSize:12,marginTop:4}}>Log anything unusual — noises, smells, behaviour changes</div>
          </div>
        )}

        {open.length>0 && (
          <>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:0.7,marginBottom:8}}>OPEN ISSUES ({open.length})</div>
            {open.map(issue=>(
              <div key={issue.id} style={{ background:C.card, border:`1px solid ${sC[issue.severity]+"44"}`, borderLeft:`3px solid ${sC[issue.severity]}`, borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{issue.title}</div>
                    {issue.description && <div style={{fontSize:12,color:C.dimmed,marginTop:3,lineHeight:1.5}}>{issue.description}</div>}
                    <div style={{display:"flex",gap:8,marginTop:5,alignItems:"center",flexWrap:"wrap"}}>
                      <Badge color={sC[issue.severity]}>{issue.severity}</Badge>
                      <span style={{fontSize:10,color:C.muted}}>📅 {issue.date}</span>
                      {issue.odo && <span style={{fontSize:10,color:C.muted}}>🚗 {issue.odo} km</span>}
                    </div>
                  </div>
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, marginTop:10, paddingTop:8, display:"flex", gap:8 }}>
                  <Btn small color={C.green} outline onClick={()=>resolve(issue.id)}>✓ Resolve</Btn>
                  <Btn small color={C.blue} outline onClick={()=>{ setForm({...issue}); setEditItem(issue); setShowForm(true); }}>✏️ Edit</Btn>
                  <Btn small color={C.accent} outline onClick={()=>onPushToWorkshop([issue.title])}>🏪 Workshop</Btn>
                  <Btn small color={C.red} outline onClick={()=>del(issue.id)}>🗑</Btn>
                </div>
              </div>
            ))}
          </>
        )}

        {resolved.length>0 && (
          <>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:0.7,marginBottom:8,marginTop:16}}>RESOLVED ({resolved.length})</div>
            {resolved.map(issue=>(
              <div key={issue.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.green}`, borderRadius:12, padding:"12px 14px", marginBottom:8, opacity:0.65 }}>
                <div style={{fontSize:13,fontWeight:600,color:C.dimmed,textDecoration:"line-through"}}>{issue.title}</div>
                <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
                  <Badge color={C.green} small>Resolved</Badge>
                  <span style={{fontSize:10,color:C.muted}}>📅 {issue.resolvedDate||issue.date}</span>
                </div>
                <button onClick={()=>del(issue.id)} style={{marginTop:6,background:"none",border:"none",color:C.red,fontSize:11,cursor:"pointer",padding:0}}>🗑 Delete</button>
              </div>
            ))}
          </>
        )}
      </div>

      <Modal open={showForm} onClose={()=>{ setShowForm(false); setEditItem(null); }} title={editItem?"Edit Issue":"Log New Issue"}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <F label="Issue Title *" required value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="e.g. Strange rattling noise from dashboard" />
          <TA label="Description" value={form.description} onChange={v=>setForm(p=>({...p,description:v}))} placeholder="When does it happen? Under what conditions? How often?" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <F label="Date" type="date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))} />
            <F label="Odometer (km)" type="number" value={form.odo} onChange={v=>setForm(p=>({...p,odo:v}))} placeholder={vehicle.odo} />
          </div>
          <DD label="Severity" value={form.severity} onChange={v=>setForm(p=>({...p,severity:v}))} options={[{value:"mild",label:"🟢 Mild — minor, not urgent"},{value:"moderate",label:"🟡 Moderate — needs attention soon"},{value:"severe",label:"🔴 Severe — affects safety or driveability"}]} />
          <div style={{ display:"flex", gap:8 }}><Btn onClick={save} color={C.green}>💾 {editItem?"Update":"Log Issue"}</Btn><Btn onClick={()=>{ setShowForm(false); setEditItem(null); }} color={C.muted} outline>Cancel</Btn></div>
        </div>
      </Modal>
    </div>
  );
}

// ─── REPAIR LOG ───────────────────────────────────────────────────────────────
function RepairPage({ vehicle, repairs, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const blank = { part:"", date:new Date().toISOString().split("T")[0], odo:"", category:"mechanical", workshop:"", cost:"", notes:"" };
  const [form, setForm] = useState(blank);

  const save = async () => {
    if (!form.part) return;
    const updated = editItem
      ? repairs.map(r=>r.id===editItem.id?{...form,id:editItem.id}:r)
      : [{...form,id:Date.now().toString()},...repairs];
    await onUpdate(updated); setShowForm(false); setEditItem(null); setForm(blank);
  };
  const del = async (id) => onUpdate(repairs.filter(r=>r.id!==id));

  const catC = { mechanical:C.accent, electrical:C.blue, ac:C.cyan, body:C.yellow, tyre:C.green, other:C.muted };
  const total = repairs.reduce((s,r)=>s+(parseFloat(r.cost)||0),0);

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"12px 12px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:0.5}}>TOTAL SPEND</div>
            <div style={{fontSize:22,fontWeight:900,color:C.accent,letterSpacing:-0.5}}>₹{total.toLocaleString("en-IN")}</div>
            <div style={{fontSize:11,color:C.muted}}>{repairs.length} entr{repairs.length!==1?"ies":"y"}</div>
          </div>
          <Btn small onClick={()=>{ setForm(blank); setEditItem(null); setShowForm(true); }}>+ Log Repair</Btn>
        </div>

        {repairs.length===0 && (
          <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
            <div style={{fontSize:40,marginBottom:10}}>🔩</div>
            <div style={{fontSize:14,color:C.dimmed}}>No repairs logged yet</div>
          </div>
        )}

        {repairs.map(r=>(
          <div key={r.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${catC[r.category]||C.muted}`, borderRadius:12, padding:14, marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:10 }}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:C.text}}>{r.part}</div>
                <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap",alignItems:"center"}}>
                  <Badge color={catC[r.category]||C.muted}>{r.category}</Badge>
                  <span style={{fontSize:11,color:C.muted}}>📅 {r.date}</span>
                  {r.odo && <span style={{fontSize:11,color:C.muted}}>🚗 {parseInt(r.odo).toLocaleString("en-IN")} km</span>}
                </div>
                {r.workshop && <div style={{fontSize:12,color:C.dimmed,marginTop:4}}>🏪 {r.workshop}</div>}
                {r.notes && <div style={{fontSize:12,color:C.muted,marginTop:3,fontStyle:"italic"}}>{r.notes}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                {r.cost && <div style={{fontSize:16,fontWeight:900,color:C.accent}}>₹{parseFloat(r.cost).toLocaleString("en-IN")}</div>}
                <div style={{display:"flex",gap:5,marginTop:8}}>
                  <Btn small outline color={C.blue} onClick={()=>{ setForm({...r}); setEditItem(r); setShowForm(true); }}>Edit</Btn>
                  <Btn small outline color={C.red} onClick={()=>del(r.id)}>Del</Btn>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showForm} onClose={()=>{ setShowForm(false); setEditItem(null); }} title={editItem?"Edit Repair":"Log Repair"}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <F label="Part / Work Done *" required value={form.part} onChange={v=>setForm(p=>({...p,part:v}))} placeholder="e.g. Slave Cylinder Replacement" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <F label="Date" type="date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))} />
            <F label="Odometer (km)" type="number" value={form.odo} onChange={v=>setForm(p=>({...p,odo:v}))} placeholder="42500" />
          </div>
          <DD label="Category" value={form.category} onChange={v=>setForm(p=>({...p,category:v}))} options={[{value:"mechanical",label:"⚙️ Mechanical"},{value:"electrical",label:"⚡ Electrical"},{value:"ac",label:"❄️ AC / Cooling"},{value:"body",label:"🚗 Body / Paint"},{value:"tyre",label:"🔄 Tyre / Suspension"},{value:"other",label:"📋 Other"}]} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <F label="Workshop" value={form.workshop} onChange={v=>setForm(p=>({...p,workshop:v}))} placeholder="Workshop name" />
            <F label="Cost (₹)" type="number" value={form.cost} onChange={v=>setForm(p=>({...p,cost:v}))} placeholder="0" />
          </div>
          <TA label="Notes" value={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Parts used, warranty, observations..." />
          <div style={{ display:"flex", gap:8 }}><Btn onClick={save} color={C.green}>💾 {editItem?"Update":"Save Repair"}</Btn><Btn onClick={()=>{ setShowForm(false); setEditItem(null); }} color={C.muted} outline>Cancel</Btn></div>
        </div>
      </Modal>
    </div>
  );
}

// ─── VISIT SCHEDULE ───────────────────────────────────────────────────────────
function VisitPage({ vehicle, visits, schedule, issues, obdAlerts, onUpdate }) {
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [actualCost, setActualCost] = useState("");

  const overdueItems = (schedule||[]).filter(i=>i.isActive&&getItemStatus(i,vehicle.odo)==="overdue");
  const dueSoonItems = (schedule||[]).filter(i=>i.isActive&&getItemStatus(i,vehicle.odo)==="due-soon");
  const openIssues = (issues||[]).filter(i=>i.status==="open");
  const allScheduleItems = (schedule||[]).filter(i=>i.isActive);

  const blank = () => ({ tentativeDate:"", workshop:"", estimatedCost:"", notes:"", items:[...overdueItems.map(i=>i.name),...dueSoonItems.map(i=>i.name),...obdAlerts,...openIssues.map(i=>i.title)], status:"upcoming" });

  const save = async () => {
    if (!form.tentativeDate) return;
    const updated = selected
      ? visits.map(v=>v.id===selected.id?{...form,id:selected.id}:v)
      : [{...form,id:Date.now().toString(),createdAt:new Date().toISOString()},...visits];
    await onUpdate(updated); setModal(null); setSelected(null);
  };

  const complete = async (id) => {
    const updated = visits.map(v=>v.id===id?{...v,status:"completed",completedDate:new Date().toISOString().split("T")[0],actualCost:actualCost||v.estimatedCost}:v);
    await onUpdate(updated); setModal(null); setActualCost("");
  };

  const del = async (id) => onUpdate(visits.filter(v=>v.id!==id));

  const upcoming = visits.filter(v=>v.status==="upcoming").sort((a,b)=>new Date(a.tentativeDate)-new Date(b.tentativeDate));
  const completed = visits.filter(v=>v.status==="completed").sort((a,b)=>new Date(b.completedDate||b.tentativeDate)-new Date(a.completedDate||a.tentativeDate));
  const hasAlerts = overdueItems.length>0||dueSoonItems.length>0||openIssues.length>0||obdAlerts.length>0;

  const VisitCard = ({ visit }) => {
    const d = getDaysUntil(visit.tentativeDate);
    const urg = visit.status==="completed"?C.green:d<0?C.red:d<7?C.red:d<14?C.yellow:C.blue;
    return (
      <div style={{ background:C.card, border:`1px solid ${urg+"44"}`, borderLeft:`4px solid ${urg}`, borderRadius:12, marginBottom:12, overflow:"hidden" }}>
        <div style={{ padding:"14px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div style={{flex:1}}>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                <span style={{fontSize:14,fontWeight:800,color:C.text}}>{visit.status==="completed"?"✅":"🏪"} Workshop Visit</span>
                <Badge color={urg}>{visit.status==="completed"?"Done":d<0?"Overdue":"Upcoming"}</Badge>
              </div>
              {visit.workshop && <div style={{fontSize:12,color:C.dimmed}}>📍 {visit.workshop}</div>}
              <div style={{fontSize:12,color:C.dimmed,marginTop:3}}>
                📅 {visit.status==="completed"?`Completed ${visit.completedDate||visit.tentativeDate}`:`Planned ${visit.tentativeDate}`}
                {visit.status!=="completed"&&d!==null&&d<7&&<span style={{color:urg,fontWeight:700,marginLeft:6}}>{d<0?`(${Math.abs(d)}d overdue)`:d===0?"(Today!)":d===1?"(Tomorrow)":`(${d}d away)`}</span>}
              </div>
            </div>
            {(visit.actualCost||visit.estimatedCost) && (
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <div style={{fontSize:16,fontWeight:900,color:C.accent}}>₹{parseFloat(visit.actualCost||visit.estimatedCost).toLocaleString("en-IN")}</div>
                <div style={{fontSize:9,color:C.muted}}>{visit.actualCost?"actual":"estimated"}</div>
              </div>
            )}
          </div>
          {visit.items?.length>0 && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:0.5,marginBottom:5}}>ITEMS ({visit.items.length})</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{visit.items.map((it,i)=><Badge key={i} color={C.blue}>{it}</Badge>)}</div>
            </div>
          )}
          {visit.notes && <div style={{fontSize:12,color:C.muted,marginTop:8,fontStyle:"italic"}}>{visit.notes}</div>}
        </div>
        {visit.status!=="completed" && (
          <div style={{ borderTop:`1px solid ${C.border}`, display:"flex" }}>
            <button onClick={()=>{ setSelected(visit); setForm({...visit}); setModal("edit"); }} style={{ flex:1, background:"none", border:"none", padding:"9px", color:C.blue, fontSize:11, fontWeight:700, cursor:"pointer" }}>✏️ Edit</button>
            <button onClick={()=>{ setSelected(visit); setModal("complete"); }} style={{ flex:1, background:"none", border:"none", padding:"9px", color:C.green, fontSize:11, fontWeight:700, cursor:"pointer", borderLeft:`1px solid ${C.border}` }}>✓ Complete</button>
            <button onClick={()=>del(visit.id)} style={{ flex:1, background:"none", border:"none", padding:"9px", color:C.red, fontSize:11, cursor:"pointer", borderLeft:`1px solid ${C.border}` }}>🗑 Delete</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ paddingBottom:20 }}>
      <div style={{ padding:"12px 12px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{fontSize:11,color:C.muted}}>{upcoming.length} upcoming · {completed.length} completed</div>
          <Btn small onClick={()=>{ setForm(blank()); setSelected(null); setModal("edit"); }}>+ Plan Visit</Btn>
        </div>

        {hasAlerts && upcoming.length===0 && (
          <div style={{ padding:"12px 14px", background:C.yellow+"0f", border:`1px solid ${C.yellow}44`, borderRadius:10, marginBottom:12 }}>
            <div style={{fontSize:12,fontWeight:700,color:C.yellow,marginBottom:6}}>💡 Items flagged for workshop attention</div>
            {overdueItems.length>0 && <div style={{fontSize:11,color:C.red,marginBottom:2}}>🔴 {overdueItems.length} maintenance items overdue</div>}
            {dueSoonItems.length>0 && <div style={{fontSize:11,color:C.yellow,marginBottom:2}}>🟡 {dueSoonItems.length} maintenance items due soon</div>}
            {openIssues.length>0 && <div style={{fontSize:11,color:C.orange,marginBottom:2}}>📝 {openIssues.length} open issues logged</div>}
            {obdAlerts.length>0 && <div style={{fontSize:11,color:C.red,marginBottom:2}}>📊 {obdAlerts.length} OBD parameters out of range</div>}
            <button onClick={()=>{ setForm(blank()); setSelected(null); setModal("edit"); }} style={{marginTop:8,background:"none",border:"none",color:C.accent,fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}>Plan a workshop visit now →</button>
          </div>
        )}

        {upcoming.length===0&&completed.length===0 && (
          <div style={{ textAlign:"center", padding:"50px 20px", color:C.muted }}>
            <div style={{fontSize:48,marginBottom:12}}>🏪</div>
            <div style={{fontSize:14,color:C.dimmed,marginBottom:6}}>No workshop visits planned</div>
            <div style={{fontSize:12,marginBottom:20}}>Plan ahead — avoid emergency repair stress</div>
            <Btn onClick={()=>{ setForm(blank()); setSelected(null); setModal("edit"); }}>+ Plan First Visit</Btn>
          </div>
        )}

        {upcoming.length>0 && <>
          <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:0.7,marginBottom:10}}>UPCOMING ({upcoming.length})</div>
          {upcoming.map(v=><VisitCard key={v.id} visit={v}/>)}
        </>}

        {completed.length>0 && <>
          <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:0.7,marginBottom:10,marginTop:upcoming.length>0?16:0}}>COMPLETED ({completed.length})</div>
          {completed.map(v=><VisitCard key={v.id} visit={v}/>)}
        </>}
      </div>

      <Modal open={modal==="edit"} onClose={()=>setModal(null)} title={selected?"Edit Workshop Visit":"Plan Workshop Visit"} wide>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <F label="Planned Date *" type="date" required value={form.tentativeDate||""} onChange={v=>setForm(p=>({...p,tentativeDate:v}))} />
            <F label="Workshop / Dealer" value={form.workshop||""} onChange={v=>setForm(p=>({...p,workshop:v}))} placeholder="Workshop name" />
          </div>
          <F label="Estimated Cost (₹)" type="number" value={form.estimatedCost||""} onChange={v=>setForm(p=>({...p,estimatedCost:v}))} placeholder="0" />
          <div>
            <label style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase",display:"block",marginBottom:8}}>Items to Address — tap to select / deselect</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {allScheduleItems.map(item=>{
                const sel=(form.items||[]).includes(item.name);
                const s=getItemStatus(item,vehicle.odo);
                const sc=s==="overdue"?C.red:s==="due-soon"?C.yellow:C.muted;
                return <button key={item.id} onClick={()=>{ const cur=form.items||[]; setForm(p=>({...p,items:sel?cur.filter(i=>i!==item.name):[...cur,item.name]})); }} style={{ background:sel?sc+"22":"transparent", border:`1px solid ${sel?sc:C.border}`, borderRadius:6, padding:"4px 10px", fontSize:11, color:sel?sc:C.muted, cursor:"pointer", fontWeight:sel?700:400 }}>{item.name}</button>;
              })}
              {openIssues.map(issue=>{
                const sel=(form.items||[]).includes(issue.title);
                return <button key={issue.id} onClick={()=>{ const cur=form.items||[]; setForm(p=>({...p,items:sel?cur.filter(i=>i!==issue.title):[...cur,issue.title]})); }} style={{ background:sel?C.yellow+"22":"transparent", border:`1px solid ${sel?C.yellow:C.border}`, borderRadius:6, padding:"4px 10px", fontSize:11, color:sel?C.yellow:C.muted, cursor:"pointer", fontWeight:sel?700:400 }}>📝 {issue.title}</button>;
              })}
            </div>
          </div>
          <TA label="Notes for Workshop" value={form.notes||""} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Instructions, parts to source, questions to ask..." />
          <div style={{ display:"flex", gap:8 }}><Btn onClick={save} color={C.green}>💾 {selected?"Update":"Save Visit"}</Btn><Btn onClick={()=>setModal(null)} color={C.muted} outline>Cancel</Btn></div>
        </div>
      </Modal>

      <Modal open={modal==="complete"} onClose={()=>setModal(null)} title="Mark Visit Complete">
        {selected && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {selected.items?.length>0 && <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{selected.items.map((it,i)=><Badge key={i} color={C.green}>{it}</Badge>)}</div>}
            <F label="Actual Cost (₹)" type="number" value={actualCost} onChange={setActualCost} placeholder={selected.estimatedCost||"0"} />
            <div style={{ display:"flex", gap:8 }}><Btn onClick={()=>complete(selected.id)} color={C.green}>✓ Mark Complete</Btn><Btn onClick={()=>setModal(null)} color={C.muted} outline>Cancel</Btn></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── HEALTH PAGE (container with sub-tabs) ────────────────────────────────────
function HealthPage({ vehicle, data, onDataUpdate, workshopVisits, onVisitsUpdate }) {
  const [subTab, setSubTab] = useState("maintenance");

  const updateSchedule = async (u) => onDataUpdate({ ...data, schedule:u });
  const updateOBD = async (u) => onDataUpdate({ ...data, obdReadings:u });
  const updateIssues = async (u) => onDataUpdate({ ...data, issues:u });
  const updateRepairs = async (u) => onDataUpdate({ ...data, repairs:u });

  const latest = (data.obdReadings||[])[0]||{};
  const obdAlerts = OBD_PARAMS.filter(p=>{
    const v=parseFloat(latest[p.id]); if(isNaN(v)) return false;
    if(p.danger===null) return false;
    if(p.id.includes("trim")) return Math.abs(v)>p.danger;
    if(p.id==="battery_off"||p.id==="battery_on") return v<p.danger;
    return v>=p.danger;
  }).map(p=>p.name+" alert");

  const pushToWorkshop = (items) => {
    setSubTab("visit");
  };

  const subTabs = [
    { id:"maintenance", icon:"🔧", label:"Maintenance" },
    { id:"obd", icon:"📊", label:"OBD Logs" },
    { id:"issues", icon:"📝", label:"Issues" },
    { id:"repairs", icon:"🔩", label:"Repairs" },
    { id:"visit", icon:"🏪", label:"Visit" },
  ];

  const overN = (data.schedule||[]).filter(i=>i.isActive&&getItemStatus(i,vehicle.odo)==="overdue").length;
  const dueN = (data.schedule||[]).filter(i=>i.isActive&&getItemStatus(i,vehicle.odo)==="due-soon").length;
  const openN = (data.issues||[]).filter(i=>i.status==="open").length;
  const upcomingN = (workshopVisits||[]).filter(v=>v.status==="upcoming").length;

  const badge = { maintenance:overN+dueN, obd:obdAlerts.length, issues:openN, repairs:0, visit:upcomingN };

  return (
    <div style={{ paddingBottom:80 }}>
      {/* Vehicle header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"10px 16px" }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{vehicle.make} {vehicle.model} · {vehicle.year}</div>
        <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>🚗 {vehicle.odo?parseInt(vehicle.odo).toLocaleString("en-IN")+" km":"Odo not set"} · {vehicle.fuel} · {vehicle.gearbox}</div>
      </div>

      {/* Sub-tab bar */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex", overflowX:"auto" }}>
        {subTabs.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)} style={{ flex:"0 0 auto", background:"none", border:"none", padding:"10px 14px 8px", color:subTab===t.id?C.accent:C.muted, cursor:"pointer", borderBottom:`2px solid ${subTab===t.id?C.accent:"transparent"}`, whiteSpace:"nowrap", position:"relative" }}>
            <div style={{fontSize:16}}>{t.icon}</div>
            <div style={{fontSize:9,fontWeight:700,marginTop:2,letterSpacing:0.4}}>{t.label.toUpperCase()}</div>
            {badge[t.id]>0 && <div style={{ position:"absolute", top:6, right:8, background:C.red, color:"#fff", borderRadius:"50%", width:14, height:14, fontSize:8, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{badge[t.id]}</div>}
          </button>
        ))}
      </div>

      {subTab==="maintenance" && <MaintenancePage vehicle={vehicle} schedule={data.schedule||[]} onUpdate={updateSchedule} onPushToWorkshop={pushToWorkshop} />}
      {subTab==="obd" && <OBDPage vehicle={vehicle} readings={data.obdReadings||[]} onUpdate={updateOBD} onPushToWorkshop={()=>setSubTab("visit")} />}
      {subTab==="issues" && <IssuesPage vehicle={vehicle} issues={data.issues||[]} onUpdate={updateIssues} onPushToWorkshop={pushToWorkshop} />}
      {subTab==="repairs" && <RepairPage vehicle={vehicle} repairs={data.repairs||[]} onUpdate={updateRepairs} />}
      {subTab==="visit" && <VisitPage vehicle={vehicle} visits={workshopVisits||[]} schedule={data.schedule||[]} issues={data.issues||[]} obdAlerts={obdAlerts} onUpdate={onVisitsUpdate} />}
    </div>
  );
}

// ─── DOCUMENTS PAGE ───────────────────────────────────────────────────────────
function DocumentsPage({ vehicle, docs, onUpdate }) {
  const [activeSection, setActiveSection] = useState("rc");
  const [showUpload, setShowUpload] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [uploadForm, setUploadForm] = useState({ name:"", notes:"", fileData:null, fileName:null, fileType:null });
  const [contactForm, setContactForm] = useState({ name:"", phone:"", role:"", notes:"" });
  const [viewing, setViewing] = useState(null);
  const fileRef = useRef();

  const sections = {
    rc: { label:"RC / Registration", icon:"📋", color:C.blue },
    licence: { label:"Driving Licence", icon:"🪪", color:C.green },
    manual: { label:"Vehicle Manual", icon:"📖", color:C.accent },
    contacts: { label:"Contact Details", icon:"📞", color:C.cyan },
  };

  const sectionDocs = (docs[activeSection]||[]);

  const handleFile = (e) => {
    const file = e.target.files[0]; if(!file) return;
    if(file.size>4*1024*1024){ alert("Max 4MB"); return; }
    const reader = new FileReader();
    reader.onload = ev => setUploadForm(f=>({...f,fileData:ev.target.result,fileName:file.name,fileType:file.type}));
    reader.readAsDataURL(file);
  };

  const saveDoc = async () => {
    if(!uploadForm.name&&!uploadForm.fileData) return;
    const d = {...uploadForm, id:Date.now().toString(), date:new Date().toISOString().split("T")[0]};
    const updated = {...docs,[activeSection]:[d,...(docs[activeSection]||[])]};
    await onUpdate(updated); setShowUpload(false); setUploadForm({name:"",notes:"",fileData:null,fileName:null,fileType:null});
  };

  const delDoc = async (id) => {
    const updated = {...docs,[activeSection]:(docs[activeSection]||[]).filter(d=>d.id!==id)};
    await onUpdate(updated);
  };

  const saveContact = async () => {
    if(!contactForm.name) return;
    const contacts = docs.contacts||[];
    const updated = {...docs, contacts: editContact
      ? contacts.map(c=>c.id===editContact.id?{...contactForm,id:editContact.id}:c)
      : [{...contactForm,id:Date.now().toString()},...contacts]
    };
    await onUpdate(updated); setShowContact(false); setEditContact(null); setContactForm({name:"",phone:"",role:"",notes:""});
  };

  const delContact = async (id) => {
    await onUpdate({...docs,contacts:(docs.contacts||[]).filter(c=>c.id!==id)});
  };

  const meta = sections[activeSection];

  return (
    <div style={{ paddingBottom:80 }}>
      {/* Vehicle header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"10px 16px" }}>
        <div style={{fontSize:13,fontWeight:800,color:C.text}}>{vehicle.make} {vehicle.model} · {vehicle.year}</div>
        <div style={{fontSize:11,color:C.muted,marginTop:1}}>{vehicle.reg||"No reg set"}</div>
      </div>

      {/* Section tabs */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, display:"flex" }}>
        {Object.entries(sections).map(([key,s])=>(
          <button key={key} onClick={()=>setActiveSection(key)} style={{ flex:1, background:"none", border:"none", padding:"10px 4px 8px", color:activeSection===key?s.color:C.muted, cursor:"pointer", borderBottom:`2px solid ${activeSection===key?s.color:"transparent"}` }}>
            <div style={{fontSize:16}}>{s.icon}</div>
            <div style={{fontSize:8,fontWeight:700,marginTop:2,letterSpacing:0.3}}>{s.label.toUpperCase().split(" ")[0]}</div>
          </button>
        ))}
      </div>

      <div style={{ padding:"12px 12px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{fontSize:13,fontWeight:700,color:meta.color}}>{meta.icon} {meta.label}</div>
          {activeSection==="contacts"
            ? <Btn small onClick={()=>{ setContactForm({name:"",phone:"",role:"",notes:""}); setEditContact(null); setShowContact(true); }}>+ Add Contact</Btn>
            : <Btn small onClick={()=>setShowUpload(true)}>+ Upload</Btn>
          }
        </div>

        {/* Contacts section */}
        {activeSection==="contacts" && (
          <>
            {(docs.contacts||[]).length===0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
                <div style={{fontSize:40,marginBottom:10}}>📞</div>
                <div style={{fontSize:14,color:C.dimmed}}>No contacts saved yet</div>
                <div style={{fontSize:12,marginTop:4}}>Save mechanic, dealer, insurance and emergency contacts</div>
              </div>
            )}
            {(docs.contacts||[]).map(c=>(
              <div key={c.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.cyan}`, borderRadius:12, padding:14, marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{c.name}</div>
                    {c.role && <div style={{fontSize:11,color:C.dimmed,marginTop:2}}>{c.role}</div>}
                    {c.notes && <div style={{fontSize:12,color:C.muted,marginTop:4,lineHeight:1.5,fontStyle:"italic"}}>{c.notes}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.green+"22", border:`1px solid ${C.green}44`, borderRadius:8, padding:"6px 12px", color:C.green, textDecoration:"none", fontSize:13, fontWeight:700 }}>
                        📞 {c.phone}
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, marginTop:10, paddingTop:8, display:"flex", gap:8 }}>
                  <Btn small outline color={C.blue} onClick={()=>{ setContactForm({...c}); setEditContact(c); setShowContact(true); }}>✏️ Edit</Btn>
                  <Btn small outline color={C.red} onClick={()=>delContact(c.id)}>🗑 Delete</Btn>
                </div>
              </div>
            ))}
          </>
        )}

        {/* File sections */}
        {activeSection!=="contacts" && (
          <>
            {sectionDocs.length===0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:C.muted }}>
                <div style={{fontSize:40,marginBottom:10}}>{meta.icon}</div>
                <div style={{fontSize:14,color:C.dimmed}}>No {meta.label} documents uploaded</div>
                <div style={{fontSize:12,marginTop:4}}>Upload images or PDFs (max 4MB each)</div>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10 }}>
              {sectionDocs.map(doc=>(
                <div key={doc.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", borderTop:`3px solid ${meta.color}` }}>
                  <div onClick={()=>doc.fileData&&setViewing(doc)} style={{cursor:doc.fileData?"pointer":"default"}}>
                    {doc.fileData&&doc.fileType?.startsWith("image/")
                      ? <div style={{height:85,overflow:"hidden"}}><img src={doc.fileData} alt={doc.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
                      : <div style={{height:85,display:"flex",alignItems:"center",justifyContent:"center",background:C.surface,fontSize:34,color:meta.color}}>{doc.fileType?.includes("pdf")?"📄":doc.fileData?"📎":meta.icon}</div>
                    }
                  </div>
                  <div style={{padding:"8px 10px"}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name||doc.fileName||"Document"}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{doc.date}</div>
                    {doc.notes && <div style={{fontSize:10,color:C.muted,marginTop:2,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.notes}</div>}
                    <button onClick={()=>delDoc(doc.id)} style={{marginTop:6,background:"none",border:"none",color:C.red,fontSize:11,cursor:"pointer",padding:0}}>🗑 Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={()=>setShowUpload(false)} title={`Upload ${meta.label}`}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <F label="Document Name" value={uploadForm.name} onChange={v=>setUploadForm(p=>({...p,name:v}))} placeholder={`e.g. ${meta.label} 2024`} />
          <div>
            <label style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:0.7,textTransform:"uppercase"}}>File (Image / PDF · max 4MB)</label>
            <div style={{marginTop:8}}>
              <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} style={{display:"none"}} />
              <Btn onClick={()=>fileRef.current.click()} color={C.blue} outline>{uploadForm.fileName?`📎 ${uploadForm.fileName.substring(0,24)}…`:"📎 Choose File"}</Btn>
            </div>
          </div>
          <TA label="Notes" value={uploadForm.notes} onChange={v=>setUploadForm(p=>({...p,notes:v}))} placeholder="Validity, remarks..." rows={2} />
          <div style={{ display:"flex", gap:8 }}><Btn onClick={saveDoc} color={C.green}>💾 Save</Btn><Btn onClick={()=>setShowUpload(false)} color={C.muted} outline>Cancel</Btn></div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewing} onClose={()=>setViewing(null)} title={viewing?.name||"Document"}>
        {viewing && (
          <div>
            {viewing.fileType?.startsWith("image/") && <img src={viewing.fileData} alt={viewing.name} style={{width:"100%",borderRadius:8}} />}
            {viewing.fileType?.includes("pdf") && <div style={{textAlign:"center",padding:24}}><div style={{fontSize:48,marginBottom:12}}>📄</div><a href={viewing.fileData} download={viewing.fileName} style={{color:C.accent,textDecoration:"none",fontSize:14,fontWeight:600}}>⬇️ Download {viewing.fileName}</a></div>}
            {viewing.notes && <div style={{marginTop:12,fontSize:13,color:C.muted,fontStyle:"italic",borderTop:`1px solid ${C.border}`,paddingTop:12}}>{viewing.notes}</div>}
          </div>
        )}
      </Modal>

      {/* Contact Modal */}
      <Modal open={showContact} onClose={()=>{ setShowContact(false); setEditContact(null); }} title={editContact?"Edit Contact":"Add Contact"}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <F label="Name *" required value={contactForm.name} onChange={v=>setContactForm(p=>({...p,name:v}))} placeholder="e.g. Ravi — Mechanic" />
          <F label="Phone Number" type="tel" value={contactForm.phone} onChange={v=>setContactForm(p=>({...p,phone:v}))} placeholder="+91 98765 43210" />
          <F label="Role / Type" value={contactForm.role} onChange={v=>setContactForm(p=>({...p,role:v}))} placeholder="e.g. Mechanic, Insurance Agent, Dealer, Emergency" />
          <TA label="Notes" value={contactForm.notes} onChange={v=>setContactForm(p=>({...p,notes:v}))} placeholder="Address, timing, any useful info..." rows={3} />
          {contactForm.phone && (
            <div style={{padding:"8px 12px",background:C.surface,borderRadius:8,fontSize:12,color:C.muted}}>
              Tap to test: <a href={`tel:${contactForm.phone}`} style={{color:C.green,fontWeight:700}}>📞 Call {contactForm.phone}</a>
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}><Btn onClick={saveContact} color={C.green}>💾 {editContact?"Update":"Save Contact"}</Btn><Btn onClick={()=>{ setShowContact(false); setEditContact(null); }} color={C.muted} outline>Cancel</Btn></div>
        </div>
      </Modal>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleData, setVehicleData] = useState({});   // { [vehicleId]: { schedule, obdReadings, issues, repairs } }
  const [workshopVisits, setWorkshopVisits] = useState({});
  const [documents, setDocuments] = useState({});       // { [vehicleId]: { rc:[], licence:[], manual:[], contacts:[] } }
  const [activeVehicleId, setActiveVehicleId] = useState(null);
  const [tab, setTab] = useState("garage");
  const [vehicleModal, setVehicleModal] = useState(null);

  useEffect(()=>{
    const load = async () => {
      const v = await store.get("tnv2_vehicles"); if(v) setVehicles(v);
      const d = await store.get("tnv2_vehicleData"); if(d) setVehicleData(d);
      const w = await store.get("tnv2_visits"); if(w) setWorkshopVisits(w);
      const doc = await store.get("tnv2_documents"); if(doc) setDocuments(doc);
    };
    load();
  },[]);

  const activeVehicle = vehicles.find(v=>v.id===activeVehicleId);

  const saveVehicles = async (v) => { setVehicles(v); await store.set("tnv2_vehicles",v); };
  const saveVehicleData = async (d) => { setVehicleData(d); await store.set("tnv2_vehicleData",d); };
  const saveVisits = async (v) => { setWorkshopVisits(v); await store.set("tnv2_visits",v); };
  const saveDocuments = async (d) => { setDocuments(d); await store.set("tnv2_documents",d); };

  const addVehicle = async (form) => {
    const id = `v_${Date.now()}`;
    const vehicle = {...form, id, year:parseInt(form.year), odo:parseFloat(form.odo)||0};
    const newVehicles = [...vehicles, vehicle];
    const newData = {...vehicleData, [id]:{ schedule:generateSchedule(vehicle), obdReadings:[], issues:[], repairs:[] }};
    await saveVehicles(newVehicles); await saveVehicleData(newData);
    setActiveVehicleId(id); setTab("health"); setVehicleModal(null);
  };

  const editVehicle = async (form) => {
    const vehicle = {...form, year:parseInt(form.year), odo:parseFloat(form.odo)||0};
    await saveVehicles(vehicles.map(v=>v.id===vehicle.id?vehicle:v));
    setVehicleModal(null);
  };

  const updateVehicleData = async (vehicleId, updated) => {
    const newData = {...vehicleData, [vehicleId]:updated};
    await saveVehicleData(newData);
  };

  const updateVisits = async (vehicleId, updated) => {
    const newVisits = {...workshopVisits, [vehicleId]:updated};
    await saveVisits(newVisits);
  };

  const updateDocuments = async (vehicleId, updated) => {
    const newDocs = {...documents, [vehicleId]:updated};
    await saveDocuments(newDocs);
  };

  const tabs = [
    { id:"garage", icon:"🏠", label:"Garage" },
    { id:"health", icon:"🩺", label:"Health" },
    { id:"documents", icon:"📁", label:"Documents" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif", maxWidth:680, margin:"0 auto" }}>
      {/* Top bar */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"10px 16px", position:"sticky", top:0, zIndex:100, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div onClick={()=>setTab("garage")} style={{cursor:"pointer"}}>
          <div style={{fontSize:16,fontWeight:900,letterSpacing:-0.5}}><span style={{color:C.accent}}>Track</span><span style={{color:C.text}}>N</span><span style={{color:C.green}}>Save</span></div>
          {activeVehicle && tab!=="garage" && <div style={{fontSize:10,color:C.muted,marginTop:1}}>{activeVehicle.make} {activeVehicle.model} · {activeVehicle.year}{activeVehicle.odo?" · "+parseInt(activeVehicle.odo).toLocaleString("en-IN")+" km":""}</div>}
        </div>
        {tab!=="garage" && activeVehicle && <button onClick={()=>setTab("garage")} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px",color:C.muted,fontSize:10,cursor:"pointer",fontWeight:600}}>← Garage</button>}
      </div>

      {/* Pages */}
      {tab==="garage" && (
        <GaragePage
          vehicles={vehicles}
          schedules={Object.fromEntries(Object.entries(vehicleData).map(([id,d])=>[id,d.schedule||[]]))}
          visits={workshopVisits}
          onSelect={v=>{ setActiveVehicleId(v.id); setTab("health"); }}
          onAdd={()=>setVehicleModal("add")}
          onEdit={v=>setVehicleModal(v)}
        />
      )}

      {tab==="health" && activeVehicle && (
        <HealthPage
          vehicle={activeVehicle}
          data={vehicleData[activeVehicleId]||{schedule:[],obdReadings:[],issues:[],repairs:[]}}
          onDataUpdate={u=>updateVehicleData(activeVehicleId,u)}
          workshopVisits={workshopVisits[activeVehicleId]||[]}
          onVisitsUpdate={u=>updateVisits(activeVehicleId,u)}
        />
      )}

      {tab==="documents" && activeVehicle && (
        <DocumentsPage
          vehicle={activeVehicle}
          docs={documents[activeVehicleId]||{}}
          onUpdate={u=>updateDocuments(activeVehicleId,u)}
        />
      )}

      {tab!=="garage" && !activeVehicle && (
        <div style={{textAlign:"center",padding:"80px 20px",color:C.muted}}>
          <div style={{fontSize:48,marginBottom:16}}>🚗</div>
          <div style={{fontSize:14,color:C.dimmed,marginBottom:16}}>Select a vehicle from your garage first</div>
          <Btn onClick={()=>setTab("garage")} color={C.accent}>← Go to Garage</Btn>
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:680, background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:200 }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, background:"none", border:"none", padding:"10px 0 8px", color:tab===t.id?C.accent:C.muted, cursor:"pointer", borderTop:`2px solid ${tab===t.id?C.accent:"transparent"}` }}>
            <div style={{fontSize:20}}>{t.icon}</div>
            <div style={{fontSize:9,fontWeight:700,marginTop:2,letterSpacing:0.4}}>{t.label.toUpperCase()}</div>
          </button>
        ))}
      </div>

      {/* Vehicle Modal */}
      <Modal open={!!vehicleModal} onClose={()=>setVehicleModal(null)} title={vehicleModal==="add"?"Add Vehicle to Garage":`Edit — ${vehicleModal?.make} ${vehicleModal?.model}`} wide>
        <VehicleForm initial={vehicleModal==="add"?null:vehicleModal} onSave={vehicleModal==="add"?addVehicle:editVehicle} onCancel={()=>setVehicleModal(null)} />
      </Modal>
    </div>
  );
}