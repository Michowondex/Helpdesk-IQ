// Product visuals for the BizaDesk landing page. Pure JSX/CSS, no image files.
// TODO (optional): swap any of these for real app screenshots, e.g. <img src="/shots/tickets.png" alt="..." />
// wrapped in <div className="vis">...</div>. Real screenshots usually convert best.

const Frame = ({ title, children }) => (
  <div className="vis" aria-hidden="true">
    <div className="bar"><b /><b /><b /><em>{title}</em></div>
    <div className="vb">{children}</div>
  </div>
)

export function ChatVisual() {
  return (
    <Frame title="Virtual IT Assistant">
      <div className="bub u">My VPN keeps disconnecting 😩</div>
      <div className="bub a">
        🤖 Let’s fix it together.
        <ol>
          <li>Disconnect and reconnect the VPN</li>
          <li>Run <code>ipconfig /flushdns</code></li>
          <li>Restart your network adapter</li>
        </ol>
      </div>
      <div className="bub u">Still not working</div>
      <div className="bub a">No problem. How would you like to continue?</div>
      <div className="chips"><span>💬 WhatsApp</span><span>📞 Call</span><span>🎫 Raise a Ticket</span></div>
      <div className="inp"><span>Type or speak your problem…</span><i>🎤</i></div>
    </Frame>
  )
}

export function TicketVisual() {
  const cols = [
    ['OPEN', 'o', ['Cannot access shared drive', 'New laptop setup']],
    ['IN PROGRESS', 'w', ['Printer offline — Finance']],
    ['RESOLVED', 'r', ['Outlook password prompt', 'Wi-Fi drops on 3rd floor']],
  ]
  return (
    <Frame title="Tickets">
      <div className="chips" style={{ marginBottom: 12 }}><span>Status ▾</span><span>Technician ▾</span><span>Date ▾</span></div>
      <div className="kan">
        {cols.map(([n, c, items]) => (
          <div className="kc" key={n}>
            <h5><span className={`tg ${c}`}>{n}</span></h5>
            {items.map((t) => <div className="kt" key={t}>{t}<small>🔔 Creator notified</small></div>)}
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function EscalationVisual() {
  const steps = [
    ['🔴', 'Incident detected', 'VPN gateway offline · Critical', 'done'],
    ['📣', 'Alert banner live', 'Shown to every staff member', 'done'],
    ['⏱️', 'SLA at risk', '80% of resolution time used', 'now'],
    ['✉️', 'Auto-escalation sent', 'All-staff and IT managers emailed', 'next'],
  ]
  return (
    <Frame title="Incident Command Centre">
      <div className="alert">⚠️ <span><b>P1 · Critical:</b> VPN gateway offline — 42 staff affected</span></div>
      <div className="sla"><div style={{ width: '80%' }} /></div>
      <div className="slal"><span>SLA timer</span><span>12 min left</span></div>
      <div className="tl">
        {steps.map(([i, t, d, s]) => (
          <div className={`ts ${s}`} key={t}><em>{i}</em><div><b>{t}</b><small>{d}</small></div></div>
        ))}
      </div>
    </Frame>
  )
}

const spark = {
  g: 'M0 20 L15 16 L30 18 L45 12 L60 14 L75 8 L90 10 L110 6',
  y: 'M0 8 L15 10 L30 9 L45 16 L60 14 L75 22 L90 20 L110 24',
  r: 'M0 8 L20 8 L40 9 L60 10 L75 22 L90 28 L110 28',
}
export function MonitorVisual() {
  const tiles = [
    ['Email server', 'Online', 'g', '#10b981'],
    ['VPN gateway', 'Degraded', 'y', '#f59e0b'],
    ['Internet link', 'Online', 'g', '#10b981'],
    ['HR portal', 'Offline', 'r', '#ef4444'],
  ]
  return (
    <Frame title="Service Monitoring">
      <div className="mon">
        {tiles.map(([n, s, k, c]) => (
          <div className="mt" key={n}>
            <div className="mh"><span>{n}</span><u style={{ background: c }} /></div>
            <svg viewBox="0 0 110 32" preserveAspectRatio="none"><path d={spark[k]} fill="none" stroke={c} strokeWidth="2" /></svg>
            <small style={{ color: c }}>{s}{s === 'Offline' ? ' · incident auto-created' : ''}</small>
          </div>
        ))}
      </div>
    </Frame>
  )
}
