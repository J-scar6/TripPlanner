import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  MapPinned,
  Plane,
  TrainFront,
  BusFront,
  Ship,
  Bed,
  Upload,
  Download,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CircleHelp,
  DollarSign,
  ListTodo,
  Cloud,
  LogIn,
  LogOut,
  Settings2,
  Loader2,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Utils
const uid = () => Math.random().toString(36).slice(2);
const toISO = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const fromISO = (s) => { if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; };
const diffDays = (a, b) => (!a || !b ? 0 : Math.max(0, Math.round((fromISO(b) - fromISO(a)) / 86400000)));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const addDaysISO = (s, days) => { const d = fromISO(s); if (!d) return s; d.setDate(d.getDate() + days); return toISO(d); };

// ICS helpers
function icsEscape(text = "") {
  return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
const ICS_NL = "\r\n";
const fmtDate = (iso) => (iso ? iso.replaceAll("-", "") : "");
const fmtDT = (iso, hhmm) => `${fmtDate(iso)}T${(hhmm||"00:00").split(":")[0].padStart(2,"0")}${(hhmm||"00:00").split(":")[1].padStart(2,"0")}00`;
const lineDate = (key, iso) => `${key};VALUE=DATE:${fmtDate(iso)}`;
const lineDT = (key, iso, hhmm) => `${key}:${fmtDT(iso, hhmm)}`;
function buildICS(data){
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const L = ["BEGIN:VCALENDAR","PRODID:-//Trip Planner//EN","VERSION:2.0","CALSCALE:GREGORIAN","METHOD:PUBLISH"]; 
  for (const seg of data.segments) {
    for (const st of seg.stays || []){
      if (!st.checkIn || !st.checkOut) continue;
      L.push("BEGIN:VEVENT", `UID:${uid()}@trip`, `DTSTAMP:${now}`);
      if (st.checkInTime || st.checkOutTime) {
        L.push(lineDT("DTSTART", st.checkIn, st.checkInTime||"15:00"));
        if (st.checkOutTime) L.push(lineDT("DTEND", st.checkOut, st.checkOutTime));
      } else {
        L.push(lineDate("DTSTART", st.checkIn), lineDate("DTEND", st.checkOut));
      }
      L.push(
        `SUMMARY:${icsEscape(`Stay: ${st.name} — ${seg.country}`)}`,
        st.address ? `LOCATION:${icsEscape(st.address)}` : undefined,
        st.notes ? `DESCRIPTION:${icsEscape(st.notes)}` : undefined,
        "END:VEVENT"
      );
    }
    for (const key of ["transportIn","transportOut"]) {
      const t = seg[key]; if (!t || !t.date) continue;
      L.push("BEGIN:VEVENT", `UID:${uid()}@trip`, `DTSTAMP:${now}`);
      if (t.departTime) {
        L.push(lineDT("DTSTART", t.date, t.departTime));
        if (t.arriveDate && t.arriveTime) L.push(lineDT("DTEND", t.arriveDate, t.arriveTime));
      } else {
        L.push(lineDate("DTSTART", t.date), lineDate("DTEND", addDaysISO(t.date,1)));
      }
      const summary = `${t.type||"Transport"}: ${t.from||""} → ${t.to||""} — ${seg.country}`.trim();
      const desc = [t.ref && `Ref: ${t.ref}`, t.note].filter(Boolean).join(" | ");
      L.push(`SUMMARY:${icsEscape(summary)}`, desc?`DESCRIPTION:${icsEscape(desc)}`:undefined, "END:VEVENT");
    }
  }
  L.push("END:VCALENDAR");
  return L.filter(Boolean).join(ICS_NL);
}

const TRANSPORT_ICONS = { Flight: Plane, Train: TrainFront, Bus: BusFront, Ferry: Ship };
const CATEGORY_COLORS = { History:"bg-indigo-100 text-indigo-800", Nature:"bg-emerald-100 text-emerald-800", Food:"bg-rose-100 text-rose-800", Nightlife:"bg-purple-100 text-purple-800", Culture:"bg-amber-100 text-amber-900", Study:"bg-sky-100 text-sky-800", Transport:"bg-blue-100 text-blue-800", Lodging:"bg-teal-100 text-teal-800", Misc:"bg-zinc-100 text-zinc-700" };

// Seed — trimmed to Norway
const seedItinerary = () => ({
  title: "Fall 2025 Europe — Jack",
  dailyStudyHoursDefault: 1.0,
  checklist: [
    { id: uid(), text: "Passport + 2 photocopies", done: false },
    { id: uid(), text: "UF laptop + charger", done: false },
    { id: uid(), text: "EU power adapter", done: false },
    { id: uid(), text: "AT&T/eSIM details ready", done: false },
  ],
  segments: [
    { id: uid(), country: "Netherlands", cities:["Amsterdam"], startDate:"2025-09-11", endDate:"2025-09-13", status:"confirmed", budget:450, dailyStudyHours:1.0,
      stays:[{ id: uid(), name:"Social Hostel (Dorm)", type:"Hostel", address:"Centrum, Amsterdam", checkIn:"2025-09-11", checkOut:"2025-09-13", checkInTime:"15:00", checkOutTime:"10:00", costPerNight:55 }],
      places:[{ id: uid(), name:"Rijksmuseum", city:"Amsterdam", category:"History", priority:5 }],
      spend:[{ id: uid(), date:"2025-09-11", category:"Transport", note:"Airport train + tram day pass", amount:18 }],
      transportIn:{ id: uid(), type:"Flight", from:"TPA", to:"AMS", date:"2025-09-11", departTime:"08:00", arriveDate:"2025-09-11", arriveTime:"22:00", cost:500 },
      transportOut:{ id: uid(), type:"Train", from:"Amsterdam", to:"Munich", date:"2025-09-19", departTime:"08:00", arriveDate:"2025-09-19", arriveTime:"17:00", cost:120 }
    },
    { id: uid(), country: "Germany", cities:["Munich"], startDate:"2025-09-20", endDate:"2025-09-22", status:"tentative", budget:500, dailyStudyHours:0.5,
      places:[{ id: uid(), name:"Residenz Museum", city:"Munich", category:"History", priority:4 }],
      spend:[], transportIn:{ id: uid(), type:"Train", from:"Amsterdam", to:"Munich", date:"2025-09-20", departTime:"08:00", arriveDate:"2025-09-20", arriveTime:"16:00", cost:120 },
      transportOut:{ id: uid(), type:"Train", from:"Munich", to:"Copenhagen", date:"2025-09-22", departTime:"09:00", arriveDate:"2025-09-22", arriveTime:"18:00", cost:140 }
    },
    { id: uid(), country: "Denmark", cities:["Copenhagen"], startDate:"2025-09-22", endDate:"2025-09-25", status:"confirmed", budget:600, dailyStudyHours:1.0,
      places:[{ id: uid(), name:"National Museum of Denmark", city:"Copenhagen", category:"History", priority:5 }],
      spend:[], transportIn:{ id: uid(), type:"Train", from:"Munich", to:"Copenhagen", date:"2025-09-22", departTime:"09:00", arriveDate:"2025-09-22", arriveTime:"18:00", cost:140 },
      transportOut:{ id: uid(), type:"Train", from:"Copenhagen", to:"Stockholm", date:"2025-09-25", departTime:"10:00", arriveDate:"2025-09-25", arriveTime:"15:00", cost:70 }
    },
    { id: uid(), country: "Sweden", cities:["Stockholm","Gothenburg"], startDate:"2025-09-25", endDate:"2025-10-03", status:"confirmed", budget:900, dailyStudyHours:1.5,
      places:[{ id: uid(), name:"Vasa Museum", city:"Stockholm", category:"History", priority:5 }],
      spend:[], transportIn:{ id: uid(), type:"Train", from:"Copenhagen", to:"Stockholm", date:"2025-09-25", departTime:"10:00", arriveDate:"2025-09-25", arriveTime:"15:00", cost:70 },
      transportOut:{ id: uid(), type:"Flight", from:"Stockholm", to:"Oslo", date:"2025-10-03", departTime:"11:00", arriveDate:"2025-10-03", arriveTime:"12:10", cost:80 }
    },
    { id: uid(), country: "Norway", cities:["Oslo","Bergen","Tromsø"], startDate:"2025-10-03", endDate:"2025-10-12", status:"tentative", budget:1200, dailyStudyHours:1.0,
      places:[], spend:[], transportIn:{ id: uid(), type:"Flight", from:"Stockholm", to:"Oslo", date:"2025-10-03", departTime:"11:00", arriveDate:"2025-10-03", arriveTime:"12:10", cost:80 },
      transportOut:{ id: uid(), type:"Flight", from:"Oslo", to:"Reykjavík", date:"2025-10-12", departTime:"13:30", arriveDate:"2025-10-12", arriveTime:"15:30", cost:110 }
    },
  ],
});

// ---- Supabase minimal client helper (reads env or localStorage) ----
function makeSupabase(){
  const url = import.meta?.env?.VITE_SUPABASE_URL || window.__SUPABASE_URL__ || localStorage.getItem('sb_url') || '';
  const anon = import.meta?.env?.VITE_SUPABASE_ANON || window.__SUPABASE_ANON__ || localStorage.getItem('sb_key') || '';
  if (!url || !anon) return { sb:null, cfg:{ url, anon } };
  return { sb: createClient(url, anon), cfg:{ url, anon } };
}

// App (decluttered + ICS modal + Cloud Sync)
export default function TripPlannerApp(){
  const [data, setData] = useState(loadInitialData);
  const [selectedId, setSelectedId] = useState(() => data.segments[0]?.id || null);
  const [showAddSegment, setShowAddSegment] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showICS, setShowICS] = useState(false);
  const [icsPreview, setIcsPreview] = useState("");

  // Cloud sync state
  const [{ sb, cfg:initialCfg }, setSB] = useState(()=> makeSupabase());
  const [cfg, setCfg] = useState(initialCfg);
  const [showCloudCfg, setShowCloudCfg] = useState(false);
  const [session, setSession] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const saveTimer = useRef(null);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(()=>localStorage.setItem("trip-planner-cache-v3", JSON.stringify(data)), [data]);
  useEffect(()=>{ try{ runSelfTests(); }catch(e){ console.error(e); } }, []);

  // Supabase auth/session
  useEffect(()=>{ (async()=>{
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    setSession(s.session || null);
    const { data: sub } = sb.auth.onAuthStateChange((_e, sess)=>{ setSession(sess); });
    return ()=>{ sub?.subscription?.unsubscribe?.(); };
  })(); }, [sb]);

  // On login: fetch or initialize cloud row
  useEffect(()=>{ (async()=>{
    if (!sb || !session) return;
    try{
      const { data: rows, error } = await sb.from('itineraries').select('id,data,updated_at').eq('user_id', session.user.id).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error; // ignore no rows
      if (rows && rows.data){
        setData(rows.data);
        setSelectedId(rows.data.segments?.[0]?.id || null);
      } else {
        await sb.from('itineraries').upsert({ user_id: session.user.id, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      }
    } catch(e){ console.error('Cloud load failed', e); }
  })(); }, [sb, session]);

// Track online/offline for UX and to pause autosave
  useEffect(()=>{
  const on = ()=>setOnline(true);
  const off = ()=>setOnline(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  return ()=>{ window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Autosave to cloud (debounced)
  useEffect(()=>{
  if (!sb || !session || !online) return; // only when logged in & online
  clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(async ()=>{
    try{
      setSyncing(true);
      await sb.from('itineraries').upsert({ user_id: session.user.id, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      setLastSaved(new Date());
    }catch(e){ console.error('Cloud save failed', e); }
    finally{ setSyncing(false); }
  }, 900);
  return ()=>clearTimeout(saveTimer.current);
}, [data, sb, session, online]);


  const selected = useMemo(()=> data.segments.find(s=>s.id===selectedId) || null, [data.segments, selectedId]);
  const actualSpendByCountry = useMemo(()=> data.segments.map(s=> ({ name:s.country, value:(s.spend||[]).reduce((a,e)=> a + (Number(e.amount)||0), 0) })), [data.segments]);
  const totalBudget = useMemo(()=> data.segments.reduce((sum,s)=> sum + (Number(s.budget)||0), 0), [data.segments]);
  const actualSpendTotal = useMemo(()=> data.segments.reduce((sum,s)=> sum + (s.spend||[]).reduce((a,e)=> a + (Number(e.amount)||0), 0), 0), [data.segments]);

  function addSegment(seg){ setData(d=> ({ ...d, segments:[...d.segments, { id: uid(), ...seg, spend:[] }] })); }
  function updateSegment(id, patch){ setData(d=> ({ ...d, segments: d.segments.map(s=> s.id===id? { ...s, ...patch } : s) })); }
  function removeSegment(id){ setData(d=> ({ ...d, segments: d.segments.filter(s=> s.id!==id) })); if (selectedId===id) setSelectedId(null); }
  function moveSegment(id, dir){ setData(d=>{ const i=d.segments.findIndex(s=> s.id===id); if(i<0) return d; const a=[...d.segments]; const j=clamp(i+(dir==="up"?-1:1),0,a.length-1); [a[i],a[j]]=[a[j],a[i]]; return { ...d, segments:a }; }); }

  function exportJSON(){ const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`${data.title.replaceAll(" ", "_")}.json`; a.click(); URL.revokeObjectURL(url); }
  function exportICS(){ const ics = buildICS(data); setIcsPreview(ics); setShowICS(true); try { const blob = new Blob([ics], {type:"text/calendar;charset=utf-8"}); const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${data.title.replaceAll(" ", "_")}.ics`; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 2000); } catch(e){ console.warn('Download may be blocked in this preview', e); } }

  // Cloud actions
  async function signIn(email){ if(!sb) return; await sb.auth.signInWithOtp({ email }); alert('Check your email for the login link. Open it in a normal tab if the Notion embed blocks it.'); }
  async function signOut(){ if(!sb) return; await sb.auth.signOut(); setSession(null); }
  function reconfigure(){ localStorage.setItem('sb_url', cfg.url||''); localStorage.setItem('sb_key', cfg.anon||''); const next = makeSupabase(); setSB(next); setShowCloudCfg(false); }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <MapPinned className="w-6 h-6" />
          <h1 className="text-xl font-bold">{data.title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {/* Cloud */}
            <div className="inline-flex items-center gap-2 border border-zinc-300 rounded-xl px-3 py-2 bg-white">
              <Cloud className="w-4 h-4"/>
              {sb ? (
                session ? (
                  <>
                    <span className="text-sm">{online ? 'Synced' : 'Offline'}</span>
                    {syncing ? <Loader2 className="w-4 h-4 animate-spin"/> : lastSaved && <span className="text-xs text-zinc-500">Saved {timeAgo(lastSaved)}</span>}
                    <button onClick={signOut} className="text-xs px-2 py-1 rounded-md border border-zinc-300 hover:bg-zinc-50 inline-flex items-center gap-1"><LogOut className="w-3 h-3"/> Sign out</button>
                  </>
                ) : (
                  <>
                    <span className="text-sm">Signed out</span>
                    <SignInMini onSubmit={signIn} />
                  </>
                )
              ) : (
                <>
                  <span className="text-sm">Cloud off</span>
                  <button onClick={()=>setShowCloudCfg(true)} className="text-xs px-2 py-1 rounded-md border border-zinc-300 hover:bg-zinc-50 inline-flex items-center gap-1"><Settings2 className="w-3 h-3"/> Configure</button>
                </>
              )}
            </div>

            <button onClick={()=>setShowHelp(true)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 border border-zinc-300 hover:bg-zinc-50" title="How to use"><CircleHelp className="w-4 h-4"/> Help</button>
            <button onClick={exportICS} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 border border-zinc-300 hover:bg-zinc-50" title="Export calendar"><CalendarDays className="w-4 h-4"/> Export Calendar (.ics)</button>
            <button onClick={exportJSON} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 border border-zinc-300 hover:bg-zinc-50"><Download className="w-4 h-4"/> Export JSON</button>
            <label className="inline-flex items-center gap-1 rounded-xl px-3 py-2 border border-zinc-300 hover:bg-zinc-50 cursor-pointer"><Upload className="w-4 h-4"/> Import JSON
              <input type="file" className="hidden" accept="application/json" onChange={(e)=>{ const f=e.target.files?.[0]; if(!f) return; f.text().then(t=>{ try{ const p=JSON.parse(t); setData(p); setSelectedId(p.segments[0]?.id||null);}catch(err){ alert("Import failed: "+err.message);} }); }} />
            </label>
          </div>
        </div>
      </header>

      {/* Packing + Budget + Spend */}
      <section className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2"><ListTodo className="w-5 h-5" /><h3 className="font-semibold">Packing / Checklist</h3></div>
          <Checklist items={data.checklist} onChange={(items)=>setData(d=>({...d, checklist:items}))} />
        </div>
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4">
            <div className="flex items-center gap-2 mb-2"><DollarSign className="w-5 h-5" /><h3 className="font-semibold">Budget Overview</h3></div>
            <div className="text-sm space-y-1">
              <div className="flex items-center justify-between"><span>Planned</span><span className="font-medium">${totalBudget.toLocaleString()}</span></div>
              <div className="flex items-center justify-between"><span>Actual</span><span className="font-medium">${actualSpendTotal.toLocaleString()}</span></div>
              <div className="flex items-center justify-between"><span>Remaining</span><span className="font-medium">${Math.max(0, totalBudget-actualSpendTotal).toLocaleString()}</span></div>
              <div className="mt-2 h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200"><div className={`h-2 ${actualSpendTotal<=totalBudget?"bg-emerald-500":"bg-red-500"}`} style={{width:`${totalBudget?Math.min(100,(actualSpendTotal/totalBudget)*100):0}%`}}/></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-4">
            <div className="flex items-center gap-2 mb-2"><DollarSign className="w-5 h-5" /><h3 className="font-semibold">Spending Overview (Actual)</h3></div>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {actualSpendByCountry.map(r=> (<div key={r.name} className="flex items-center justify-between text-sm"><span>{r.name}</span><span className="font-medium">${r.value.toFixed(0)}</span></div>))}
            </div>
          </div>
        </div>
      </section>

      {/* Main grid */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: segments list */}
        <section className="lg:col-span-1">
          <div className="space-y-3">
            {data.segments.map((s)=> (
              <motion.div key={s.id} layout className={`rounded-2xl border ${selectedId===s.id?"border-zinc-900":"border-zinc-200"} bg-white shadow-sm`}>
         <div
  role="button"
  tabIndex={0}
  onClick={() => setSelectedId(s.id)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedId(s.id);
    }
  }}
  className="w-full text-left p-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-400 rounded-xl"
>
  <div className="flex items-start gap-3">
    <div className="flex-1">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">{s.country}</span>
        <StatusBadge status={s.status} />
      </div>
      <div className="text-sm text-zinc-600">{s.cities?.join(' • ')}</div>
      <div className="text-sm text-zinc-600 mt-1 flex items-center gap-2">
        <CalendarDays className="w-4 h-4" /> {s.startDate} → {s.endDate} ({diffDays(s.startDate, s.endDate)} d)
      </div>
      <div className="text-sm text-zinc-600 mt-1 flex items-center gap-2">
        <DollarSign className="w-4 h-4" /> Actual spend: $
        {(s.spend || []).reduce((a, e) => a + (Number(e.amount) || 0), 0).toFixed(0)}
      </div>
    </div>
    <div className="flex flex-col gap-2">
      <IconButton
        title="Move up"
        onClick={(e) => { e.stopPropagation(); moveSegment(s.id, 'up'); }}
        Icon={ArrowUp}
      />
      <IconButton
        title="Move down"
        onClick={(e) => { e.stopPropagation(); moveSegment(s.id, 'down'); }}
        Icon={ArrowDown}
      />
    </div>
  </div>
</div>

<div className="px-4 pb-3 flex items-center gap-2">
  <button
    onClick={() => updateSegment(s.id, { status: s.status === 'confirmed' ? 'tentative' : 'confirmed' })}
    className="text-xs px-2 py-1 rounded-md border border-zinc-300 hover:bg-zinc-50"
  >
    Toggle Status
  </button>
  <button
    onClick={() => removeSegment(s.id)}
    className="text-xs px-2 py-1 rounded-md border border-red-300 text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
  >
    <Trash2 className="w-3 h-3" /> Remove
  </button>
</div>

              </motion.div>
            ))}
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-4">
              <button onClick={()=>setShowAddSegment(true)} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50"><Plus className="w-4 h-4"/> Add Segment</button>
            </div>
          </div>
        </section>

        {/* Right: details */}
        <section className="lg:col-span-2">
          {selected ? (
            <SegmentEditor key={selected.id} segment={selected} onChange={(p)=>updateSegment(selected.id, p)} />
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-10 text-center text-zinc-500">Select a segment to edit.</div>
          )}
        </section>
      </main>

      {/* Add Segment Modal */}
      <AnimatePresence>
        {showAddSegment && (
          <Modal onClose={()=>setShowAddSegment(false)} title="Add Trip Segment">
            <AddSegmentForm onAdd={(seg)=>{ addSegment(seg); setShowAddSegment(false);} } defaultStudy={data.dailyStudyHoursDefault} />
          </Modal>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <Modal onClose={()=>setShowHelp(false)} title="How to use this planner">
            <div className="prose prose-zinc">
              <ul>
                <li>Click <strong>Add Segment</strong> under the country list.</li>
                <li>Edit a segment → <strong>Stays</strong> and <strong>Transport</strong> accept times (exported to .ics).</li>
                <li>Use <strong>Export Calendar</strong> to download, or copy from the preview modal if downloads are blocked.</li>
                <li>Cloud sync: tap <strong>Configure</strong> to add Supabase keys → <strong>Sign in</strong> via email magic link.</li>
              </ul>
              <p className="text-sm text-zinc-500">Data is stored locally and, if signed in, synced to your Supabase project.</p>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ICS Preview Modal */}
      <AnimatePresence>
        {showICS && (
          <Modal onClose={()=>setShowICS(false)} title="Calendar Export (.ics)">
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">If the download didn’t start, copy this text into a file named <code>trip.ics</code> and import it.</p>
              <textarea className="w-full h-64 rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs" readOnly value={icsPreview} />
              <div className="flex gap-2 justify-end">
                <button onClick={()=>{ navigator.clipboard.writeText(icsPreview); }} className="px-4 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50">Copy</button>
                <button onClick={()=>setShowICS(false)} className="px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">Close</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Cloud Configure Modal */}
      <AnimatePresence>
        {showCloudCfg && (
          <Modal onClose={()=>setShowCloudCfg(false)} title="Configure Cloud (Supabase)">
            <div className="space-y-3">
              <div className="text-sm text-zinc-600">Paste your Supabase <strong>Project URL</strong> and <strong>Anon key</strong>. They are safe to expose in the client.</div>
              <div className="grid grid-cols-1 gap-3">
                <Labeled label="Project URL"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" placeholder="https://YOUR-PROJECT.supabase.co" value={cfg.url||''} onChange={(e)=>setCfg({...cfg, url:e.target.value})}/></Labeled>
                <Labeled label="Anon key"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" placeholder="ey..." value={cfg.anon||''} onChange={(e)=>setCfg({...cfg, anon:e.target.value})}/></Labeled>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={()=>setShowCloudCfg(false)} className="px-4 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50">Cancel</button>
                <button onClick={reconfigure} className="px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">Save</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// Reusable parts & helpers
function StatusBadge({ status }){ const cls = status==="confirmed"?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-900"; return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{status}</span>; }
function IconButton({ onClick, Icon, title }){ return (<button onClick={onClick} title={title} className="p-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50"><Icon className="w-4 h-4"/></button>); }
function Modal({ onClose, title, children }){
  return (
    <AnimatePresence>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} exit={{y:20,opacity:0}} onClick={(e)=>e.stopPropagation()} className="w-full max-w-2xl bg-white rounded-2xl border border-zinc-200 shadow-xl">
          <div className="px-5 py-4 border-b border-zinc-200 flex items-center"><h3 className="font-semibold">{title}</h3><button onClick={onClose} className="ml-auto text-sm text-zinc-500 hover:text-zinc-900">Close</button></div>
          <div className="p-5">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
function Labeled({ label, children }){ return (<label className="block"><div className="text-xs text-zinc-600 mb-1">{label}</div>{children}</label>); }
function SignInMini({ onSubmit }){
  const [email,setEmail] = useState("");
  return (
    <form onSubmit={(e)=>{e.preventDefault(); onSubmit(email);}} className="flex items-center gap-2">
      <input type="email" required placeholder="you@email" className="rounded-lg border border-zinc-300 px-2 py-1 text-sm" value={email} onChange={(e)=>setEmail(e.target.value)} />
      <button className="text-xs px-2 py-1 rounded-md border border-zinc-300 hover:bg-zinc-50 inline-flex items-center gap-1"><LogIn className="w-3 h-3"/> Sign in</button>
    </form>
  );
}
function timeAgo(d){ if(!d) return ""; const s=Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60) return `${s}s ago`; const m=Math.floor(s/60); if(m<60) return `${m}m ago`; const h=Math.floor(m/60); if(h<24) return `${h}h ago`; const dd=Math.floor(h/24); return `${dd}d ago`; }

// Add Segment Form
function AddSegmentForm({ onAdd, defaultStudy }){
  const [country, setCountry] = useState("");
  const [cities, setCities] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState(400);
  const [status, setStatus] = useState("confirmed");
  const [dailyStudyHours, setDailyStudyHours] = useState(defaultStudy || 1);
  return (
    <form onSubmit={(e)=>{ e.preventDefault(); onAdd({ country, cities: cities.split(",").map(s=>s.trim()).filter(Boolean), startDate, endDate, budget:Number(budget)||0, status, dailyStudyHours, notes:"", stays:[], places:[], transportIn:null, transportOut:null, spend:[] }); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Labeled label="Country"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={country} onChange={(e)=>setCountry(e.target.value)} required /></Labeled>
      <Labeled label="Cities (comma‑separated)"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={cities} onChange={(e)=>setCities(e.target.value)} /></Labeled>
      <Labeled label="Start date"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={startDate} onChange={(e)=>setStartDate(e.target.value)} required /></Labeled>
      <Labeled label="End date"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={endDate} onChange={(e)=>setEndDate(e.target.value)} required /></Labeled>
      <Labeled label="Budget (USD)"><input type="number" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={budget} onChange={(e)=>setBudget(e.target.value)} /></Labeled>
      <Labeled label="Daily study hours"><input type="number" step="0.1" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={dailyStudyHours} onChange={(e)=>setDailyStudyHours(e.target.value)} /></Labeled>
      <Labeled label="Status"><select className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="confirmed">confirmed</option><option value="tentative">tentative</option></select></Labeled>
      <div className="md:col-span-2"><button className="px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">Add</button></div>
    </form>
  );
}

// Segment Editor
function SegmentEditor({ segment, onChange }){
  const [tab, setTab] = useState("overview");
  function update(field, value){ onChange({ [field]: value }); }
  const totalKnown = React.useMemo(()=>{
    const stayCosts = (segment.stays||[]).reduce((acc,st)=> acc + Math.max(0,diffDays(st.checkIn,st.checkOut))*(Number(st.costPerNight)||0), 0);
    const transportCosts = [segment.transportIn,segment.transportOut].filter(Boolean).reduce((acc,t)=> acc + (Number(t.cost)||0), 0);
    const placeCosts = (segment.places||[]).reduce((acc,p)=> acc + (Number(p.cost)||0), 0);
    return stayCosts + transportCosts + placeCosts;
  }, [segment]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4 flex items-center gap-2"><h2 className="font-semibold text-lg">{segment.country}</h2><span className="text-sm text-zinc-500">{segment.cities?.join(" • ")}</span><span className="ml-auto text-sm text-zinc-600 flex items-center gap-2"><CalendarDays className="w-4 h-4"/> {segment.startDate} → {segment.endDate}</span></div>

      <div className="px-5 pt-4">
        <div className="flex gap-2 flex-wrap">
          {[{k:"overview",label:"Overview"},{k:"places",label:"Places"},{k:"stays",label:"Stays"},{k:"transport",label:"Transport"},{k:"spend",label:"Spend"},{k:"notes",label:"Notes"}].map(t=> (
            <button key={t.k} onClick={()=>setTab(t.k)} className={`px-3 py-1.5 rounded-lg border ${tab===t.k?"bg-zinc-900 text-white border-zinc-900":"border-zinc-300 hover:bg-zinc-50"}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab==="overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Labeled label="Cities (comma‑separated)"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.cities?.join(", ")||""} onChange={(e)=>update("cities", e.target.value.split(",").map(s=>s.trim()).filter(Boolean))} /></Labeled>
            <Labeled label="Start date"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.startDate||""} onChange={(e)=>update("startDate", e.target.value)} /></Labeled>
            <Labeled label="End date"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.endDate||""} onChange={(e)=>update("endDate", e.target.value)} /></Labeled>
            <Labeled label="Daily study hours"><input type="number" step="0.1" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.dailyStudyHours ?? 1} onChange={(e)=>update("dailyStudyHours", Number(e.target.value))} /></Labeled>
            <Labeled label="Budget (USD)"><input type="number" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.budget ?? 0} onChange={(e)=>update("budget", Number(e.target.value))} /></Labeled>
            <div className="flex items-end"><div className="w-full bg-zinc-100 rounded-xl p-3"><div className="text-xs text-zinc-600 mb-1">Known costs vs budget</div><div className="text-sm">${totalKnown.toFixed(0)} / ${Number(segment.budget||0).toFixed(0)}</div><div className="mt-2 h-2 bg-white rounded-full overflow-hidden border border-zinc-200"><div className={`h-2 ${totalKnown <= (segment.budget||0)?"bg-emerald-500":"bg-red-500"}`} style={{ width: `${Math.min(100, (totalKnown/((segment.budget||1)))*100)}%` }} /></div></div></div>
          </div>
        )}
        {tab==="places" && (<PlacesEditor places={segment.places||[]} onChange={(list)=>update("places", list)} />)}
        {tab==="stays" && (<StaysEditor stays={segment.stays||[]} onChange={(list)=>update("stays", list)} />)}
        {tab==="transport" && (<TransportEditor segment={segment} onChange={onChange} />)}
        {tab==="spend" && (<SpendEditor spend={segment.spend||[]} onChange={(list)=>update("spend", list)} />)}
        {tab==="notes" && (<Labeled label="Notes"><textarea className="w-full rounded-xl border border-zinc-300 px-3 py-2 h-40" value={segment.notes||""} onChange={(e)=>update("notes", e.target.value)} placeholder="Trip ideas, backup routes, etc."/></Labeled>)}
      </div>
    </div>
  );
}

// Places
function PlacesEditor({ places, onChange }){
  const [draft, setDraft] = useState({ name:"", city:"", category:"History", priority:3, cost:"", notes:"" });
  function add(){ if(!draft.name) return; onChange([...(places||[]), { id: uid(), ...draft, priority:Number(draft.priority)||3, cost:Number(draft.cost)||0 }]); setDraft({ name:"", city:"", category:"History", priority:3, cost:"", notes:"" }); }
  function remove(id){ onChange(places.filter(p=>p.id!==id)); }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-6 gap-3">
        <Labeled label="Name"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={draft.name} onChange={(e)=>setDraft({...draft, name:e.target.value})} /></Labeled>
        <Labeled label="City"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={draft.city} onChange={(e)=>setDraft({...draft, city:e.target.value})} /></Labeled>
        <Labeled label="Category"><select className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={draft.category} onChange={(e)=>setDraft({...draft, category:e.target.value})}>{Object.keys(CATEGORY_COLORS).map(c=> <option key={c} value={c}>{c}</option>)}</select></Labeled>
        <Labeled label="Priority (1‑5)"><input type="number" min={1} max={5} className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={draft.priority} onChange={(e)=>setDraft({...draft, priority:e.target.value})}/></Labeled>
        <Labeled label="Est. Cost (USD)"><input type="number" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={draft.cost} onChange={(e)=>setDraft({...draft, cost:e.target.value})}/></Labeled>
        <Labeled label="Notes"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={draft.notes} onChange={(e)=>setDraft({...draft, notes:e.target.value})} /></Labeled>
      </div>
      <div className="md:col-span-3"><button onClick={add} className="px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">Add Place</button></div>
      <div className="md:col-span-3 divide-y divide-zinc-200">
        {places.length===0 && (<div className="text-sm text-zinc-500">No places yet. Add some targets.</div>)}
        {places.map(p=> (
          <div key={p.id} className="py-3 flex items-start gap-3">
            <span className={`px-2 py-0.5 rounded-full text-xs ${CATEGORY_COLORS[p.category]||"bg-zinc-100"}`}>{p.category}</span>
            <div className="flex-1">
              <div className="font-medium">{p.name} <span className="text-zinc-500">({p.city})</span></div>
              <div className="text-xs text-zinc-500">Priority {p.priority}{p.cost?` • $${p.cost}`:""}</div>
              {p.notes && <div className="text-sm">{p.notes}</div>}
            </div>
            <button onClick={()=>remove(p.id)} className="p-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50" title="Remove"><Trash2 className="w-4 h-4"/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stays
function StaysEditor({ stays, onChange }){
  const [d, setD] = useState({ name:"", type:"Hostel", address:"", checkIn:"", checkOut:"", checkInTime:"", checkOutTime:"", costPerNight:"", notes:"" });
  function add(){ if(!d.name) return; onChange([...(stays||[]), { id: uid(), ...d, costPerNight:Number(d.costPerNight)||0 }]); setD({ name:"", type:"Hostel", address:"", checkIn:"", checkOut:"", checkInTime:"", checkOutTime:"", costPerNight:"", notes:"" }); }
  function remove(id){ onChange(stays.filter(p=>p.id!==id)); }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Labeled label="Name"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.name} onChange={(e)=>setD({...d, name:e.target.value})} /></Labeled>
      <Labeled label="Type"><select className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.type} onChange={(e)=>setD({...d, type:e.target.value})}><option>Hostel</option><option>Hotel</option><option>Airbnb</option><option>Friend/Family</option></select></Labeled>
      <Labeled label="Cost per night (USD)"><input type="number" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.costPerNight} onChange={(e)=>setD({...d, costPerNight:e.target.value})}/></Labeled>
      <Labeled label="Address"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.address} onChange={(e)=>setD({...d, address:e.target.value})} /></Labeled>
      <Labeled label="Check‑in date"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.checkIn} onChange={(e)=>setD({...d, checkIn:e.target.value})}/></Labeled>
      <Labeled label="Check‑in time (optional)"><input type="time" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.checkInTime} onChange={(e)=>setD({...d, checkInTime:e.target.value})}/></Labeled>
      <Labeled label="Check‑out date"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.checkOut} onChange={(e)=>setD({...d, checkOut:e.target.value})}/></Labeled>
      <Labeled label="Check‑out time (optional)"><input type="time" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.checkOutTime} onChange={(e)=>setD({...d, checkOutTime:e.target.value})}/></Labeled>
      <Labeled label="Notes"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.notes} onChange={(e)=>setD({...d, notes:e.target.value})} /></Labeled>
      <div className="md:col-span-3"><button onClick={add} className="px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">Add Stay</button></div>
      <div className="md:col-span-3 divide-y divide-zinc-200">
        {stays.length===0 && (<div className="text-sm text-zinc-500">No stays yet.</div>)}
        {stays.map(st=>{ const nights=Math.max(0,diffDays(st.checkIn,st.checkOut)); const subtotal=nights*(Number(st.costPerNight)||0); return (
          <div key={st.id} className="py-3 flex items-start gap-3">
            <Bed className="w-5 h-5 mt-0.5"/>
            <div className="flex-1">
              <div className="font-medium">{st.name} <span className="text-zinc-500">({st.type})</span></div>
              <div className="text-xs text-zinc-500">{st.checkIn}{st.checkInTime?` ${st.checkInTime}`:""} → {st.checkOut}{st.checkOutTime?` ${st.checkOutTime}`:""} • {nights} nights • ${subtotal.toFixed(0)}</div>
              {st.address && <div className="text-sm">{st.address}</div>}
              {st.notes && <div className="text-sm">{st.notes}</div>}
            </div>
            <button onClick={()=>remove(st.id)} className="p-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50" title="Remove"><Trash2 className="w-4 h-4"/></button>
          </div>
        );})}
      </div>
    </div>
  );
}

// Transport
function TransportEditor({ segment, onChange }){
  function update(field, patch){ onChange({ [field]: { ...(segment[field]||{}), ...patch } }); }
  const inType = segment.transportIn?.type || "Train"; const outType = segment.transportOut?.type || "Train";
  const InIcon = TRANSPORT_ICONS[inType] || TrainFront; const OutIcon = TRANSPORT_ICONS[outType] || TrainFront;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
        <div className="flex items-center gap-2 mb-3"><InIcon className="w-5 h-5"/><h4 className="font-semibold">Inbound</h4></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Labeled label="Type"><select className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={inType} onChange={(e)=>update("transportIn", { type:e.target.value })}><option>Train</option><option>Bus</option><option>Flight</option><option>Ferry</option></select></Labeled>
          <Labeled label="Date"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportIn?.date||""} onChange={(e)=>update("transportIn", { date:e.target.value })}/></Labeled>
          <Labeled label="Depart time"><input type="time" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportIn?.departTime||""} onChange={(e)=>update("transportIn", { departTime:e.target.value })}/></Labeled>
          <Labeled label="Arrive date (optional)"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportIn?.arriveDate||""} onChange={(e)=>update("transportIn", { arriveDate:e.target.value })}/></Labeled>
          <Labeled label="Arrive time (optional)"><input type="time" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportIn?.arriveTime||""} onChange={(e)=>update("transportIn", { arriveTime:e.target.value })}/></Labeled>
          <Labeled label="From"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportIn?.from||""} onChange={(e)=>update("transportIn", { from:e.target.value })}/></Labeled>
          <Labeled label="To"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportIn?.to||""} onChange={(e)=>update("transportIn", { to:e.target.value })}/></Labeled>
          <Labeled label="Cost (USD)"><input type="number" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportIn?.cost||""} onChange={(e)=>update("transportIn", { cost:Number(e.target.value)||0 })}/></Labeled>
          <Labeled label="Ref / Notes"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportIn?.ref||""} onChange={(e)=>update("transportIn", { ref:e.target.value })}/></Labeled>
        </div>
      </div>
      <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
        <div className="flex items-center gap-2 mb-3"><OutIcon className="w-5 h-5"/><h4 className="font-semibold">Outbound</h4></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Labeled label="Type"><select className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={outType} onChange={(e)=>update("transportOut", { type:e.target.value })}><option>Train</option><option>Bus</option><option>Flight</option><option>Ferry</option></select></Labeled>
          <Labeled label="Date"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportOut?.date||""} onChange={(e)=>update("transportOut", { date:e.target.value })}/></Labeled>
          <Labeled label="Depart time"><input type="time" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportOut?.departTime||""} onChange={(e)=>update("transportOut", { departTime:e.target.value })}/></Labeled>
          <Labeled label="Arrive date (optional)"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportOut?.arriveDate||""} onChange={(e)=>update("transportOut", { arriveDate:e.target.value })}/></Labeled>
          <Labeled label="Arrive time (optional)"><input type="time" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportOut?.arriveTime||""} onChange={(e)=>update("transportOut", { arriveTime:e.target.value })}/></Labeled>
          <Labeled label="From"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportOut?.from||""} onChange={(e)=>update("transportOut", { from:e.target.value })}/></Labeled>
          <Labeled label="To"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportOut?.to||""} onChange={(e)=>update("transportOut", { to:e.target.value })}/></Labeled>
          <Labeled label="Cost (USD)"><input type="number" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportOut?.cost||""} onChange={(e)=>update("transportOut", { cost:Number(e.target.value)||0 })}/></Labeled>
          <Labeled label="Ref / Notes"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={segment.transportOut?.ref||""} onChange={(e)=>update("transportOut", { ref:e.target.value })}/></Labeled>
        </div>
      </div>
    </div>
  );
}

// Spend
function SpendEditor({ spend, onChange }){
  const [d, setD] = useState({ date:"", category:"Misc", note:"", amount:"" });
  function add(){ if(!d.amount || Number(d.amount)===0) return; onChange([...(spend||[]), { id: uid(), date:d.date||toISO(new Date()), category:d.category, note:d.note, amount:Number(d.amount)||0 }]); setD({ date:"", category:"Misc", note:"", amount:"" }); }
  function remove(id){ onChange((spend||[]).filter(e=>e.id!==id)); }
  const total = (spend||[]).reduce((a,e)=> a + (Number(e.amount)||0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <Labeled label="Date"><input type="date" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.date} onChange={(e)=>setD({...d, date:e.target.value})}/></Labeled>
        <Labeled label="Category"><select className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.category} onChange={(e)=>setD({...d, category:e.target.value})}>{['Transport','Lodging','Food','Entertainment','Study','Misc'].map(c=> <option key={c}>{c}</option>)}</select></Labeled>
        <Labeled label="Amount (USD)"><input type="number" step="0.01" className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.amount} onChange={(e)=>setD({...d, amount:e.target.value})}/></Labeled>
        <Labeled label="Note"><input className="w-full rounded-xl border border-zinc-300 px-3 py-2" value={d.note} onChange={(e)=>setD({...d, note:e.target.value})}/></Labeled>
        <div className="md:col-span-2 flex items-end"><button onClick={add} className="px-4 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">Add Entry</button></div>
      </div>
      <div className="text-sm text-zinc-600">Total recorded here: <span className="font-semibold text-zinc-900">${total.toFixed(2)}</span></div>
      <div className="divide-y divide-zinc-200">
        {(spend||[]).length===0 && (<div className="text-sm text-zinc-500">No spend entries yet.</div>)}
        {(spend||[]).map(e=> (
          <div key={e.id} className="py-2 flex items-start gap-3">
            <span className={`px-2 py-0.5 rounded-full text-xs ${CATEGORY_COLORS[e.category]||"bg-zinc-100"}`}>{e.category}</span>
            <div className="flex-1">
              <div className="text-sm"><span className="font-medium">${Number(e.amount).toFixed(2)}</span> — {e.note || 'No note'}</div>
              <div className="text-xs text-zinc-500">{e.date || 'undated'}</div>
            </div>
            <button onClick={()=>remove(e.id)} className="p-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50" title="Remove"><Trash2 className="w-4 h-4"/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Checklist (global)
function Checklist({ items, onChange }){
  const [text, setText] = useState("");
  function toggle(id){ onChange(items.map(i=> i.id===id? { ...i, done:!i.done } : i)); }
  function add(){ const v = text.trim(); if(!v) return; onChange([...(items||[]), { id: uid(), text:v, done:false }]); setText(""); }
  function clearDone(){ onChange((items||[]).filter(i=>!i.done)); }
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input className="flex-1 rounded-xl border border-zinc-300 px-3 py-2" placeholder="Add item…" value={text} onChange={(e)=>setText(e.target.value)} />
        <button onClick={add} className="px-3 py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">Add</button>
        <button onClick={clearDone} className="px-3 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50">Clear completed</button>
      </div>
      <div className="space-y-2 max-h-56 overflow-auto pr-1">
        {(items||[]).length===0 && (<div className="text-sm text-zinc-500">No items yet.</div>)}
        {(items||[]).map(item=> (
          <label key={item.id} className="flex items-center gap-3">
            <input type="checkbox" className="w-4 h-4" checked={!!item.done} onChange={()=>toggle(item.id)} />
            <span className={`text-sm ${item.done? 'line-through text-zinc-400':'text-zinc-800'}`}>{item.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Self-tests
function runSelfTests(){
  const esc = icsEscape("a\\b;c,d\n");
  console.assert(esc === "a\\\\b\\;c\\,d\\n", "icsEscape should escape special chars");
  const ics1 = buildICS({ segments:[{ country:"X", stays:[{ name:"Stay", checkIn:"2025-01-01", checkOut:"2025-01-03" }], transportIn:{ type:"Train", from:"A", to:"B", date:"2025-01-01" } }] });
  console.assert(ics1.includes("DTSTART;VALUE=DATE:20250101"), "All‑day DTSTART present");
  console.assert(ics1.includes("DTEND;VALUE=DATE:20250102"), "All‑day leg DTEND should be next day");
  const ics2 = buildICS({ segments:[{ country:"Y", stays:[], transportIn:{ type:"Flight", from:"A", to:"B", date:"2025-02-01", departTime:"07:30", arriveDate:"2025-02-01", arriveTime:"09:00" } }] });
  console.assert(ics2.includes("DTSTART:20250201T073000"), "Timed DTSTART present");
  const ics3 = buildICS({ segments:[{ country:"Z", stays:[], transportIn:{ type:"Bus", from:"A", to:"B", date:"2025-03-01", departTime:"12:00" } }] });
  console.assert(ics3.includes("DTSTART:20250301T120000") && !ics3.includes("DTEND:"), "Zero-duration leg omits DTEND when no arrival");
  const ics4 = buildICS({ segments:[{ country:"S", stays:[{ name:"Hotel", checkIn:"2025-04-10", checkOut:"2025-04-12", checkInTime:"16:00", checkOutTime:"11:00" }] }] });
  console.assert(ics4.includes("DTSTART:20250410T160000") && ics4.includes("DTEND:20250412T110000"), "Timed stay should include DTSTART and DTEND");
  const ics5 = buildICS({ segments:[{ country:"U", stays:[{ name:"Stay", checkIn:"2025-05-01", checkOut:"2025-05-02", address:"Main St, A" }], transportIn:{ type:"Train", from:"X", to:"Y", date:"2025-05-02" } }] });
  console.assert(!ics5.includes("undefined"), "ICS should not contain 'undefined'");
  console.assert(ics5.includes("LOCATION:"), "Stay with address should include LOCATION");
}

// Initial data loader (normalized & safe)
function loadInitialData() {
  try {
    const cached = localStorage.getItem("trip-planner-cache-v3");
    const parsed = cached ? JSON.parse(cached) : seedItinerary();
    return {
      ...parsed,
      checklist: parsed.checklist || [],
      segments: (parsed.segments || []).map(s => ({ ...s, spend: s.spend || [] })),
    };
  } catch (e) {
    console.error("Failed to load cached trip; using seed", e);
    return seedItinerary();
  }
}
