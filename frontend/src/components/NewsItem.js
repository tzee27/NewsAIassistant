import React from 'react';

const NewsItem = ({ item }) => {
  const getClassificationBadge = (classification) => {
    switch (classification) {
      case 'real':
        return <span className="badge badge-real">✅ Real</span>;
      case 'fake':
        return <span className="badge badge-fake">❌ Fake</span>;
      case 'unverified':
        return <span className="badge badge-unverified">⚠️ Unverified</span>;
      default:
        return <span className="badge badge-unverified">⚠️ Unknown</span>;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewOriginal = () => {
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="news-item">
      <div className="news-header">
        <div className="news-title">{item.title}</div>
        {getClassificationBadge(item.classification)}
      </div>
      
      <div className="news-snippet">
        {item.snippet}
      </div>
      
      <div className="news-meta">
        <span>Scraped: {formatDate(item.scrapedAt)}</span>
        <span>Source: {item.source}</span>
      </div>
      
      <div className="news-actions">
        <button 
          className="btn btn-outline" 
          onClick={handleViewOriginal}
        >
          View Original Site
        </button>
        <button className="btn btn-secondary">
          View Details
        </button>
      </div>
    </div>
  );
};

export default NewsItem;
