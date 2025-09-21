import React from 'react';
import NewsTabs from '../components/NewsTabs';
import NewsGrid from '../components/NewsGrid';
import ChromeExtensionCard from '../components/ChromeExtensionCard';
import TelegramBoard from '../components/TelegramBoard';

const DashboardPage = ({ newsData, activeTab, setActiveTab, stats }) => {
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
                <div className="stat-label">Pending Review</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-grid">
            <div className="dashboard-main">
              <div className="news-section">
                <NewsTabs 
                  activeTab={activeTab} 
                  setActiveTab={setActiveTab}
                  stats={stats}
                />
                <NewsGrid newsData={newsData} />
              </div>
            </div>
            
            <div className="dashboard-sidebar">
              <ChromeExtensionCard />
              <TelegramBoard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
