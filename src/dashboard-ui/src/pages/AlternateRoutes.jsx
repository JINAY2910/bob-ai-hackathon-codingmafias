import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, ArrowRight, CheckCircle2, ShieldAlert, Info, Send, ChevronDown, MapPin, Check } from 'lucide-react';
import { fetchRoutingRecommendations, issueDiversionAdvisory, fetchHotspots } from '../api/client';

const StatRow = ({ label, value, valueColor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: valueColor || 'var(--text-title)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);

/* Custom styled dropdown -------------------------------------------------- */
const PortSelect = ({ ports, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = ports.find(p => p.port_id === value);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 260 }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'var(--bg-panel)',
          color: 'var(--text-title)',
          border: '1px solid var(--border-color)',
          boxShadow: 'none',
          padding: '0.6rem 0.85rem 0.6rem 0.9rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          fontFamily: 'inherit',
          fontWeight: 500,
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.15s',
          textAlign: 'left',
        }}
      >
        <MapPin size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? `${selected.port_name} — Port ${selected.port_id}` : 'Select port…'}
        </span>
        <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Dropdown list */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
          background: '#161b22',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          maxHeight: 320,
          overflowY: 'auto',
          padding: '0.35rem',
        }}>
          {ports.map(p => {
            const isActive = p.port_id === value;
            return (
              <button
                key={p.port_id}
                onClick={() => { onChange(p.port_id); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  width: '100%', padding: '0.5rem 0.75rem',
                  borderRadius: '6px', border: 'none',
                  background: isActive ? 'rgba(88,166,255,0.12)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-main)',
                  fontSize: '0.83rem', fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {isActive
                  ? <Check size={12} style={{ flexShrink: 0 }} />
                  : <span style={{ width: 12, flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{p.port_name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>Port {p.port_id}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
/* ------------------------------------------------------------------------- */

const AlternateRoutes = () => {
  const [ports, setPorts] = useState([]);
  const [portId, setPortId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const hotspotData = await fetchHotspots();
        if (Array.isArray(hotspotData)) {
          setPorts(hotspotData.sort((a, b) => a.port_id - b.port_id));
        }
      } catch (err) {
        console.error('Failed to load ports', err);
      }
    };
    init();
  }, []);

  const simulate = async () => {
    if (!portId) return;
    setLoading(true);
    setError('');
    setRecommendations(null);
    try {
      const result = await fetchRoutingRecommendations('demo-vessel', portId);
      setRecommendations(result.recommendations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { simulate(); }, [portId]);

  const [issuedOptionId, setIssuedOptionId] = useState(null);

  const handleIssue = async (option) => {
    setLoading(true);
    try {
      const recPortIdStr = option.recommended_option.berth_id.replace('Port ', '');
      await issueDiversionAdvisory(portId, recPortIdStr, 'demo-vessel', 'System approved diversion.');
      setIssuedOptionId(option.recommended_option.port_id || recPortIdStr);
      setTimeout(() => setIssuedOptionId(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const topOptions = recommendations?.slice(0, 3) || [];

  return (
    <div className="page-container animate-fade-in pb-12">

      {/* ── Page Header ── */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
          Diversion Advisory
        </h2>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <PortSelect ports={ports} value={portId} onChange={setPortId} />

          <button className="btn btn-primary" onClick={simulate} disabled={loading} style={{ minWidth: 110, fontWeight: 600 }}>
            <RotateCcw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </header>

      {error ? (
        <div className="card border-danger" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <ShieldAlert size={24} className="text-danger" />
          <div><strong>Analysis Failed</strong><p className="text-muted text-sm">{error}</p></div>
          <button className="btn" style={{ marginTop: '1rem', alignSelf: 'flex-start' }} onClick={simulate}>Retry</button>
        </div>
      ) : topOptions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }} className="animate-fade-in">
          {topOptions.map((option, idx) => {
            const recPortId = option.recommended_option.port_id
              || option.recommended_option.berth_id?.replace(/[^0-9]/g, '')
              || '—';
            
            const isIssued = issuedOptionId === (option.recommended_option.port_id || option.recommended_option.berth_id.replace('Port ', ''));

            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ 
                    background: 'rgba(88, 166, 255, 0.15)', 
                    border: '1px solid rgba(88, 166, 255, 0.3)', 
                    color: 'var(--primary)', 
                    fontSize: '0.85rem', 
                    fontWeight: 800, 
                    width: 28, 
                    height: 28, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: '8px', 
                    boxShadow: '0 4px 12px rgba(88, 166, 255, 0.2)' 
                  }}>
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-title)', letterSpacing: '0.02em' }}>
                    Alternative Route #{idx + 1}
                  </h3>
                </div>
                
                {/* ── Route Comparison ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0', alignItems: 'stretch' }}>
                  {/* Origin */}
                  <div style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderRight: 'none',
                    borderRadius: '10px 0 0 10px',
                    padding: '1.5rem 1.75rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)',
                        flexShrink: 0, animation: 'pulse 2s infinite',
                      }} />
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--danger)' }}>
                        Origin · Congested
                      </span>
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                      {option.current_option.port_name}
                    </div>
                    <StatRow label="Status" value="High Congestion" valueColor="var(--danger)" />
                    <StatRow
                      label="Expected Delay"
                      value={`${Math.round(option.current_option.expected_wait_minutes / 1440)} days`}
                      valueColor="var(--danger)"
                    />
                    <StatRow label="Port ID" value={`P${portId}`} />
                  </div>

                  {/* Arrow connector */}
                  <div style={{
                    width: 64,
                    background: 'var(--bg-panel)',
                    borderTop: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                  }}>
                    {/* Arrow circle */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(88,166,255,0.1)',
                      border: '1px solid rgba(88,166,255,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 12px rgba(88,166,255,0.15)',
                    }}>
                      <ArrowRight size={15} style={{ color: 'var(--primary)' }} />
                    </div>
                    <span style={{
                      fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.14em', color: 'var(--text-muted)',
                    }}>Divert</span>
                  </div>

                  {/* Destination */}
                  <div style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderLeft: 'none',
                    borderRadius: '0 10px 10px 0',
                    padding: '1.5rem 1.75rem',
                    backgroundImage: 'linear-gradient(135deg, transparent 55%, rgba(63,185,80,0.04))',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <CheckCircle2 size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--success)' }}>
                        Recommended Alternate
                      </span>
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-title)', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                      {option.recommended_option.port_name}
                    </div>
                    <StatRow label="Status" value="Clear Path" valueColor="var(--success)" />
                    <StatRow
                      label="Berths Available"
                      value={option.recommended_option.available_capacity}
                      valueColor="var(--success)"
                    />
                    <StatRow label="Port ID" value={`P${recPortId}`} />
                  </div>
                </div>

                {/* ── AI Reasoning ── */}
                <div style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '6px',
                      background: 'rgba(88,166,255,0.12)',
                      border: '1px solid rgba(88,166,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Info size={13} style={{ color: 'var(--primary)' }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                      AI Reasoning
                    </span>
                  </div>
                  {/* Divider */}
                  <div style={{ height: 1, background: 'var(--border-color)' }} />
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-main)', lineHeight: 1.7, margin: 0 }}>
                    {option.reason}
                  </p>
                </div>

                {/* ── Issue Advisory Button ── */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => handleIssue(option)}
                    disabled={loading || isIssued}
                    style={{
                      padding: '0.75rem 2.5rem',
                      borderRadius: '999px',
                      border: 'none',
                      background: isIssued
                        ? 'var(--success)'
                        : 'linear-gradient(90deg, #3b82f6, var(--primary))',
                      color: 'white',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.55rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      fontFamily: 'inherit',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      cursor: isIssued || loading ? 'default' : 'pointer',
                      transition: 'opacity 0.2s, box-shadow 0.2s',
                      boxShadow: isIssued
                        ? '0 0 20px rgba(63,185,80,0.35)'
                        : '0 4px 16px rgba(88,166,255,0.3)',
                      opacity: loading && !isIssued ? 0.65 : 1,
                      minWidth: 260,
                    }}
                  >
                    {isIssued ? (
                      <><CheckCircle2 size={16} /> Advisory Issued Successfully</>
                    ) : (
                      <><Send size={14} /> Issue Fleet Advisory</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-16">
          <div className="text-muted uppercase tracking-widest text-xs font-bold mb-4 animate-pulse">
            Running AI Diversion Analysis…
          </div>
          <div className="skeleton-bar"><div className="skeleton-progress"></div></div>
        </div>
      )}
    </div>
  );
};

export default AlternateRoutes;
