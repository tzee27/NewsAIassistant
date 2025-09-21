import React, { useState, useMemo } from 'react';
import NewsTabs from '../components/NewsTabs';
import NewsGrid from '../components/NewsGrid';
import ChromeExtensionCard from '../components/ChromeExtensionCard';
import TelegramCard from '../components/TelegramCard';
import TelegramBoard from '../components/TelegramBoard';

const DashboardPage = ({ newsData, activeTab, setActiveTab, stats }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter news data based on search query and active tab
  const filteredNewsData = useMemo(() => {
    let filtered = newsData;

    // Apply tab filter first
    if (activeTab === 'real') {
      filtered = filtered.filter(item => item.classification === 'real');
    } else if (activeTab === 'fake') {
      filtered = filtered.filter(item => item.classification === 'fake');
    } else if (activeTab === 'unverified') {
      filtered = filtered.filter(item => item.classification === 'unverified');
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.snippet?.toLowerCase().includes(query) ||
        item.source?.toLowerCase().includes(query) ||
        item.claim?.toLowerCase().includes(query) ||
        item.summary?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [newsData, activeTab, searchQuery]);

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="page-header">
          <h1>NewsAI Assistant</h1>
          <p>Professional fake news detection and verification platform</p>
        </div>
        
        <div className="dashboard-content">
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-icon">▣</div>
              <div className="stat-info">
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">Total Articles</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">✓</div>
              <div className="stat-info">
                <div className="stat-number">{stats.real}</div>
                <div className="stat-label">Verified Real</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">✗</div>
              <div className="stat-info">
                <div className="stat-number">{stats.fake}</div>
                <div className="stat-label">Flagged Fake</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">◐</div>
              <div className="stat-info">
                <div className="stat-number">{stats.unverified}</div>
                <div className="stat-label">Unverified</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-grid">
            <div className="dashboard-main">
              <div className="news-section">
                <div className="search-section">
                  <div className="search-bar-container">
                    <div className="search-icon">🔍</div>
                    <input
                      type="text"
                      placeholder="Search articles by title, content, or source..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="clear-search-btn"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <div className="search-results-info">
                      Found {filteredNewsData.length} result{filteredNewsData.length !== 1 ? 's' : ''} for "{searchQuery}"
                    </div>
                  )}
                </div>
                
                <NewsTabs 
                  activeTab={activeTab} 
                  setActiveTab={setActiveTab}
                  stats={stats}
                />
                <NewsGrid newsData={filteredNewsData} />
              </div>
            </div>
            
            <div className="dashboard-sidebar">
              <ChromeExtensionCard />
              <TelegramCard />
              <TelegramBoard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
