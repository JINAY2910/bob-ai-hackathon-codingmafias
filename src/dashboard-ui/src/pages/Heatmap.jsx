import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, Activity, ChevronDown, ChevronUp, MapPin, TrendingUp } from 'lucide-react';
import { fetchHotspots } from '../api/client';

const Heatmap = () => {
  const [predictions, setPredictions] = useState(null);
  const [selectedPortId, setSelectedPortId] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAllPorts, setShowAllPorts] = useState(false);

  const loadHotspots = async () => {
    setRefreshing(true);
    setError('');
    try {
      const nextPredictions = await fetchHotspots();
      setPredictions(Array.isArray(nextPredictions) ? nextPredictions.filter(Boolean) : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadHotspots(); }, []);

  if (!predictions && !error) return (
    <div className="page-container animate-fade-in">
      <div className="card text-center py-16">
        <div className="text-muted uppercase tracking-widest text-xs font-bold mb-4 animate-pulse">Loading Forecast...</div>
        <div className="skeleton-bar"><div className="skeleton-progress"></div></div>
      </div>
    </div>
  );

  if (error) return (
    <div className="card border-danger" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <AlertTriangle size={24} className="text-danger" />
      <div><strong>Forecast unavailable</strong><p className="text-muted text-sm">{error}</p></div>
      <button className="btn btn-secondary" style={{ marginTop: '1rem', alignSelf: 'flex-start' }} onClick={loadHotspots}>Retry</button>
    </div>
  );

  const highestRiskPort = [...predictions].sort((a, b) => b.congestion_probability - a.congestion_probability)[0] || predictions[0];
  const selectedPort = predictions.find(port => port.port_id === selectedPortId) || highestRiskPort;
  const displayPorts = showAllPorts ? predictions : predictions.slice(0, 32);

  const getRiskColor = (prob) => {
    if (prob >= 0.90) return 'var(--danger)';
    if (prob >= 0.80) return 'var(--warning)';
    return 'var(--success)';
  };

  const getRiskLabel = (prob) => {
    if (prob >= 0.90) return 'Critical Risk';
    if (prob >= 0.80) return 'Elevated Risk';
    return 'Normal Operations';
  };

  const getRiskBg = (prob) => {
    if (prob >= 0.90) return 'rgba(248,81,73,0.08)';
    if (prob >= 0.80) return 'rgba(210,153,34,0.08)';
    return 'rgba(63,185,80,0.08)';
  };

  const selectedProb = selectedPort?.congestion_probability || 0;
  const selectedPct = Math.round(selectedProb * 100);
  const riskColor = getRiskColor(selectedProb);
  const riskLabel = getRiskLabel(selectedProb);
  const reasons = selectedPort?.predicted_hotspots?.[0]?.reasons || ['No critical factors detected'];

  return (
    <div className="page-container animate-fade-in" style={{ paddingBottom: '2rem' }}>
      {/* ── Page Header ── */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-title)', margin: 0 }}>
            Network Congestion Heatmap
          </h2>
        </div>
        <button className="btn btn-primary" onClick={loadHotspots} disabled={refreshing} style={{ gap: '0.5rem', minWidth: 120 }}>
          <RotateCcw size={15} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {/* ── Two-column body ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LEFT PANEL: Port Details ── */}
        <div style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}>
          {/* Header bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <MapPin size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              Selected Port
            </span>
          </div>

          {/* Port name + ID */}
          <div style={{ padding: '1.25rem 1rem 0.75rem' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-title)', lineHeight: 1.2, marginBottom: '0.3rem' }}>
              {selectedPort?.port_name || 'Unknown'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              Port ID: {selectedPort?.port_id}
            </div>
          </div>

          {/* Congestion level */}
          <div style={{ padding: '0 1rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Congestion Level
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: riskColor, letterSpacing: '-0.01em' }}>
                {selectedPct}%
              </span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--bg-panel)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(selectedPct, 100)}%`, height: '100%', background: riskColor, borderRadius: 3, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border-color)', margin: '0 1rem' }} />

          {/* Risk Factors */}
          <div style={{ padding: '1rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--text-muted)', marginBottom: '0.75rem',
            }}>
              <TrendingUp size={12} />
              Risk Factors
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {reasons.map((r, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: '0.6rem',
                  alignItems: 'flex-start',
                  padding: '0.55rem 0.7rem',
                  background: 'rgba(255,255,255,0.025)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <Activity size={12} style={{ color: 'var(--primary)', marginTop: 2, flexShrink: 0, opacity: 0.85 }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.45, opacity: 0.9 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Heatmap Grid ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Legend row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--text-muted)', opacity: 0.7,
            }}>
              Heatmap Matrix &nbsp;<span style={{ opacity: 0.5 }}>({predictions.length} total)</span>
            </span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {[
                { label: 'Normal',   color: 'rgba(63,185,80,0.5)' },
                { label: 'Elevated', color: 'rgba(210,153,34,0.65)' },
                { label: 'Critical', color: 'rgba(248,81,73,0.65)' },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <div style={{ width: 10, height: 10, background: color, borderRadius: 2, flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Grid card */}
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '1.5rem 1rem 1rem',
            overflow: 'visible',
          }}>
            <div className="heatmap-grid">
              {displayPorts.map(port => {
                const score = port.congestion_probability || 0;
                let level = 'low';
                if (score >= 0.90) level = 'high';
                else if (score >= 0.80) level = 'medium';
                const isSelected = selectedPort?.port_id === port.port_id;
                return (
                  <button
                    key={port.port_id}
                    className={`heatmap-cell ${level} ${isSelected ? 'selected' : 'opacity-80'}`}
                    onClick={() => setSelectedPortId(port.port_id)}
                    title={port.port_name}
                  >
                    <span className="font-bold text-xs">{Math.round(score * 100)}</span>
                    <span style={{ fontSize: '0.5rem', opacity: 0.55, letterSpacing: '-0.02em' }}>P{port.port_id}</span>
                  </button>
                );
              })}
            </div>

            {predictions.length > 32 && (
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                <button
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em',
                    color: 'var(--primary)', padding: '0.3rem 0.8rem', borderRadius: '999px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(88,166,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setShowAllPorts(!showAllPorts)}
                >
                  {showAllPorts
                    ? <><ChevronUp size={14} /> Hide expanded matrix</>
                    : <><ChevronDown size={14} /> Show {predictions.length - 32} more ports</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Heatmap;
