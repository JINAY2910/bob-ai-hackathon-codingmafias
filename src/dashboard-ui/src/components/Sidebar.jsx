import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, Anchor, Navigation, Ship, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { path: "/", icon: <LayoutDashboard size={20} />, label: "72-Hour Plan" },
    { path: "/hotspots", icon: <AlertTriangle size={20} />, label: "Congestion Heatmap" },
    { path: "/berths", icon: <Anchor size={20} />, label: "Berth Assignments" },
    { path: "/routing", icon: <Navigation size={20} />, label: "Alternate Routes" },
    { path: "/visualization", icon: <Ship size={20} />, label: "3D Port Replay" },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <h1 className="brand flex items-center gap-2">
            <img src="/favicon.svg" alt="Logo" className="brand-icon" style={{ width: 24, height: 24 }} /> PortFlow
          </h1>
        )}
        {collapsed && <img src="/favicon.svg" alt="Logo" className="brand-icon mx-auto" style={{ width: 24, height: 24 }} />}
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar">
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      
      <nav className="nav-menu">
        {navItems.map(item => (
          <Link 
            key={item.path} 
            to={item.path} 
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            {item.icon} <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      
      {!collapsed && (
        <div style={{ marginTop: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div>Historical Simulation</div>
          <div>v2.0 • Online</div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
