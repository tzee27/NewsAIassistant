import React from 'react';

const ChromeExtensionCard = () => {
  const handleDownload = () => {
    // Create a zip file download for the extension
    const link = document.createElement('a');
    link.href = '/fake-news-extension.zip';
    link.download = 'fake-news-extension.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="extension-card">
      <div className="extension-header">
        <div className="extension-icon">
          ■
        </div>
        <div className="extension-info">
          <h3>Browser Extension</h3>
          <p>Real-time news verification</p>
        </div>
      </div>
      
      <div className="extension-features">
        <div className="feature-item">
          <span className="feature-icon">▶</span>
          <span>Real-time detection</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">◆</span>
          <span>Privacy focused</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">●</span>
          <span>High accuracy</span>
        </div>
      </div>

      <div className="extension-actions">
        <button className="btn btn-primary extension-btn" onClick={handleDownload}>
          <span className="btn-icon">↓</span>
          Download Extension
        </button>
        <div className="extension-note">
          <small>Compatible with Chrome, Edge & Brave</small>
        </div>
      </div>
    </div>
  );
};

export default ChromeExtensionCard;