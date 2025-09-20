import React from 'react';
import NewsItem from './NewsItem';

const NewsGrid = ({ newsData }) => {
  if (newsData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📰</div>
        <div className="empty-state-title">No news articles found</div>
        <div className="empty-state-description">
          Start scraping to see news articles here
        </div>
      </div>
    );
  }

  return (
    <div className="news-grid">
      {newsData.map((item, index) => (
        <NewsItem key={index} item={item} />
      ))}
    </div>
  );
};

export default NewsGrid;
