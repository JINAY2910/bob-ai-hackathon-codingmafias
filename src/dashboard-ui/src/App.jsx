import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Ship, Anchor, CalendarClock, AlertTriangle, Info, CheckCircle2, Navigation, Play, Pause, RotateCcw, Gauge, ArrowRight, MapPin, Waves, Star, TrendingUp, Filter, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './index.css';

// --- API Service Mock ---
const API_BASE = "http://localhost:8000/api/v1";

const fetchOperationsPlan = async () => {
  try {
    const res = await fetch(`${API_BASE}/operations-plan`);
    if (!res.ok) throw new Error("API not running");
    return await res.json();
  } catch (error) {
    // Return mock data if backend isn't running yet
    return {
      executive_summary: "P0 — Approval needed by Wednesday 12:30. Berth 3 is forecast to become congested between 14:00 and 18:00... Reassign Vessel X to Berth 7 and reserve cranes Q2 and Q3.",
      overall_risk: "HIGH",
      critical_actions: [
        {
          action_id: "act-1001",
          priority: "P0",
          description: "Approve Vessel X reassignment from B3 to B7",
          due_at: new Date().toISOString(),
          status: "PENDING_APPROVAL"
        }
      ],
      congestion_hotspots: [
        {
          berth_id: "B3",
          start: new Date(Date.now() + 2 * 3600000).toISOString(),
          end: new Date(Date.now() + 6 * 3600000).toISOString(),
          probability: 0.91,
          reasons: ["12 arrivals expected in next 24 hours"]
        }
      ]
    };
  }
};

// --- Components ---

const Sidebar = () => {
  const location = useLocation();
  const navItems = [
    { path: "/", icon: <LayoutDashboard size={20} />, label: "72-Hour Plan" },
    { path: "/hotspots", icon: <AlertTriangle size={20} />, label: "Congestion Heatmap" },
    { path: "/berths", icon: <Anchor size={20} />, label: "Berth Assignments" },
    { path: "/routing", icon: <Navigation size={20} />, label: "Alternate Routes" },
    { path: "/visualization", icon: <Ship size={20} />, label: "3D Port Replay" },
  ];

  return (
    <aside className="sidebar">
      <div className="mb-8">
        <h1 className="gradient-text text-3xl font-bold flex items-center gap-2">
          <Ship className="text-blue-500" /> PortFlow
        </h1>
        <p className="text-muted text-small mt-2">AI Operations & Routing</p>
      </div>
      <nav className="flex flex-col gap-2">
        {navItems.map(item => (
          <Link key={item.path} to={item.path} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
            {item.icon} {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto glass-card text-small">
        <div className="flex items-center gap-2 mb-2">
          <div className="status-indicator bg-green-500"></div>
          <span className="font-semibold text-white">System Online</span>
        </div>
        <p className="text-muted">Prediction Model: V1.2<br/>Optimizer: Running</p>
      </div>
    </aside>
  );
};

const OperationsPlan = () => {
  const [data, setData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPlan = async () => {
    setIsRefreshing(true);
    const nextData = await fetchOperationsPlan();
    setData(nextData);
    setIsRefreshing(false);
  };

  useEffect(() => { loadPlan(); }, []);

  if (!data) return <div className="plan-loading">Loading 72-hour plan...</div>;

  return (
    <div className="operations-page animate-fade-in">
      <header className="operations-header">
        <div className="page-heading">
          <p className="eyebrow">Port command center / rolling forecast</p>
          <h2>72-Hour Operations Plan</h2>
          <p className="page-subtitle">A clear view of what is arriving, what is at risk, and what needs attention next.</p>
        </div>
        <div className="header-actions">
          <div className="plan-window">
            <CalendarClock size={16} />
            <span>Rolling 72 hours</span>
          </div>
          <button className="btn btn-primary" onClick={loadPlan} disabled={isRefreshing}>
            <RotateCcw size={16} className={isRefreshing ? "spin" : ""} />
            {isRefreshing ? "Refreshing" : "Refresh plan"}
          </button>
        </div>
      </header>

      <section className="plan-overview-grid">
        <div className="plan-summary glass-card stagger-1">
          <div className="section-kicker"><Info size={16} /> Executive summary</div>
          <div className="summary-copy">{data.executive_summary}</div>
          <div className="summary-footnote">
            <span className="live-dot" /> Forecast generated from current model outputs
          </div>
        </div>

        <div className={`risk-card glass-card stagger-2 risk-${String(data.overall_risk || 'LOW').toLowerCase()}`}>
          <div className="risk-card-top"><span className="section-kicker">Network risk</span><AlertTriangle size={18} /></div>
          <div className="risk-value">{data.overall_risk || "LOW"}</div>
          <p>{data.congestion_hotspots?.length || 0} congestion signal{data.congestion_hotspots?.length === 1 ? "" : "s"} in this horizon</p>
          <div className="risk-meter"><span style={{ width: data.overall_risk === "HIGH" ? "88%" : data.overall_risk === "MEDIUM" ? "58%" : "28%" }} /></div>
        </div>
      </section>

      <section className="timeline-card glass-card stagger-3">
        <div className="timeline-heading">
          <div>
            <div className="section-kicker"><CalendarClock size={16} /> Shift timeline</div>
            <h3>Operational watchlist</h3>
          </div>
          <span className="timeline-count">{data.shifts?.length || 0} shifts / 24h blocks</span>
        </div>

        <div className="shift-list">
          {(data.shifts || []).map((shift, idx) => {
            const start = new Date(shift.time_block.start);
            const end = new Date(shift.time_block.end);
            const risk = String(shift.risk?.level || "LOW").toLowerCase();
            const actions = shift.supervisor_actions || [];
            const warnings = (shift.risk?.hotspots || []).map((hotspot, index) => ({
              id: `hotspot-${index}`,
              type: "warning",
              label: "Congestion warning",
              value: `Berth ${hotspot}`,
            }));
            const operations = (shift.planned_operations || []).map((operation, index) => ({
              id: `operation-${index}`,
              type: "operation",
              label: `${operation.vessel_id} ${operation.action.toLowerCase()}`,
              value: `Berth ${operation.berth_id}`,
            }));
            const rightItems = [...warnings, ...operations];
            const rowCount = Math.max(actions.length, rightItems.length, 1);
            
            return (
              <article key={idx} className={`shift-card risk-border-${risk}`}>
                <div className="shift-marker" />
                <div className="shift-topline">
                  <div>
                    <div className="shift-date">{start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div className="shift-hours">{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} <span>to</span> {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <span className={`risk-pill ${risk}`}>{shift.risk?.level || "LOW"} risk</span>
                </div>

                <div className="shift-body">
                  <div className="shift-column shift-column-header">
                    <h5><CheckCircle2 size={15} /> Supervisor actions</h5>
                  </div>
                  <div className="shift-column shift-column-header">
                    <h5><AlertTriangle size={15} /> Operations & warnings</h5>
                  </div>
                  <div className="shift-paired-rows">
                    {Array.from({ length: rowCount }, (_, rowIndex) => {
                      const action = actions[rowIndex];
                      const rightItem = rightItems[rowIndex];
                      return <div className="paired-row" key={`${idx}-${rowIndex}`}>
                        <div className="paired-cell">
                          {action ? <div className="action-row">
                            <div className="action-copy"><span className={`priority-tag ${action.priority === 'P0' ? 'p0' : 'p1'}`}>{action.priority}</span><span>{action.description}</span><small>Due {new Date(action.due_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small></div>
                            <button className="mini-button">Review</button>
                          </div> : <div className="empty-row">No supervisor action required.</div>}
                        </div>
                        <div className="paired-cell">
                          {rightItem ? (rightItem.type === "warning" ? <div className="warning-row"><span>{rightItem.label}</span><strong>{rightItem.value}</strong></div> : <div className="operation-row"><span><strong>{rightItem.label}</strong></span><small>{rightItem.value}</small></div>) : <div className="empty-row">No major operations scheduled.</div>}
                        </div>
                      </div>;
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const fetchHotspots = async () => {
  const response = await fetch(`${API_BASE}/hotspots/all`);
  if (!response.ok) throw new Error("Hotspot API unavailable");
  return response.json();
};

const Heatmap = () => {
  const [predictions, setPredictions] = useState(null);
  const [selectedPortId, setSelectedPortId] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadHotspots = async () => {
    setRefreshing(true);
    setError("");
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

  if (!predictions && !error) return <div className="plan-loading">Loading congestion forecast...</div>;
  if (error) return <div className="heatmap-error glass-card"><AlertTriangle size={20} /><div><strong>Forecast unavailable</strong><p>{error}. Start the API and refresh this view.</p></div><button className="btn btn-secondary" onClick={loadHotspots}>Retry</button></div>;
  if (!predictions.length) return <div className="heatmap-empty glass-card"><CheckCircle2 size={22} /><p>No congestion predictions are available for this forecast window.</p><button className="btn btn-secondary" onClick={loadHotspots}>Refresh forecast</button></div>;

  const prediction = [...predictions].sort((left, right) => right.congestion_probability - left.congestion_probability)[0];
  const probability = Math.round((prediction.congestion_probability || 0) * 100);
  const risk = String(prediction.risk_level || "LOW").toLowerCase();
  const hotspots = predictions.filter(port => port.risk_level === "HIGH");
  const forecastStart = new Date(prediction.forecast_start);
  const forecastEnd = new Date(prediction.forecast_end);
  const highRiskCount = predictions.filter(item => item.risk_level === "HIGH").length;
  const mediumRiskCount = predictions.filter(item => item.risk_level === "MEDIUM").length;
  const selectedPort = predictions.find(port => port.port_id === selectedPortId) || prediction;

  return (
    <div className="heatmap-page animate-fade-in">
      <header className="operations-header">
        <div className="page-heading">
          <p className="eyebrow">Feature 1 / predictive capacity signal</p>
          <h2>Congestion Heatmap</h2>
          <p className="page-subtitle">See where vessel demand is likely to push the port beyond its available operating capacity.</p>
        </div>
        <button className="btn btn-primary" onClick={loadHotspots} disabled={refreshing}>
          <RotateCcw size={16} className={refreshing ? "spin" : ""} /> {refreshing ? "Refreshing" : "Refresh forecast"}
        </button>
      </header>

      <section className="heatmap-top-grid">
        <div className="heatmap-risk-card glass-card">
          <div className="section-kicker"><Gauge size={16} /> Network forecast</div>
          <div className="heatmap-risk-main">
            <div className={`probability-ring ${risk}`}><strong>{probability}%</strong><span>risk</span></div>
            <div><h3>{hotspots.length} high-risk ports</h3><p>Highest predicted pressure: {prediction.port_name}</p><span className={`risk-pill ${risk}`}>{prediction.risk_level} risk · {probability}%</span></div>
          </div>
          <div className="forecast-window"><span>Forecast window</span><strong>{forecastStart.toLocaleDateString()} · {forecastStart.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} — {forecastEnd.toLocaleDateString()} · {forecastEnd.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</strong></div>
        </div>
        <div className="heatmap-explainer glass-card">
          <div className="section-kicker"><Info size={16} /> How to read this</div>
          <p>Every port is scored by the Feature 1 model. Higher probability means incoming demand is more likely to exceed available berth capacity in the latest historical forecast day.</p>
          <div className="heat-legend"><span><i className="legend-hot" /> High pressure</span><span><i className="legend-warm" /> Watch</span><span><i className="legend-cool" /> Normal</span></div>
          <div className="heatmap-counts"><strong>{highRiskCount}</strong> high <strong>{mediumRiskCount}</strong> watch</div>
        </div>
      </section>

      <section className="heatmap-board glass-card">
        <div className="heatmap-board-heading"><div><div className="section-kicker"><AlertTriangle size={16} /> Predicted pressure zones</div><h3>Port congestion heatmap</h3></div><span className="timeline-count">Click a port cell for details</span></div>
        <div className="heatmap-detail">
          <div className="heatmap-detail-heading"><div><span className="section-kicker">Selected port</span><h3>{selectedPort.port_name}</h3></div><span className={`risk-pill ${String(selectedPort.risk_level).toLowerCase()}`}>{selectedPort.risk_level} · {Math.round(selectedPort.congestion_probability * 100)}%</span></div>
          <div className="heatmap-detail-meta">Port ID {selectedPort.port_id} · Forecast date {new Date(selectedPort.forecast_start).toLocaleDateString()}</div>
          <div className="hotspot-reasons">{(selectedPort.predicted_hotspots?.[0]?.reasons || ["No elevated indicators"]).map(reason => <span key={reason}>{reason}</span>)}</div>
        </div>
        <div className="heatmap-grid" role="grid" aria-label="Port congestion heatmap">
          {predictions.map(port => {
            const score = Math.round((port.congestion_probability || 0) * 100);
            const level = String(port.risk_level || "LOW").toLowerCase();
            return <button key={port.port_id} className={`heatmap-cell ${level} ${selectedPort.port_id === port.port_id ? "selected" : ""}`} onClick={() => setSelectedPortId(port.port_id)} title={`${port.port_name}: ${score}% ${level} risk`}>
              <span>P{port.port_id}</span><strong>{score}</strong>
            </button>;
          })}
        </div>
      </section>
    </div>
  );
};

const fetchBerthAssignments = async () => {
  const response = await fetch(`${API_BASE}/optimize-berths?port_id=1`, { method: "POST" });
  if (!response.ok) throw new Error("Berth optimizer unavailable");
  return response.json();
};

const BerthAssignments = () => {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadAssignments = async () => {
    setRefreshing(true);
    setError("");
    try {
      setResult(await fetchBerthAssignments());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAssignments(); }, []);

  if (!result && !error) return <div className="plan-loading">Running berth and crane optimizer...</div>;
  if (error) return <div className="assignment-error glass-card"><AlertTriangle size={20} /><div><strong>Optimizer unavailable</strong><p>{error}. Start the API and try again.</p></div><button className="btn btn-secondary" onClick={loadAssignments}>Retry</button></div>;

  const assignments = result.assignments || [];
  const totalWait = Math.round(result.objective?.total_wait_minutes || 0);
  const averageWait = assignments.length ? Math.round(assignments.reduce((sum, item) => sum + item.estimated_wait_minutes, 0) / assignments.length) : 0;
  const waitingCount = assignments.filter(item => item.estimated_wait_minutes > 0).length;

  return (
    <div className="assignments-page animate-fade-in">
      <header className="operations-header">
        <div className="page-heading">
          <p className="eyebrow">Feature 2 / resource allocation</p>
          <h2>Berth Assignments</h2>
          <p className="page-subtitle">A live view of vessel-to-berth and quay-crane assignments produced by the optimizer.</p>
        </div>
        <button className="btn btn-primary" onClick={loadAssignments} disabled={refreshing}>
          <RotateCcw size={16} className={refreshing ? "spin" : ""} /> {refreshing ? "Optimizing" : "Run optimizer"}
        </button>
      </header>

      <section className="assignment-stats">
        <div className="assignment-stat glass-card"><span>Optimizer status</span><strong className="stat-success">{result.status}</strong><small>{result.constraints_satisfied ? "All constraints satisfied" : "Review constraint violations"}</small></div>
        <div className="assignment-stat glass-card"><span>Vessels scheduled</span><strong>{assignments.length}</strong><small>Port 1 assignment preview</small></div>
        <div className="assignment-stat glass-card"><span>Total waiting</span><strong>{totalWait}<em> min</em></strong><small>{waitingCount} vessels delayed</small></div>
        <div className="assignment-stat glass-card"><span>Avg wait / vessel</span><strong>{averageWait}<em> min</em></strong><small>From ETA to service start</small></div>
      </section>

      <section className="assignment-table-card glass-card">
        <div className="assignment-table-heading"><div><div className="section-kicker"><Anchor size={16} /> Assignment register</div><h3>Vessel resource schedule</h3></div><span className="timeline-count">Run {result.optimization_run_id}</span></div>
        {assignments.length ? <div className="assignment-table-wrap"><table className="assignment-table"><thead><tr><th>Vessel / call</th><th>Arrival</th><th>Assigned berth</th><th>Quay cranes</th><th>Service window</th><th>Waiting</th></tr></thead><tbody>{assignments.map(assignment => <tr key={assignment.vessel_id}>
          <td><strong>Vessel {assignment.vessel_id}</strong><small>Port 1</small></td>
          <td>{new Date(assignment.arrival_time).toLocaleString()}</td>
          <td><span className="berth-chip">{assignment.berth_id}</span></td>
          <td><div className="crane-chips">{assignment.crane_ids.map(crane => <span key={crane}>{crane}</span>)}</div></td>
          <td><span>{new Date(assignment.service_start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span><small>to {new Date(assignment.service_end).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</small></td>
          <td><span className={`wait-chip ${assignment.estimated_wait_minutes > 0 ? "delayed" : "on-time"}`}>{Math.round(assignment.estimated_wait_minutes)} min</span></td>
        </tr>)}</tbody></table></div> : <div className="assignment-empty"><CheckCircle2 size={22} /><p>No assignments returned for this port.</p></div>}
      </section>
    </div>
  );
};

// ── Regional Diversion Advisory — Diversion Command Center ─────────────────
// Data derived from data/feature3/alternate_routes.csv + F1 congestion outputs
const DIVERSION_DATA = {
  1: {
    port_id: 1, port_name: "Port-of-Spain", country: "Trinidad & Tobago",
    congestion_pct: 91, expected_wait_hrs: 6.4, affected_vessels: 15,
    alternatives: [
      { rank: 1, port_id: 98,  port_name: "Chaguaramas",    country: "Trinidad & Tobago",     congestion_pct: 34, extra_transit_days: 0.5, delay_avoided_days: 4.8, net_benefit_days: 4.3, available_berths: 38, viability_score: 3024.0,  decision: "BEST",     diversion_type: "NEARBY",    distance_km: 18  },
      { rank: 2, port_id: 73,  port_name: "Point Lisas",    country: "Trinidad & Tobago",     congestion_pct: 51, extra_transit_days: 1.2, delay_avoided_days: 3.1, net_benefit_days: 1.9, available_berths: 31, viability_score: 2152.5,  decision: "CONSIDER", diversion_type: "NEARBY",    distance_km: 32  },
      { rank: 3, port_id: 38,  port_name: "Scarborough",    country: "Trinidad & Tobago",     congestion_pct: 22, extra_transit_days: 2.8, delay_avoided_days: 4.5, net_benefit_days: 1.7, available_berths: 1,  viability_score: 1731.4,  decision: "LIMITED",  diversion_type: "EMERGENCY", distance_km: 110 },
    ],
  },
  4: {
    port_id: 4, port_name: "Spanish Town", country: "British Virgin Islands",
    congestion_pct: 87, expected_wait_hrs: 5.8, affected_vessels: 12,
    alternatives: [
      { rank: 1, port_id: 52,  port_name: "Road Town",      country: "British Virgin Islands", congestion_pct: 38, extra_transit_days: 0.3, delay_avoided_days: 4.2, net_benefit_days: 3.9, available_berths: 8,  viability_score: 11550.6, decision: "BEST",     diversion_type: "NEARBY",    distance_km: 24  },
      { rank: 2, port_id: 76,  port_name: "St Thomas",      country: "US Virgin Islands",      congestion_pct: 45, extra_transit_days: 0.8, delay_avoided_days: 3.5, net_benefit_days: 2.7, available_berths: 18, viability_score: 753.2,   decision: "CONSIDER", diversion_type: "NEARBY",    distance_km: 55  },
      { rank: 3, port_id: 31,  port_name: "Philipsburg",    country: "Sint Maarten",           congestion_pct: 28, extra_transit_days: 1.5, delay_avoided_days: 3.8, net_benefit_days: 2.3, available_berths: 11, viability_score: 50.4,    decision: "LIMITED",  diversion_type: "EMERGENCY", distance_km: 220 },
    ],
  },
  5: {
    port_id: 5, port_name: "Fort-de-France", country: "Martinique",
    congestion_pct: 84, expected_wait_hrs: 5.2, affected_vessels: 11,
    alternatives: [
      { rank: 1, port_id: 79,  port_name: "Pointe-a-Pitre", country: "Guadeloupe",            congestion_pct: 41, extra_transit_days: 0.6, delay_avoided_days: 3.9, net_benefit_days: 3.3, available_berths: 20, viability_score: 1971.0,  decision: "BEST",     diversion_type: "NEARBY",    distance_km: 165 },
      { rank: 2, port_id: 35,  port_name: "Castries",       country: "Saint Lucia",           congestion_pct: 55, extra_transit_days: 1.0, delay_avoided_days: 2.8, net_benefit_days: 1.8, available_berths: 3,  viability_score: 877.5,   decision: "CONSIDER", diversion_type: "NEARBY",    distance_km: 82  },
      { rank: 3, port_id: 69,  port_name: "Roseau",         country: "Dominica",              congestion_pct: 26, extra_transit_days: 1.8, delay_avoided_days: 3.7, net_benefit_days: 1.9, available_berths: 1,  viability_score: 473.0,   decision: "LIMITED",  diversion_type: "EMERGENCY", distance_km: 120 },
    ],
  },
  35: {
    port_id: 35, port_name: "Castries", country: "Saint Lucia",
    congestion_pct: 78, expected_wait_hrs: 4.8, affected_vessels: 9,
    alternatives: [
      { rank: 1, port_id: 5,   port_name: "Fort-de-France", country: "Martinique",            congestion_pct: 42, extra_transit_days: 0.7, delay_avoided_days: 3.2, net_benefit_days: 2.5, available_berths: 12, viability_score: 1485.0,  decision: "BEST",     diversion_type: "NEARBY",    distance_km: 82  },
      { rank: 2, port_id: 110, port_name: "Bridgetown",     country: "Barbados",              congestion_pct: 38, extra_transit_days: 1.2, delay_avoided_days: 3.0, net_benefit_days: 1.8, available_berths: 6,  viability_score: 659.2,   decision: "CONSIDER", diversion_type: "NEARBY",    distance_km: 175 },
      { rank: 3, port_id: 79,  port_name: "Pointe-a-Pitre", country: "Guadeloupe",           congestion_pct: 35, extra_transit_days: 1.8, delay_avoided_days: 3.5, net_benefit_days: 1.7, available_berths: 20, viability_score: 354.0,   decision: "LIMITED",  diversion_type: "NEARBY",    distance_km: 165 },
    ],
  },
  52: {
    port_id: 52, port_name: "Road Town", country: "British Virgin Islands",
    congestion_pct: 82, expected_wait_hrs: 5.5, affected_vessels: 13,
    alternatives: [
      { rank: 1, port_id: 4,   port_name: "Spanish Town",   country: "British Virgin Islands", congestion_pct: 43, extra_transit_days: 0.4, delay_avoided_days: 3.8, net_benefit_days: 3.4, available_berths: 4,  viability_score: 8983.8,  decision: "BEST",     diversion_type: "NEARBY",    distance_km: 24  },
      { rank: 2, port_id: 76,  port_name: "St Thomas",      country: "US Virgin Islands",      congestion_pct: 45, extra_transit_days: 0.6, delay_avoided_days: 3.5, net_benefit_days: 2.9, available_berths: 18, viability_score: 8229.2,  decision: "CONSIDER", diversion_type: "NEARBY",    distance_km: 40  },
      { rank: 3, port_id: 200, port_name: "San Juan",       country: "Puerto Rico",            congestion_pct: 32, extra_transit_days: 1.4, delay_avoided_days: 3.8, net_benefit_days: 2.4, available_berths: 22, viability_score: 1328.0,  decision: "CONSIDER", diversion_type: "NEARBY",    distance_km: 145 },
    ],
  },
};

const PORT_IDS = [
  { id: 1,  name: "Port-of-Spain"  },
  { id: 4,  name: "Spanish Town"   },
  { id: 5,  name: "Fort-de-France" },
  { id: 35, name: "Castries"       },
  { id: 52, name: "Road Town"      },
];

const DECISION_META = {
  BEST:     { label: "🟢 Best",      cls: "dc-best"    },
  CONSIDER: { label: "🟡 Consider",  cls: "dc-consider" },
  LIMITED:  { label: "🟠 Limited",   cls: "dc-limited"  },
};

// Bob-style 2-sentence explanation keyed by portId (cached, not live)
const BOB_EXPLANATIONS = {
  1:  "Chaguaramas is recommended because its 34% congestion level is significantly lower than Port-of-Spain's 91%, and the 0.5-day transit penalty is far outweighed by 4.8 days of expected wait avoided. The diversion is estimated to deliver a net benefit of 4.3 days of delay reduction per vessel.",
  4:  "Road Town is recommended as the primary diversion from Spanish Town due to its extremely high route connectivity score (11,550) and a congestion rate of only 38% compared to the origin's 87%. The minimal 0.3-day transit addition yields an estimated 3.9-day net benefit per diverted vessel.",
  5:  "Pointe-a-Pitre is the preferred diversion from Fort-de-France with a congestion level of 41% versus the origin's 84%, and strong inter-island connectivity with 20 available berths. An estimated 3.3-day net delay benefit is expected despite the 0.6-day additional transit.",
  35: "Fort-de-France offers the strongest diversion option from Castries with 12 available berths, 42% congestion, and high regional traffic volume. The estimated 2.5-day net benefit per vessel makes it the clearly preferred alternative over the current 78% congestion at origin.",
  52: "Spanish Town is the top diversion candidate from Road Town due to its very high viability score (8,983) and 43% congestion versus the origin's 82%. The short 0.4-day transit addition is expected to yield a 3.4-day net delay benefit per vessel.",
};

const AlternateRoutes = () => {
  const [portId,    setPortId]    = useState(PORT_IDS[0].id);
  const [loading,   setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [issued,    setIssued]    = useState(false);

  const origin = DIVERSION_DATA[portId] || DIVERSION_DATA[1];
  const winner = origin.alternatives[0];
  const bobText = BOB_EXPLANATIONS[portId] || BOB_EXPLANATIONS[1];

  const simulate = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  };
  useEffect(() => { simulate(); }, [portId]);

  const handleIssue = () => { setShowModal(false); setIssued(true); setTimeout(() => setIssued(false), 4000); };

  return (
    <div className="diversion-page animate-fade-in">

      {/* ── STORY BAR ── */}
      <div className="story-bar">
        <div className="story-step active"><span className="story-icon">🚨</span><span>Problem</span></div>
        <div className="story-arrow">→</div>
        <div className="story-step active"><span className="story-icon">🔎</span><span>Analyse</span></div>
        <div className="story-arrow">→</div>
        <div className="story-step active story-step-winner"><span className="story-icon">⭐</span><span>Recommend</span></div>
        <div className="story-arrow">→</div>
        <div className="story-step active"><span className="story-icon">💰</span><span>Impact</span></div>
      </div>

      {/* ── HEADER ── */}
      <header className="operations-header dc-header">
        <div className="page-heading">
          <p className="eyebrow">Feature 3 / Regional Diversion Advisory</p>
          <h2>Diversion Command Center</h2>
          <p className="page-subtitle">
            One congested port. Three alternatives. Real-time diversion recommendation and delay savings.
          </p>
        </div>
        <div className="header-actions">
          <div className="dc-port-selector">
            <label><MapPin size={12} /> Congested origin</label>
            <select value={portId} onChange={e => setPortId(Number(e.target.value))} className="routing-select">
              {PORT_IDS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary dc-recalc-btn" onClick={simulate} disabled={loading}>
            <RotateCcw size={15} className={loading ? "spin" : ""} />
            {loading ? "Analysing…" : "Recalculate"}
          </button>
        </div>
      </header>

      {/* ── MAIN DECISION GRID: Origin (RED) | Winner (GREEN) ── */}
      <div className="dc-decision-grid">

        {/* Origin — congested */}
        <div className="dc-origin glass-card">
          <div className="dc-panel-header-row">
            <div>
              <div className="dc-panel-kicker danger"><AlertTriangle size={12} /> Congested Origin</div>
              <div className="dc-panel-title">{origin.port_name}</div>
              <div className="dc-panel-sub">{origin.country}</div>
            </div>
            <div className="dc-big-ring danger">
              <strong>{origin.congestion_pct}%</strong>
              <span>congestion</span>
            </div>
          </div>

          <div className="dc-origin-stats">
            <div className="dc-stat-box">
              <span>Expected wait</span>
              <strong className="danger-text">{origin.expected_wait_hrs} hrs</strong>
            </div>
            <div className="dc-stat-box">
              <span>Vessels affected</span>
              <strong>{origin.affected_vessels}</strong>
            </div>
            <div className="dc-stat-box">
              <span>Risk level</span>
              <span className="risk-pill high">HIGH</span>
            </div>
          </div>

          <div className="dc-origin-footer">
            <AlertTriangle size={12} /> Diversion advisory active — action required
          </div>
        </div>

        {/* Divider arrow */}
        <div className="dc-arrow-col">
          <div className="dc-flow-arrow">
            <span className="dc-flow-line" />
            <ArrowRight size={20} className="dc-arrow-icon" />
          </div>
          <div className="dc-vs-badge">DIVERT TO</div>
        </div>

        {/* Winner — recommended */}
        <div className="dc-winner glass-card">
          <div className="dc-panel-header-row">
            <div>
              <div className="dc-panel-kicker winner"><Star size={12} /> Recommended Diversion</div>
              <div className="dc-panel-title">{winner.port_name}</div>
              <div className="dc-panel-sub">{winner.country} · {winner.distance_km} km away</div>
            </div>
            <div className="dc-big-ring winner">
              <strong>{winner.congestion_pct}%</strong>
              <span>congestion</span>
            </div>
          </div>

          <div className="dc-winner-grid">
            <div className="dc-mini-stat">
              <span>Origin Congestion</span>
              <strong className="danger-text">{origin.congestion_pct}%</strong>
            </div>
            <div className="dc-mini-stat">
              <span>Extra Transit</span>
              <strong>+{winner.extra_transit_days}d</strong>
            </div>
            <div className="dc-mini-stat">
              <span>Alternate Congestion</span>
              <strong className="winner-text">{winner.congestion_pct}%</strong>
            </div>
            <div className="dc-mini-stat">
              <span>Delay Avoided</span>
              <strong className="winner-text">−{winner.delay_avoided_days}d</strong>
            </div>
            <div className="dc-mini-stat net-stat">
              <span>Net Benefit</span>
              <strong className="winner-text net-num">+{winner.net_benefit_days}d</strong>
            </div>
          </div>

          <button
            id="issue-diversion-btn"
            className="btn dc-issue-btn"
            onClick={() => setShowModal(true)}
          >
            <Navigation size={14} />
            Issue Fleet Diversion Advisory →
          </button>
        </div>
      </div>

      {/* ── IMPACT CARDS ── */}
      <div className="dc-impact-row">
        <div className="dc-impact-card glass-card">
          <div className="section-kicker"><TrendingUp size={12} /> Delay reduction</div>
          <div className="dc-impact-num winner-text">{winner.net_benefit_days}d</div>
          <div className="dc-impact-label">delay avoided per vessel</div>
        </div>
        <div className="dc-impact-card glass-card">
          <div className="section-kicker"><Ship size={12} /> Vessels</div>
          <div className="dc-impact-num" style={{ color: "#60a5fa" }}>{origin.affected_vessels}</div>
          <div className="dc-impact-label">vessels redirected</div>
        </div>
        <div className="dc-impact-card glass-card">
          <div className="section-kicker"><Gauge size={12} /> Exposure</div>
          <div className="dc-impact-num" style={{ color: "#f59e0b" }}>
            {(winner.net_benefit_days * origin.affected_vessels).toFixed(0)}d
          </div>
          <div className="dc-impact-label">total vessel-days saved</div>
        </div>
        <div className="dc-impact-card glass-card">
          <div className="section-kicker"><Anchor size={12} /> Capacity</div>
          <div className="dc-impact-num" style={{ color: "#a78bfa" }}>{winner.available_berths}</div>
          <div className="dc-impact-label">berths at {winner.port_name}</div>
        </div>
      </div>

      {/* ── BOB AI EXPLANATION ── */}
      <div className="dc-bob glass-card">
        <div className="dc-bob-header">
          <div className="section-kicker"><Info size={13} /> IBM Bob · Regional Diversion Advisory</div>
          <span className="dc-bob-badge">AI · Cached · No live API call</span>
        </div>
        <p className="dc-bob-text">"{bobText}"</p>
        <div className="dc-bob-footer">
          <span>Explanation generated from Python-computed metrics only — Bob does not calculate numbers.</span>
        </div>
      </div>

      {/* ── COMPARE ALTERNATIVES TABLE ── */}
      <div className="dc-compare glass-card">
        <div className="dc-compare-header">
          <div><div className="section-kicker"><Filter size={13} /> Compare alternatives</div><h3>All diversion candidates vs. origin</h3></div>
          <span className="timeline-count">Ranked by net benefit</span>
        </div>
        <div className="dc-table-wrap">
          <table className="dc-table">
            <thead>
              <tr>
                <th>Port</th>
                <th>Congestion</th>
                <th>Extra transit</th>
                <th>Delay avoided</th>
                <th>Net benefit</th>
                <th>Berths</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {origin.alternatives.map(alt => (
                <tr key={alt.port_id} className={alt.decision === "BEST" ? "dc-row-best" : ""}>
                  <td>
                    <div className="dc-port-cell">
                      <strong>{alt.port_name}</strong>
                      <small>{alt.country}</small>
                    </div>
                  </td>
                  <td><span className={`dc-pct ${alt.congestion_pct >= 70 ? "danger-text" : alt.congestion_pct >= 50 ? "warn-text" : "winner-text"}`}>{alt.congestion_pct}%</span></td>
                  <td>+{alt.extra_transit_days}d</td>
                  <td className="winner-text">−{alt.delay_avoided_days}d</td>
                  <td><strong className="winner-text">+{alt.net_benefit_days}d</strong></td>
                  <td>{alt.available_berths}</td>
                  <td><span className={`dc-decision-chip ${DECISION_META[alt.decision]?.cls}`}>{DECISION_META[alt.decision]?.label}</span></td>
                </tr>
              ))}
              {/* Origin row — always last, red */}
              <tr className="dc-row-origin">
                <td>
                  <div className="dc-port-cell">
                    <strong>{origin.port_name}</strong>
                    <small>Current origin · congested</small>
                  </div>
                </td>
                <td><span className="danger-text dc-pct">{origin.congestion_pct}%</span></td>
                <td>—</td>
                <td className="danger-text">−{origin.expected_wait_hrs}h wait</td>
                <td>—</td>
                <td>—</td>
                <td><span className="dc-decision-chip dc-congested">🔴 Congested</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ISSUED TOAST ── */}
      {issued && (
        <div className="dc-toast">
          <CheckCircle2 size={18} /> Diversion advisory issued — {winner.port_name} designated as primary alternate
        </div>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="dc-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="dc-modal glass-card" onClick={e => e.stopPropagation()}>
            <div className="dc-modal-header">
              <Navigation size={22} className="winner-text" />
              <h3>Issue Fleet Diversion Advisory</h3>
            </div>
            <p className="dc-modal-sub">
              This will designate <strong>{winner.port_name}</strong> as the primary
              alternate for <strong>{origin.port_name}</strong> in the 72-hour operations plan.
            </p>
            <div className="dc-modal-summary">
              <div><span>Origin</span><strong className="danger-text">{origin.port_name} — {origin.congestion_pct}% congestion</strong></div>
              <div><span>Divert to</span><strong className="winner-text">{winner.port_name} — {winner.congestion_pct}% congestion</strong></div>
              <div><span>Net benefit</span><strong className="winner-text">+{winner.net_benefit_days} days per vessel</strong></div>
              <div><span>Vessels affected</span><strong>{origin.affected_vessels} vessels in forecast window</strong></div>
            </div>
            <div className="dc-modal-actions">
              <button className="btn dc-issue-btn" onClick={handleIssue}>
                <CheckCircle2 size={16} /> Confirm &amp; Issue Advisory
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const fetchScene = async (timestamp) => {
  const res = await fetch(`${API_BASE}/visualization/scene?port_id=1&at=${encodeURIComponent(timestamp)}`);
  if (!res.ok) throw new Error("Visualization API unavailable");
  return res.json();
};

const SCENE_TIME = "2019-01-03T12:00:00Z";

const sceneColor = (status) => ({
  CONGESTED: "#ef4444",
  HIGH_UTILIZATION: "#f59e0b",
  ASSIGNED: "#3b82f6",
  AVAILABLE: "#10b981",
  MAINTENANCE: "#64748b",
}[status] || "#64748b");

const vesselColor = (status, risk) => {
  if (status === "DEPARTED") return "#64748b";
  if (risk === "HIGH") return "#ef4444";
  if (status === "WAITING") return "#f59e0b";
  if (status === "SERVICING") return "#10b981";
  return "#38bdf8";
};

const mapIcon = (color, heading = 0, selected = false) => L.divIcon({
  className: 'ship-map-icon',
  html: `<span style="background:${color};transform:rotate(${heading}deg);${selected ? 'box-shadow:0 0 0 5px rgba(255,255,255,.45),0 0 20px ' + color : ''}"></span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const berthIcon = (color) => L.divIcon({
  className: 'berth-map-icon',
  html: `<span style="border-color:${color};box-shadow:0 0 14px ${color}"></span>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const PortReplay = () => {
  const [scene, setScene] = useState(null);
  const [hours, setHours] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null);
  const baseTime = new Date(SCENE_TIME);
  const replayTime = new Date(baseTime.getTime() + hours * 3600000);

  useEffect(() => {
    let cancelled = false;
    const timestamp = replayTime.toISOString();
    fetchScene(timestamp)
      .then((data) => { if (!cancelled) setScene(data); })
      .catch(() => { if (!cancelled) setScene(null); });
    return () => { cancelled = true; };
  }, [hours]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setHours((value) => {
        if (value >= 72) {
          setPlaying(false);
          return 0;
        }
        return value + 1;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing]);

  const chosenVessel = scene?.vessels.find((vessel) => vessel.id === selected);

  if (!scene) {
    return (
      <div className="glass-card text-muted" style={{ padding: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <RotateCcw size={20} className="spin" />
        <span>Loading digital twin schedule replay from backend…</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in replay-page">
      <div className="replay-header">
        <div>
          <h2 className="text-2xl font-bold">3D Port Operations Replay</h2>
          <p className="text-muted">Schedule-based digital twin of {scene.port.name}</p>
        </div>
        <span className={`badge ${scene.summary.overall_risk === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>
          {scene.summary.overall_risk} PORT RISK
        </span>
      </div>

      <div className="replay-stats">
        <div><strong>{scene.summary.incoming_vessels}</strong><span>approaching</span></div>
        <div><strong>{scene.summary.waiting_vessels}</strong><span>waiting</span></div>
        <div><strong>{scene.summary.servicing_vessels}</strong><span>servicing</span></div>
        <div><strong>{Math.round(scene.summary.congestion_probability * 100)}%</strong><span>peak risk</span></div>
      </div>

      <div className="replay-layout">
        <div className="replay-stage glass-panel">
          <div className="scene-legend">
            <span><i className="legend-dot incoming" /> Incoming</span>
            <span><i className="legend-dot waiting" /> Waiting</span>
            <span><i className="legend-dot service" /> Servicing</span>
            <span><i className="legend-dot danger" /> Congested berth</span>
          </div>
          <div className="map-wrapper">
            <MapContainer center={scene.port.coordinates} zoom={11} minZoom={3} maxZoom={18} scrollWheelZoom className="real-map">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CircleMarker center={scene.port.coordinates} radius={10} pathOptions={{ color: '#a78bfa', fillColor: '#7c3aed', fillOpacity: .5 }}>
                <Popup><strong>{scene.port.name}</strong><br />Port operations center</Popup>
              </CircleMarker>
              {scene.routes.map((route) => (
                <Polyline key={route.vessel_id} positions={route.map_coordinates} pathOptions={{ color: route.status === 'WAITING' ? '#f59e0b' : '#38bdf8', weight: 2, opacity: .65, dashArray: route.status === 'WAITING' ? '6 8' : '3 8' }} />
              ))}
              {scene.berths.map((berth) => (
                <Marker key={berth.id} position={[scene.port.coordinates[0] + (berth.position[1] - 50) * .012, scene.port.coordinates[1] + (berth.position[0] - 50) * .018]} icon={berthIcon(sceneColor(berth.status))}>
                  <Popup>
                    <strong>{berth.name}</strong><br />
                    Status: {berth.status}<br />
                    Risk: {Math.round(berth.congestion_probability * 100)}%<br />
                    Cranes: {berth.cranes.length}
                  </Popup>
                </Marker>
              ))}
              {scene.vessels.map((vessel) => (
                <Marker key={vessel.id} position={vessel.map_position} icon={mapIcon(vesselColor(vessel.status, vessel.risk_level), vessel.heading, selected === vessel.id)} eventHandlers={{ click: () => setSelected(vessel.id) }}>
                  <Popup>
                    <strong>Vessel {vessel.id}</strong><br />
                    Status: {vessel.status}<br />
                    Berth: {vessel.assigned_berth_id}<br />
                    Heading: {Math.round(vessel.heading)}°
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            <div className="map-overlay-label map-scale-label">REAL-WORLD SCHEDULE REPLAY</div>
            <div className="map-overlay-label map-help-label">Scroll to zoom · drag to pan · click a ship or berth</div>
          </div>
          <div className="replay-controls">
            <button className="btn btn-primary" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={16} /> : <Play size={16} />}{playing ? "Pause" : "Play"}</button>
            <button className="btn btn-secondary" onClick={() => { setHours(0); setPlaying(false); }}><RotateCcw size={16} /> Reset</button>
            <input type="range" min="0" max="72" value={hours} onChange={(event) => setHours(Number(event.target.value))} />
            <span className="timeline-time">{replayTime.toLocaleString()}</span>
          </div>
          <p className="replay-notice">{scene.notice}</p>
        </div>

        <aside className="replay-inspector glass-card">
          <h3>Live operational state</h3>
          <p className="text-muted text-small">Click a ship to inspect its movement and departure window.</p>
          {chosenVessel ? (
            <div className="ship-inspector">
              <div className="inspector-title"><span className="ship-preview" style={{ background: vesselColor(chosenVessel.status, chosenVessel.risk_level) }} />Vessel {chosenVessel.id}</div>
              <span className="badge badge-info">{chosenVessel.status}</span>
              <dl>
                <dt>Assigned berth</dt><dd>{chosenVessel.assigned_berth_id}</dd>
                <dt>Direction</dt><dd>{Math.round(chosenVessel.heading)}° heading</dd>
                <dt>ETA</dt><dd>{new Date(chosenVessel.eta).toLocaleString()}</dd>
                <dt>Service end / departure</dt><dd>{chosenVessel.service_end ? new Date(chosenVessel.service_end).toLocaleString() : "Not assigned"}</dd>
                <dt>Waiting time</dt><dd>{chosenVessel.waiting_minutes} minutes</dd>
                <dt>Assigned cranes</dt><dd>{chosenVessel.assigned_crane_ids.join(", ") || "None"}</dd>
              </dl>
            </div>
          ) : (
            <div className="inspector-empty">Select a ship in the scene.</div>
          )}
          <div className="inspector-key">
            <strong>How to read this view</strong>
            <p>Ships move from the incoming edge to anchorage, then to a berth. Red or amber berth blocks indicate rising operational pressure. Crane dots show availability and live assignment at the replay time.</p>
          </div>
        </aside>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<OperationsPlan />} />
            <Route path="/hotspots" element={<Heatmap />} />
            <Route path="/berths" element={<BerthAssignments />} />
            <Route path="/routing" element={<AlternateRoutes />} />
            <Route path="/visualization" element={<PortReplay />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
