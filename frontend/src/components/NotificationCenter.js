import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';

const NotificationCenter = () => {
  const { notifications, removeNotification, clearAllNotifications } = useNotifications();

  if (notifications.length === 0) return null;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  const getNotificationClass = (type) => {
    return `notification notification-${type}`;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="notification-center">
      <div className="notification-header">
        <h3>Notifications</h3>
        <button 
          onClick={clearAllNotifications}
          className="clear-all-btn"
          title="Clear all notifications"
        >
          Clear All
        </button>
      </div>
      
      <div className="notification-list">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={getNotificationClass(notification.type)}
            onClick={() => removeNotification(notification.id)}
          >
            <div className="notification-icon">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="notification-content">
              <div className="notification-title">
                {notification.title}
              </div>
              <div className="notification-message">
                {notification.message}
              </div>
              <div className="notification-time">
                {formatTime(notification.timestamp)}
              </div>
            </div>
            <button
              className="notification-close"
              onClick={(e) => {
                e.stopPropagation();
                removeNotification(notification.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationCenter;
