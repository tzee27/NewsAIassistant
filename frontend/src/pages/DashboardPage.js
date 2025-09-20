import React from 'react';
import NewsTabs from '../components/NewsTabs';
import NewsGrid from '../components/NewsGrid';

const DashboardPage = ({ newsData, activeTab, setActiveTab, stats }) => {
  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="page-header">
          <h1>Latest News Scrapes</h1>
          <p>Monitor and manage news articles from various sources</p>
        </div>
        
        <div className="dashboard-content">
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">Total Articles</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-info">
                <div className="stat-number">{stats.real}</div>
                <div className="stat-label">Verified Real</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">❌</div>
              <div className="stat-info">
                <div className="stat-number">{stats.fake}</div>
                <div className="stat-label">Flagged Fake</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">⚠️</div>
              <div className="stat-info">
                <div className="stat-number">{stats.unverified}</div>
                <div className="stat-label">Pending Review</div>
              </div>
            </div>
          </div>
          
          <div className="news-section">
            <NewsTabs 
              activeTab={activeTab} 
              setActiveTab={setActiveTab}
              stats={stats}
            />
            <NewsGrid newsData={newsData} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
