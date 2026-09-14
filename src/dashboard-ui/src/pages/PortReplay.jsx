import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, AlertTriangle, Play, Pause, MapPin, Check, ChevronDown, Ship, Anchor, SkipBack, X, ChevronUp, Layers, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchScene, fetchHotspots } from '../api/client';

const SCENE_TIME = "2019-01-03T12:00:00Z";

const STATUS_META = {
  SERVICING: { color: '#3fb950', label: 'Servicing' },
  HIGH_RISK: { color: '#f85149', label: 'High Risk' },
  DEFAULT:   { color: '#58a6ff', label: 'En Route' },
};

const vesselColor = (status, risk) => {
  if (risk === 'HIGH')       return STATUS_META.HIGH_RISK.color;
  if (status === 'SERVICING') return STATUS_META.SERVICING.color;
  return STATUS_META.DEFAULT.color;
};

const routeColor = (status) => {
  if (status === 'SERVICING') return '#047857'; // dark green
  return '#1d4ed8'; // dark blue
};

const mapIcon = (color, heading = 0, isSelected = false) => new L.divIcon({
  className: 'ship-map-icon',
  html: `<span style="background:${color};transform:rotate(${heading}deg);${isSelected ? `box-shadow:0 0 0 2px #0d1117,0 0 0 4px ${color}` : ''}"></span>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const portIcon = () => new L.divIcon({
  className: 'port-map-icon',
  html: `<span></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const berthIcon = () => new L.divIcon({
  className: 'berth-map-icon',
  html: `<span style="border-color:#8b949e"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const MapViewController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center?.length === 2) map.setView(center, 12, { animate: true });
  }, [center?.[0], center?.[1], map]);
  return null;
};

/* ── Custom Port Dropdown ─────────────────────────────────────────────────── */
const PortSelect = ({ ports, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = ports.find(p => p.port_id === value);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 260 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: 'var(--bg-panel)', color: 'var(--text-title)',
        border: '1px solid var(--border-color)', boxShadow: 'none',
        padding: '0.6rem 0.85rem 0.6rem 0.9rem', borderRadius: '8px',
        fontSize: '0.85rem', fontFamily: 'inherit', fontWeight: 500,
        cursor: 'pointer', outline: 'none', textAlign: 'left',
      }}>
        <MapPin size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? `${selected.port_name} — Port ${selected.port_id}` : 'Select port…'}
        </span>
        <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 1000,
          background: '#161b22', border: '1px solid var(--border-color)', borderRadius: '10px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)', maxHeight: 320, overflowY: 'auto', padding: '0.35rem',
        }}>
          {ports.map(p => {
            const isActive = p.port_id === value;
            return (
              <button key={p.port_id} onClick={() => { onChange(p.port_id); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: 'none',
                  background: isActive ? 'rgba(88,166,255,0.12)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-main)',
                  fontSize: '0.83rem', fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                  outline: 'none',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {isActive ? <Check size={12} style={{ flexShrink: 0 }} /> : <span style={{ width: 12, flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{p.port_name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Port {p.port_id}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const StatPill = ({ color, label, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.3rem 0.6rem', borderRadius: '999px', background: `${color}18`, border: `1px solid ${color}30` }}>
    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
    <span style={{ fontSize: '0.72rem', fontWeight: 700, color }}>{count}</span>
    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
  </div>
);

const Field = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: color || 'var(--text-title)' }}>{value}</span>
  </div>
);

const formatTime = hours => {
  const d = new Date(new Date(SCENE_TIME).getTime() + hours * 3600000);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

/* ── Shared overlay card style ────────────────────────────────────────────── */
const overlayCard = {
  background: 'rgba(13,17,23,0.92)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

/* ── Main Component ─────────────────────────────────────────────────────── */
const PortReplay = () => {
  const [ports, setPorts] = useState([]);
  const [portId, setPortId] = useState(1);
  const [scene, setScene] = useState(null);
  const [hours, setHours] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);

  useEffect(() => {
    fetchHotspots().then(data => {
      if (Array.isArray(data)) setPorts(data.sort((a, b) => a.port_id - b.port_id));
    }).catch(console.error);
  }, []);

  // Reset everything on port change
  const handlePortChange = (newId) => {
    setPortId(newId);
    setHours(0);
    setPlaying(false);
    setSelected(null);
    setScene(null);
    setLoading(true);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const ts = new Date(new Date(SCENE_TIME).getTime() + hours * 3600000).toISOString();
    fetchScene(portId, ts)
      .then(data => { if (!cancelled) { setScene(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [portId, hours]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setHours(v => { if (v >= 72) { setPlaying(false); return 72; } return v + 1; });
    }, 500);
    return () => window.clearInterval(timer);
  }, [playing]);

  const chosenVessel = scene?.vessels?.find(v => v.id === selected);

  const counts = scene?.vessels ? {
    servicing: scene.vessels.filter(v => v.status === 'SERVICING').length,
    waiting:   scene.vessels.filter(v => v.status === 'WAITING').length,
    highRisk:  scene.vessels.filter(v => v.risk_level === 'HIGH').length,
    total:     scene.vessels.length,
  } : null;

  if (loading && !scene) return (
    <div className="page-container animate-fade-in flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '3rem', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
        <Loader2 className="spin" size={36} style={{ color: 'var(--primary)' }} />
        <div style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)' }} className="animate-pulse">
          Loading Simulation Data...
        </div>
      </div>
    </div>
  );

  if (!scene) return (
    <div className="page-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1.25rem', paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-color)', flexShrink: 0,
      }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
          Port Operations Replay
        </h2>
        <PortSelect ports={ports} value={portId} onChange={handlePortChange} />
      </header>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '3rem', minWidth: 400 }}>
          <AlertTriangle size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ color: 'var(--text-title)', marginBottom: '0.5rem', fontSize: '1.2rem', fontWeight: 700 }}>Simulation Data Unavailable</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>There is no digital twin visualization available for this port.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>

      {/* ── Header ── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1.25rem', paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-color)', flexShrink: 0,
      }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
          Port Operations Replay
        </h2>
        <PortSelect ports={ports} value={portId} onChange={handlePortChange} />
      </header>

      {/* ── Main Layout (Sidebar restored) ── */}
      <div style={{ display: 'flex', gap: '1.25rem', flex: 1, minHeight: 0 }}>

        {/* ── Map Column ── */}
        <div style={{ flex: 1, position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)', minHeight: 0 }}>

          <MapContainer center={scene.port.coordinates} zoom={12} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
            <MapViewController center={scene.port.coordinates} />
            <TileLayer className="map-tiles-dark" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />

            <Marker position={scene.port.coordinates} icon={portIcon()}>
              <Popup className="dark-popup"><strong>{scene.port.name}</strong></Popup>
            </Marker>

            {scene.routes?.map(route => (
              <Polyline key={`r-${route.vessel_id}`} positions={route.map_coordinates}
                pathOptions={{ color: routeColor(route.status), weight: 3, opacity: 0.8 }} />
            ))}

            {scene.berths?.map(berth => (
              <Marker key={`b-${berth.id}`} position={berth.map_position || scene.port.coordinates} icon={berthIcon()}>
                <Popup className="dark-popup"><strong>{berth.name}</strong><br />Berth {berth.id}</Popup>
              </Marker>
            ))}

            {scene.vessels?.map(vessel => (
              <Marker key={`v-${vessel.id}`}
                position={vessel.map_position}
                icon={mapIcon(vesselColor(vessel.status, vessel.risk_level), vessel.heading, selected === vessel.id)}
                eventHandlers={{ click: () => setSelected(vessel.id) }}>
                <Popup className="dark-popup">
                  <strong>Vessel {vessel.id}</strong><br />
                  {vessel.status}{vessel.risk_level === 'HIGH' ? ' · ⚠ High Risk' : ''}
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* ── Time Badge (top-left) ── */}
          <div style={{
            position: 'absolute', top: '1rem', left: '4rem', zIndex: 400,
            background: 'var(--bg-panel)', padding: '0.4rem 0.85rem',
            border: '1px solid var(--border-color)', borderRadius: '6px',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: playing ? '#3fb950' : 'var(--text-muted)', boxShadow: playing ? '0 0 6px #3fb950' : 'none', flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-title)' }}>
              {formatTime(hours)}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>T+{hours}h</span>
          </div>

          {/* ── Legend (top-right, collapsible) ── */}
          <div style={{
            position: 'absolute', top: '0.875rem', right: '0.875rem', zIndex: 400,
            ...overlayCard, overflow: 'hidden', minWidth: 150,
          }}>
            <button onClick={() => setLegendOpen(o => !o)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 0.75rem', background: 'transparent', border: 'none',
                cursor: 'pointer', outline: 'none', gap: '0.5rem',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Layers size={12} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Legend</span>
              </div>
              <ChevronUp size={12} style={{ color: 'var(--text-muted)', transform: legendOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
            </button>

            {legendOpen && (
              <div style={{ padding: '0 0.75rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.42rem' }}>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: '0.2rem' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '4px', background: '#58a6ff', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-main)' }}>Port</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 14, height: 14, border: '2px solid #8b949e', borderRadius: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-main)' }}>Berth</span>
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0.25rem 0' }} />
                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', margin: '0.25rem 0 0.15rem 0' }}>
                  Vessels
                </div>
                {[
                  { color: STATUS_META.SERVICING.color, label: 'Servicing' },
                  { color: STATUS_META.HIGH_RISK.color, label: 'High Risk' },
                  { color: STATUS_META.DEFAULT.color,   label: 'En Route' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-main)' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Playback Controls (floating bottom center) ── */}
          <div style={{
            position: 'absolute', bottom: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500,
            background: 'rgba(22, 27, 34, 0.95)', backdropFilter: 'blur(12px)',
            padding: '0.75rem 1rem', border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '1rem',
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            width: '440px',
            maxWidth: '90%',
          }}>
            <button onClick={() => { setHours(0); setPlaying(false); }} title="Restart"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', outline: 'none', display: 'flex', padding: 0 }}>
              <SkipBack size={16} />
            </button>
            <button onClick={() => { if (hours >= 72) setHours(0); setPlaying(p => !p); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px',
                padding: '0.4rem 0.9rem', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
              }}>
              {playing ? <Pause size={13} /> : <Play size={13} />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <input type="range" min="0" max="72" value={hours}
              onChange={e => setHours(Number(e.target.value))}
              style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--primary)', margin: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '90px', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hour</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-title)', fontVariantNumeric: 'tabular-nums' }}>{hours} / 72</span>
            </div>
          </div>

        </div>

        {/* ── Inspector Sidebar (Right side restored) ── */}
        <div style={{
          width: 300, flexShrink: 0,
          background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '10px',
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          {/* Inspector header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              {chosenVessel ? 'Inspector' : 'Fleet Overview'}
            </span>
            {chosenVessel && (
              <button onClick={() => setSelected(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', outline: 'none' }}>
                Clear
              </button>
            )}
          </div>

          <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
            {chosenVessel ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-title)' }}>Vessel {chosenVessel.id}</span>
                  <div style={{
                    fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '0.15rem 0.5rem', borderRadius: '999px',
                    background: `${vesselColor(chosenVessel.status, chosenVessel.risk_level)}22`,
                    color: vesselColor(chosenVessel.status, chosenVessel.risk_level),
                    border: `1px solid ${vesselColor(chosenVessel.status, chosenVessel.risk_level)}44`,
                  }}>
                    {chosenVessel.risk_level === 'HIGH' ? '⚠ High Risk' : chosenVessel.status}
                  </div>
                </div>
                <Field label="Status"    value={chosenVessel.status}                              color={vesselColor(chosenVessel.status, chosenVessel.risk_level)} />
                <Field label="Berth"     value={`B${chosenVessel.assigned_berth_id}`} />
                <Field label="Wait Time" value={`${Math.round(chosenVessel.waiting_minutes)} min`} />
                <Field label="Heading"   value={`${chosenVessel.heading ?? '—'}°`} />
                <Field label="Risk Level"value={chosenVessel.risk_level || 'Normal'}               color={chosenVessel.risk_level === 'HIGH' ? '#f85149' : '#3fb950'} />
              </div>
            ) : counts ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ textAlign: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-title)', lineHeight: 1 }}>{counts.total}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.25rem' }}>Total Vessels</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <StatPill color={STATUS_META.SERVICING.color} label="Servicing" count={counts.servicing} />
                  <StatPill color={STATUS_META.HIGH_RISK.color} label="High Risk" count={counts.highRisk} />
                  <StatPill color={STATUS_META.DEFAULT.color}   label="En Route"  count={counts.total - counts.servicing - counts.highRisk} />
                </div>
                <div style={{ height: 1, background: 'var(--border-color)', margin: '0.25rem 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                  <Anchor size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-main)' }}>
                    <strong>{scene.berths?.length ?? 0}</strong> berths at {scene.port.name}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '0.5rem' }}>
                  Click any vessel on the map to inspect its details and assignment.
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2rem 0' }}>
                <Ship size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                Loading vessels…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortReplay;
