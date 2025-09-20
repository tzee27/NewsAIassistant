import React from 'react';
import NewsTabs from './NewsTabs';
import NewsGrid from './NewsGrid';

const Dashboard = ({ newsData, activeTab, setActiveTab, stats }) => {
  return (
    <div className="container">
      <div className="card">
        <h1 className="dashboard-title">
          Latest News Scrapes
        </h1>
        <NewsTabs 
          activeTab={activeTab} 
          setActiveTab={setActiveTab}
          stats={stats}
        />
        <NewsGrid newsData={newsData} />
      </div>
    </div>
  );
};

export default Dashboard;
