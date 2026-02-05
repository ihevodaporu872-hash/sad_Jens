import { NavLink } from 'react-router-dom';
import './TabNavigation.css';

export function TabNavigation() {
  return (
    <nav className="tab-navigation">
      <NavLink
        to="/excel"
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        Excel
      </NavLink>
      <NavLink
        to="/pdf"
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        PDF
      </NavLink>
      <NavLink
        to="/cad"
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        CAD
      </NavLink>
      <NavLink
        to="/ifc"
        className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}
      >
        IFC
      </NavLink>
    </nav>
  );
}
