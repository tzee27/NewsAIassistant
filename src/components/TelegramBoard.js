import React, { useState, useEffect } from 'react';

const TelegramBoard = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      user: 'System',
      message: 'Welcome to NewsAI Assistant community',
      time: '2 min ago',
      type: 'bot'
    },
    {
      id: 2,
      user: 'Alex Chen',
      message: 'Just verified 3 articles today. Excellent accuracy.',
      time: '5 min ago',
      type: 'user'
    },
    {
      id: 3,
      user: 'Sarah Kim',
      message: 'The browser extension works seamlessly',
      time: '12 min ago',
      type: 'user'
    },
    {
      id: 4,
      user: 'Alert',
      message: 'New misinformation pattern detected in tech sector',
      time: '18 min ago',
      type: 'alert'
    }
  ]);

  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        user: 'You',
        message: newMessage,
        time: 'now',
        type: 'user'
      };
      setMessages(prev => [message, ...prev]);
      setNewMessage('');
    }
  };

  const joinTelegram = () => {
    window.open('https://t.me/newsai_assistant', '_blank');
  };

  return (
    <div className="telegram-board">
      <div className="telegram-header">
        <div className="telegram-title">
          <span className="telegram-icon">■</span>
          <div>
            <h3>Community Board</h3>
            <p>2,847 active members</p>
          </div>
        </div>
        <button className="btn btn-outline telegram-join-btn" onClick={joinTelegram}>
          Join Channel
        </button>
      </div>

      <div className="telegram-messages">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-header">
              <span className="message-user">{message.user}</span>
              <span className="message-time">{message.time}</span>
            </div>
            <div className="message-content">
              {message.message}
            </div>
          </div>
        ))}
      </div>

      <form className="telegram-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="message-input"
        />
        <button type="submit" className="send-btn">
          <span>→</span>
        </button>
      </form>

      <div className="telegram-stats">
        <div className="stat-item">
          <span className="stat-icon">●</span>
          <span>2,847 members</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">○</span>
          <span>156 online</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">◆</span>
          <span>24/7 active</span>
        </div>
      </div>
    </div>
  );
};

export default TelegramBoard;