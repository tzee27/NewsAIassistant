import React from 'react';
import MediaInput from '../components/MediaInput';

const SubmitPage = ({ onNewSubmission }) => {
  return (
    <div className="submit-page">
      <div className="container">
        <div className="page-header">
          <h1>Submit Content for Verification</h1>
          <p>Help us fight misinformation by submitting URLs, images, or videos for fact-checking</p>
        </div>
        
        <MediaInput onNewSubmission={onNewSubmission} />
        
        <div className="submit-info">
          <div className="info-card">
            <div className="info-icon">🔍</div>
            <div className="info-content">
              <h3>How It Works</h3>
              <p>Our AI-powered system analyzes your submission and provides a verification status. All content is reviewed by our expert team.</p>
            </div>
          </div>
          
          <div className="info-card">
            <div className="info-icon">⚡</div>
            <div className="info-content">
              <h3>Quick Processing</h3>
              <p>Most submissions are processed within minutes. You'll receive notifications about the verification status.</p>
            </div>
          </div>
          
          <div className="info-card">
            <div className="info-icon">🛡️</div>
            <div className="info-content">
              <h3>Privacy Protected</h3>
              <p>Your submissions are handled securely and only used for verification purposes. We respect your privacy.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmitPage;
