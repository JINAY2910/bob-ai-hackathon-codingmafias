import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, Anchor, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { fetchBerthAssignments } from '../api/client';

const formatWaitTime = (minutes) => {
  if (minutes < 0) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  return `${Math.round(minutes / 1440)} days`;
};

const BerthAssignments = () => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const loadAssignments = async () => {
    setRefreshing(true);
    setError("");
    try {
      setResult(await fetchBerthAssignments(1));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAssignments(); }, []);

  if (!result && !error) return (
    <div className="page-container animate-fade-in flex flex-col items-center justify-center" style={{ minHeight: '50vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '3rem', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
        <Loader2 className="spin" size={36} style={{ color: 'var(--primary)' }} />
        <div style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)' }} className="animate-pulse">
          Running Optimizer...
        </div>
      </div>
    </div>
  );
  if (error) return (
    <div className="card border-danger">
      <AlertTriangle size={24} className="text-danger mb-2" />
      <div><strong>Optimizer unavailable</strong><p className="text-muted text-sm">{error}</p></div>
      <button className="btn btn-secondary mt-4" onClick={loadAssignments}>Retry</button>
    </div>
  );

  const assignments = result.assignments || [];
  const displayAssignments = showAll ? assignments : assignments.slice(0, 15);

  return (
    <div className="page-container animate-fade-in">
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div>
          <h2>Berth Assignments</h2>
        </div>
        <button className="btn btn-primary" onClick={loadAssignments} disabled={refreshing}>
          <RotateCcw size={16} className={refreshing ? "spin" : ""} /> {refreshing ? "Optimizing" : "Run Optimizer"}
        </button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Coverage', value: `${Math.round((result.assignment_rate || 0) * 100)}%` },
          { label: 'Avg Wait', value: formatWaitTime(result.objective?.average_wait_minutes || 0) },
          { label: 'Max Wait', value: formatWaitTime(result.objective?.max_wait_minutes || 0) },
          { label: 'Status', value: result.status, isStatus: true }
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'linear-gradient(145deg, var(--bg-panel) 0%, rgba(22, 27, 34, 0.4) 100%)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1.25rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            height: '105px', display: 'flex', flexDirection: 'column', justifyContent: 'center'
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{stat.label}</div>
            <div style={{ 
              fontSize: stat.isStatus ? '1.1rem' : '1.5rem', 
              fontWeight: 700, 
              color: stat.isStatus ? (result.constraints_satisfied ? 'var(--success)' : 'var(--warning)') : 'var(--text-title)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1.2
            }}>
              {stat.value}
            </div>
          </div>
        ))}
      </section>

      {!result.constraints_satisfied && (
        <div className="card border-warning mb-6 flex gap-3 items-center">
          <AlertTriangle size={20} className="text-warning" />
          <div className="text-sm">{(result.limitations || []).join(" ")}</div>
        </div>
      )}

      <section className="card">
        <div className="panel-kicker"><Anchor size={14} /> Optimized Schedule ({assignments.length} vessels)</div>

        {displayAssignments.length ? (
          <div className="overflow-x-auto mt-4">
            <table>
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Arrival</th>
                  <th>Berth</th>
                  <th>Service Starts</th>
                  <th className="text-right">Estimated Delay</th>
                </tr>
              </thead>
              <tbody>
                {displayAssignments.map(assignment => {
                  const waitTime = assignment.estimated_wait_minutes;
                  return (
                    <tr key={assignment.vessel_id}>
                      <td>
                        <span className="font-semibold text-white">Vessel {assignment.vessel_id}</span>
                      </td>
                      <td className="text-muted">{new Date(assignment.arrival_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <span className="font-mono text-primary">B{assignment.berth_id}</span>
                      </td>
                      <td>
                        {new Date(assignment.service_start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="text-right">
                        <span className={waitTime > 60 ? "text-danger font-semibold" : "text-success"}>
                          {formatWaitTime(waitTime)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            {assignments.length > 15 && (
              <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em',
                    color: 'var(--primary)', padding: '0.3rem 0.8rem', borderRadius: '999px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(88,166,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? (
                    <><ChevronUp size={14} /> Hide expanded schedule</>
                  ) : (
                    <><ChevronDown size={14} /> Show {assignments.length - 15} more vessels</>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted">
            <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
            <p>No assignments found.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default BerthAssignments;
