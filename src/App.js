import React, { useState, useEffect } from 'react';
import './App.css';
import Navigation from './components/Navigation';
import DashboardPage from './pages/DashboardPage';
import SubmitPage from './pages/SubmitPage';
import NotificationCenter from './components/NotificationCenter';
import { listRecent, verifyContent } from './api.js';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  const [newsData, setNewsData] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
  (async () => {
    try {
      // If you haven't built a /recent endpoint yet, temporarily skip this.
      const rows = await listRecent();
      setNewsData(rows.map(normalizeItemFromAPI));
    } catch (e) {
       console.error('Failed to load recent items:', e);
    }
    })();
  }, []);

  function mapVerdictToClassification(v) {
    const s = (v || '').toLowerCase();
    if (s === 'supported') return 'real';
    if (s === 'refuted') return 'fake';
    return 'unverified';
  }

    function normalizeItemFromAPI(x) {
    return {
      id: x.id,
      title: x.claim || x.title || '',
      source: x.source || 'Verified by Bedrock',
      url: x.url || '',
      classification: mapVerdictToClassification(x.verdict),
      confidence: x.confidence || 0,
      evidence: x.evidence || []
    };
  }

  const filteredNews = newsData.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'real') return item.classification === 'real';
    if (activeTab === 'fake') return item.classification === 'fake';
    if (activeTab === 'unverified') return item.classification === 'unverified';
    return true;
  });

const handleNewSubmission = async (submission) => {
   try {
     // submission is { url } or { text }
     const result = await verifyContent(submission);
     const normalized = normalizeItemFromAPI(result);
     // Keep your existing UI behavior:
     setNewsData(prev => [normalized, ...prev]);
     setActivePage('dashboard');
    } catch (e) {
     console.error('Verification failed:', e);
     // Optionally show a toast/notification here+
    }
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
