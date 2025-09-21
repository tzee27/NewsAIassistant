import React from 'react';

const TelegramCard = () => {
  const joinTelegram = () => {
    window.open('https://t.me/newsai_assistant', '_blank');
  };

  return (
    <div className="telegram-card">
      <div className="telegram-card-header">
        <div className="telegram-card-icon">
          ■
        </div>
        <div className="telegram-card-info">
          <h3>Telegram Channel</h3>
          <p>Real-time news alerts & updates</p>
        </div>
      </div>
      
      <div className="telegram-features">
        <div className="feature-item">
          <span className="feature-icon">▶</span>
          <span>Instant notifications</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">◆</span>
          <span>Expert analysis</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">●</span>
          <span>Community discussions</span>
        </div>
      </div>

      <div className="telegram-actions">
        <button className="btn btn-primary telegram-btn" onClick={joinTelegram}>
          <span className="btn-icon">→</span>
          Join Channel
        </button>
        <div className="telegram-note">
          <small>2,847 active members • Free to join</small>
        </div>
      </div>
    </div>
  );
};

export default TelegramCard;