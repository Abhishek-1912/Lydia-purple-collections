const DAYS = [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['7', 'Sun']]

/** Settings section for video-call booking. Saved with "Save settings". */
export default function CallSettings({ f, setF }) {
  const days = String(f.call_days || '').split(',').filter(Boolean)
  const toggleDay = (d) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()
    setF({ ...f, call_days: next.join(',') })
  }
  return (
    <fieldset className="card">
      <legend>Video-call booking</legend>
      <label className="check"><input type="checkbox" checked={!!Number(f.call_enabled)} onChange={(e) => setF({ ...f, call_enabled: e.target.checked ? 1 : 0 })} /> Let shoppers book video calls on the website</label>
      <p className="small muted">When on, product pages show “Book a video call”. Requests appear in Admin → Video calls.</p>
      <p className="small" style={{ fontWeight: 700, margin: '12px 0 6px' }}>Days</p>
      <div className="easy-chips">{DAYS.map(([v, l]) => <button key={v} type="button" className={`easy-chip sm ${days.includes(v) ? 'on' : ''}`} onClick={() => toggleDay(v)} aria-pressed={days.includes(v)}>{l}</button>)}</div>
      <div className="settings-grid" style={{ marginTop: 12 }}>
        <div className="field"><label htmlFor="cs-start">From</label><input id="cs-start" type="time" value={f.call_start || '11:00'} onChange={(e) => setF({ ...f, call_start: e.target.value })} /></div>
        <div className="field"><label htmlFor="cs-end">Until</label><input id="cs-end" type="time" value={f.call_end || '19:00'} onChange={(e) => setF({ ...f, call_end: e.target.value })} /></div>
        <div className="field"><label htmlFor="cs-slot">Minutes per call</label>
          <select id="cs-slot" value={f.call_slot || 30} onChange={(e) => setF({ ...f, call_slot: Number(e.target.value) })}>{[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select></div>
        <div className="field"><label htmlFor="cs-ahead">Bookable days ahead</label>
          <select id="cs-ahead" value={f.call_days_ahead || 7} onChange={(e) => setF({ ...f, call_days_ahead: Number(e.target.value) })}>{[3, 7, 14, 30].map((m) => <option key={m} value={m}>{m} days</option>)}</select></div>
      </div>
    </fieldset>
  )
}
