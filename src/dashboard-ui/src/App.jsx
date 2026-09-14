import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Ship, Anchor, CalendarClock, AlertTriangle, Info, CheckCircle2, Navigation, Play, Pause, RotateCcw } from 'lucide-react';
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

  useEffect(() => {
    fetchOperationsPlan().then(setData);
  }, []);

  if (!data) return <div className="p-8 text-center text-muted">Loading plan...</div>;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold mb-1">72-Hour Operations Plan</h2>
          <p className="text-muted">Generated automatically using IBM Bob & XGBoost</p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-secondary"><CalendarClock size={16}/> Historical</button>
          <button className="btn btn-primary">Refresh Plan</button>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Executive Summary */}
        <div className="glass-card col-span-8 stagger-1">
          <div className="flex items-center gap-2 mb-4">
            <Info className="text-blue-400" />
            <h3 className="text-lg">Executive Summary</h3>
          </div>
          <p className="text-lg leading-relaxed text-gray-200">
            {data.executive_summary}
          </p>
        </div>

        {/* Risk Status */}
        <div className="glass-card col-span-4 stagger-2 flex flex-col items-center justify-center text-center">
          <div className={`status-indicator w-16 h-16 mb-4 ${data.overall_risk === 'HIGH' ? 'pulsing-danger' : 'bg-green-500'}`}></div>
          <h3 className="text-xl mb-1">Overall Risk: {data.overall_risk}</h3>
          <p className="text-muted text-sm">{data.congestion_hotspots.length} active hotspots detected</p>
        </div>

        {/* Timeline View */}
        <div className="glass-card col-span-12 stagger-3 mt-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <CalendarClock className="text-blue-400" /> Chronological Timeline
            </h3>
          </div>
          
          <div className="flex flex-col gap-6 relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[rgba(255,255,255,0.1)]"></div>
            
            {data.shifts.map((shift, idx) => {
              const start = new Date(shift.time_block.start);
              const end = new Date(shift.time_block.end);
              
              return (
                <div key={idx} className="relative pl-14">
                  <div className={`absolute left-[21px] top-6 w-3 h-3 rounded-full border-2 border-[#0B1120] ${shift.risk.level === 'HIGH' ? 'bg-red-500' : shift.risk.level === 'MEDIUM' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                  
                  <div className="glass-panel p-5">
                    <div className="flex justify-between items-center mb-4 border-b border-[rgba(255,255,255,0.1)] pb-3">
                      <h4 className="text-lg font-bold text-white">
                        {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        <span className="text-muted ml-2 font-normal text-base">
                          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </h4>
                      <span className={`badge ${shift.risk.level === 'HIGH' ? 'badge-danger' : shift.risk.level === 'MEDIUM' ? 'badge-warning' : 'bg-[rgba(34,197,94,0.2)] text-green-400'}`}>
                        {shift.risk.level} RISK
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                          <CheckCircle2 size={16}/> Supervisor Actions
                        </h5>
                        {shift.supervisor_actions.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {shift.supervisor_actions.map(action => (
                              <div key={action.action_id} className="bg-[rgba(0,0,0,0.2)] rounded p-3 text-sm flex justify-between items-center">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${action.priority === 'P0' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>{action.priority}</span>
                                    <span className="text-white font-medium">{action.description}</span>
                                  </div>
                                  <div className="text-muted text-xs ml-8">Due: {new Date(action.due_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </div>
                                <button className="btn btn-primary !py-1 !px-3 text-xs">Approve</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted italic bg-[rgba(0,0,0,0.1)] p-3 rounded border border-[rgba(255,255,255,0.02)]">No critical actions required.</div>
                        )}
                      </div>
                      
                      <div>
                        <h5 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                          <AlertTriangle size={16}/> Operations & Warnings
                        </h5>
                        
                        <div className="flex flex-col gap-2">
                          {shift.risk.hotspots.map((hs, i) => (
                            <div key={`hs-${i}`} className="text-sm bg-red-500/10 text-red-300 border border-red-500/20 rounded p-2 flex justify-between items-center">
                              <span><span className="font-bold">Congestion Warning:</span> Berth {hs}</span>
                            </div>
                          ))}
                          
                          {shift.planned_operations.map((op, i) => (
                            <div key={`op-${i}`} className="text-sm bg-[rgba(0,0,0,0.2)] rounded p-2 flex justify-between items-center">
                              <span><span className="text-blue-300 font-medium">{op.vessel_id}</span> {op.action.toLowerCase()}</span>
                              <span className="text-muted">Berth {op.berth_id}</span>
                            </div>
                          ))}

                          {shift.risk.hotspots.length === 0 && shift.planned_operations.length === 0 && (
                            <div className="text-sm text-muted italic bg-[rgba(0,0,0,0.1)] p-3 rounded border border-[rgba(255,255,255,0.02)]">No major operations scheduled.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const Placeholder = ({ title }) => (
  <div className="animate-fade-in flex flex-col gap-6 h-full">
    <h2 className="text-2xl font-bold mb-1">{title}</h2>
    <div className="glass-card flex-1 flex items-center justify-center text-muted">
      <p>{title} visualizations will render here.</p>
    </div>
  </div>
);

const SCENE_TIME = "2019-01-03T12:00:00Z";

const fetchScene = async (timestamp) => {
  const res = await fetch(`${API_BASE}/visualization/scene?port_id=1&at=${encodeURIComponent(timestamp)}`);
  if (!res.ok) throw new Error("Visualization API unavailable");
  return res.json();
};

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
    return <div className="glass-card text-muted">Loading schedule replay. Start the FastAPI backend to view the scene.</div>;
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
            <Route path="/hotspots" element={<Placeholder title="Congestion Heatmap" />} />
            <Route path="/berths" element={<Placeholder title="Berth Assignments" />} />
            <Route path="/routing" element={<Placeholder title="Alternate Routes" />} />
            <Route path="/visualization" element={<PortReplay />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
