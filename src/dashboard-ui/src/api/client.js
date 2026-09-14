const API_BASE = "http://localhost:8000/api/v1";

export const fetchOperationsPlan = async () => {
  const res = await fetch(`${API_BASE}/operations-plan`);
  if (!res.ok) throw new Error("Operations plan API unavailable");
  return res.json();
};

export const fetchHotspots = async () => {
  const response = await fetch(`${API_BASE}/hotspots/all`);
  if (!response.ok) throw new Error("Hotspot API unavailable");
  return response.json();
};

export const fetchBerthAssignments = async (portId = 1) => {
  const response = await fetch(`${API_BASE}/optimize-berths?port_id=${portId}`, { method: "POST" });
  if (!response.ok) throw new Error("Berth optimizer unavailable");
  return response.json();
};

export const fetchRoutingRecommendations = async (vesselId, portId) => {
  const response = await fetch(`${API_BASE}/alternate-routes?vessel_id=${encodeURIComponent(vesselId)}&port_id=${portId}`);
  if (!response.ok) throw new Error("Routing API unavailable");
  return response.json();
};

export const issueDiversionAdvisory = async (originPortId, alternatePortId, vesselId, reason) => {
  const response = await fetch(`${API_BASE}/alternate-routes/advisory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin_port_id: originPortId,
      alternate_port_id: alternatePortId,
      vessel_id: vesselId,
      reason: reason,
    }),
  });
  if (!response.ok) throw new Error("Advisory API unavailable");
  return response.json();
};

export const fetchScene = async (portId = 1, timestamp = null) => {
  const url = timestamp
    ? `${API_BASE}/visualization/scene?port_id=${portId}&at=${encodeURIComponent(timestamp)}`
    : `${API_BASE}/visualization/scene?port_id=${portId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Visualization API unavailable");
  return res.json();
};
