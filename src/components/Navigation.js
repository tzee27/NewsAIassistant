import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

const Navigation = ({ activePage, setActivePage }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  const pages = [
    { id: 'dashboard', label: 'Dashboard', icon: '▣' },
    { id: 'submit', label: 'Submit Content', icon: '✎' },
  ];

  return (
    <nav className="main-navigation">
      <div className="container">
        <div className="nav-content">
          <div className="nav-logo">
            <span className="logo-icon">■</span>
            NewsAI Assistant
          </div>
          <div className="nav-actions">
            <div className="nav-tabs">
              {pages.map(page => (
                <button
                  key={page.id}
                  className={`nav-tab ${activePage === page.id ? 'active' : ''}`}
                  onClick={() => setActivePage(page.id)}
                >
                  <span className="nav-icon">{page.icon}</span>
                  <span className="nav-label">{page.label}</span>
                </button>
              ))}
            </div>
            <button 
              className="dark-mode-toggle"
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? '○' : '●'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
