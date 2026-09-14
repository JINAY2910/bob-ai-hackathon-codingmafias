import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { fetchOperationsPlan } from '../api/client';

const OperationsPlan = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const loadPlan = async () => {
    setIsRefreshing(true);
    setError("");
    try {
      setData(await fetchOperationsPlan());
    } catch (requestError) {
      setError(requestError.message);
    }
    setIsRefreshing(false);
  };

  useEffect(() => { loadPlan(); }, []);

  if (!data && !error) return (
    <div className="page-container animate-fade-in flex flex-col items-center justify-center" style={{ minHeight: '50vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '3rem', background: 'var(--bg-panel)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
        <Loader2 className="spin" size={36} style={{ color: 'var(--primary)' }} />
        <div style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)' }} className="animate-pulse">
          Generating 72hr Plan...
        </div>
      </div>
    </div>
  );
  if (error) return (
    <div className="card border-danger">
      <AlertTriangle size={24} className="text-danger mb-2" />
      <div><strong>Historical simulation unavailable</strong><p className="text-muted text-sm">{error}</p></div>
      <button className="btn btn-secondary mt-4" onClick={loadPlan}>Retry</button>
    </div>
  );

  const allActions = [];
  (data.shifts || []).forEach(shift => {
    (shift.supervisor_actions || []).forEach(action => {
      allActions.push({ ...action, shiftStart: shift.time_block.start });
    });
  });

  const displayActions = showAll ? allActions : allActions.slice(0, 8);
  const risk = String(data.overall_risk || 'LOW').toUpperCase();

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
          <h2>72-Hour Operations Plan</h2>
        </div>
        <button className="btn btn-primary" onClick={loadPlan} disabled={isRefreshing}>
          <RotateCcw size={16} className={isRefreshing ? "spin" : ""} />
          {isRefreshing ? "Refreshing" : "Refresh"}
        </button>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2" style={{
          background: 'linear-gradient(145deg, var(--bg-panel) 0%, rgba(22, 27, 34, 0.4) 100%)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
        }}>
          <div className="panel-kicker" style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}><Info size={14} /> Executive Summary</div>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--text-main)' }}>{data.executive_summary}</p>
        </div>
        <div className={`text-center flex flex-col justify-center border-${risk === 'HIGH' ? 'danger' : risk === 'MEDIUM' ? 'warning' : 'success'}`} style={{
          background: 'linear-gradient(145deg, var(--bg-panel) 0%, rgba(22, 27, 34, 0.4) 100%)',
          borderWidth: '1px', borderStyle: 'solid', borderRadius: '12px', padding: '1.5rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
        }}>
          <div className="panel-kicker justify-center mb-2" style={{ color: 'var(--text-muted)' }}>Network Risk</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em' }} className={risk === 'HIGH' ? 'text-danger' : risk === 'MEDIUM' ? 'text-warning' : 'text-success'}>{risk}</div>
        </div>
      </section>

      <section className="card">
        <div className="panel-kicker mb-4"><AlertTriangle size={14} /> Critical Supervisor Actions ({allActions.length} pending)</div>
        
        {displayActions.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50" />
            <p>No immediate supervisor actions required.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Task Description</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayActions.map((action, i) => (
                  <tr key={i}>
                    <td>
                      <span className={action.priority === 'P0' ? 'badge-danger' : 'badge-warning'}>
                        {action.priority}
                      </span>
                    </td>
                    <td className="font-medium">{action.description}</td>
                    <td className="text-muted text-sm">{new Date(action.due_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary">Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {allActions.length > 8 && (
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
                <><ChevronUp size={14} /> Hide expanded actions</>
              ) : (
                <><ChevronDown size={14} /> Show {allActions.length - 8} more actions</>
              )}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default OperationsPlan;
