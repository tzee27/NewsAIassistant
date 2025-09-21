import React, { useState, useEffect } from 'react';
import './App.css';
import Navigation from './components/Navigation';
import DashboardPage from './pages/DashboardPage';
import SubmitPage from './pages/SubmitPage';
import NotificationCenter from './components/NotificationCenter';
import { mockNewsData } from './data/mockData';
import { dynamoDBService } from './services/dynamoDBService';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  const [newsData, setNewsData] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    // Load data from DynamoDB
    const loadData = async () => {
      try {
        const data = await dynamoDBService.getData();
        
        if (data && data.length > 0) {
          setNewsData(data);
        } else {
          setNewsData(mockNewsData);
        }
      } catch (error) {
        console.error('Error loading data from DynamoDB:', error);
        setNewsData(mockNewsData);
      }
    };

    loadData();
  }, []);

  const filteredNews = newsData.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'real') return item.classification === 'real';
    if (activeTab === 'fake') return item.classification === 'fake';
    if (activeTab === 'unverified') return item.classification === 'unverified';
    return true;
  });

  const handleNewSubmission = (submission) => {
    setNewsData(prev => [submission, ...prev]);
  };

  const stats = {
    total: newsData.length,
    real: newsData.filter(item => item.classification === 'real').length,
    fake: newsData.filter(item => item.classification === 'fake').length,
    unverified: newsData.filter(item => item.classification === 'unverified').length,
  };

  const renderCurrentPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage 
            newsData={filteredNews}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            stats={stats}
          />
        );
      case 'submit':
        return <SubmitPage onNewSubmission={handleNewSubmission} />;
      default:
        return (
          <DashboardPage 
            newsData={filteredNews}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            stats={stats}
          />
        );
    }
  };

  return (
    <DarkModeProvider>
      <NotificationProvider>
        <div className="App">
          <Navigation activePage={activePage} setActivePage={setActivePage} />
          <main className="main-content">
            {renderCurrentPage()}
          </main>
          <NotificationCenter />
        </div>
      </NotificationProvider>
    </DarkModeProvider>
  );
}

export default App;
