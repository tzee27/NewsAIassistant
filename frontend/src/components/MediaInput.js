import React, { useState, useRef } from 'react';
import { useNotifications } from '../contexts/NotificationContext';

const MediaInput = ({ onNewSubmission }) => {
  const [inputValue, setInputValue] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const { addNotification } = useNotifications();

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setIsProcessing(true);
    addNotification({
      type: 'info',
      title: 'Processing...',
      message: 'Analyzing your submission, please wait...'
    });

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Determine if it's a URL, image, or video
      const submission = {
        id: Date.now(),
        type: getSubmissionType(inputValue),
        content: inputValue,
        title: generateTitle(inputValue),
        snippet: generateSnippet(inputValue),
        classification: 'unverified', // Default to unverified
        source: extractDomain(inputValue) || 'User Submission',
        url: inputValue.startsWith('http') ? inputValue : `https://${inputValue}`,
        scrapedAt: new Date().toISOString()
      };

      onNewSubmission(submission);
      
      addNotification({
        type: 'success',
        title: 'Submission Received!',
        message: 'Your content has been added to the verification queue.'
      });

      setInputValue('');
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Submission Failed',
        message: 'There was an error processing your submission. Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getSubmissionType = (input) => {
    if (input.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
    if (input.match(/\.(mp4|avi|mov|wmv|flv|webm)$/i)) return 'video';
    if (input.startsWith('http') || input.includes('.')) return 'url';
    return 'text';
  };

  const generateTitle = (input) => {
    const type = getSubmissionType(input);
    switch (type) {
      case 'image':
        return 'Image Submission - Verification Needed';
      case 'video':
        return 'Video Submission - Verification Needed';
      case 'url':
        return `URL Analysis - ${extractDomain(input) || 'Unknown Source'}`;
      default:
        return 'Text Submission - Verification Needed';
    }
  };

  const generateSnippet = (input) => {
    const type = getSubmissionType(input);
    switch (type) {
      case 'image':
        return 'User submitted an image for fact-checking. This content requires manual verification to determine authenticity.';
      case 'video':
        return 'User submitted a video for fact-checking. This content requires manual verification to determine authenticity.';
      case 'url':
        return `User submitted a URL for analysis: ${input}. The content will be scraped and analyzed for authenticity.`;
      default:
        return `User submitted text content for verification: ${input.substring(0, 100)}${input.length > 100 ? '...' : ''}`;
    }
  };

  const extractDomain = (url) => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname;
    } catch {
      return null;
    }
  };

  const handleFileSelect = (files) => {
    const file = files[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setInputValue(fileUrl);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="media-input-container">
      <div className="media-input-header">
        <h2>Submit Content for Verification</h2>
        <p>Paste a URL, upload an image/video, or drag and drop files for fact-checking</p>
      </div>
      
      <form onSubmit={handleSubmit} className="media-input-form">
        <div 
          className={`input-area ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="input-content">
            <div className="input-icon">📎</div>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Paste URL, image, or video link here..."
              className="url-input"
              disabled={isProcessing}
            />
            <button
              type="button"
              onClick={handleFileInputClick}
              className="file-select-btn"
              disabled={isProcessing}
            >
              📁 Choose File
            </button>
          </div>
          <div className="drag-text">
            Or drag and drop files here
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          style={{ display: 'none' }}
        />
        
        <div className="input-actions">
          <button
            type="submit"
            className="submit-btn"
            disabled={!inputValue.trim() || isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Submit for Verification'}
          </button>
        </div>
      </form>
      
      <div className="supported-formats">
        <h4>Supported Formats:</h4>
        <div className="format-tags">
          <span className="format-tag">🌐 URLs</span>
          <span className="format-tag">🖼️ Images (JPG, PNG, GIF)</span>
          <span className="format-tag">🎥 Videos (MP4, AVI, MOV)</span>
          <span className="format-tag">📝 Text Content</span>
        </div>
      </div>
    </div>
  );
};

export default MediaInput;
