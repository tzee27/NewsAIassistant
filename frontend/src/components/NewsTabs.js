import React from 'react';

const NewsTabs = ({ activeTab, setActiveTab, stats }) => {
  const tabs = [
    { id: 'all', label: 'All News', count: stats.total },
    { id: 'real', label: 'Real News', count: stats.real },
    { id: 'fake', label: 'Fake News', count: stats.fake },
    { id: 'unverified', label: 'Unverified', count: stats.unverified },
  ];

  return (
    <div className="tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  );
};

export default NewsTabs;
