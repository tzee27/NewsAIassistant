import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

const Header = ({ stats }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            🔍 Fake News Checker
          </div>
          <div className="header-actions">
            <button 
              className="dark-mode-toggle"
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <div className="stats">
              <div className="stat-item">
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{stats.real}</div>
                <div className="stat-label">Real</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{stats.fake}</div>
                <div className="stat-label">Fake</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{stats.unverified}</div>
                <div className="stat-label">Unverified</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
