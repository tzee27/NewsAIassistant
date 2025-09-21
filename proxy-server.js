// Simple proxy server to handle S3 uploads and avoid CORS issues
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3001;

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  region: process.env.REACT_APP_AWS_REGION
});

const s3 = new AWS.S3();
const bucketName = process.env.REACT_APP_S3_BUCKET_NAME;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Upload endpoint for files
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { submissionId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Generate file key
    const fileExtension = file.originalname.split('.').pop() || 'bin';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `media/analysis/${timestamp}-${submissionId}.${fileExtension}`;

    // Upload to S3
    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        'submission-id': submissionId,
        'original-filename': file.originalname,
        'file-size': file.size.toString(),
        'upload-timestamp': timestamp,
        'analysis-status': 'pending'
      }
    };

    const result = await s3.upload(uploadParams).promise();

    // Create analysis job
    const jobData = {
      id: submissionId,
      mediaKey: key,
      mediaUrl: result.Location,
      status: 'pending',
      createdAt: new Date().toISOString(),
      priority: 'normal'
    };

    const jobParams = {
      Bucket: bucketName,
      Key: `analysis-jobs/${submissionId}.json`,
      Body: JSON.stringify(jobData, null, 2),
      ContentType: 'application/json'
    };

    await s3.upload(jobParams).promise();

    res.json({
      success: true,
      key: key,
      location: result.Location,
      submissionId: submissionId
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Submit URL endpoint
app.post('/api/submit-url', async (req, res) => {
  try {
    const { submissionId, url, title, snippet, type } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'No URL provided' });
    }

    // Create submission data
    const submissionData = {
      id: submissionId,
      type: type || 'url',
      content: url,
      title: title || `URL Analysis - ${new URL(url).hostname}`,
      snippet: snippet || `User submitted a URL for analysis: ${url}`,
      classification: 'unverified',
      source: new URL(url).hostname,
      url: url,
      scrapedAt: new Date().toISOString(),
      analysisStatus: 'url-only'
    };

    // Save submission to S3
    const submissionParams = {
      Bucket: bucketName,
      Key: `submissions/${submissionId}.json`,
      Body: JSON.stringify(submissionData, null, 2),
      ContentType: 'application/json'
    };

    await s3.upload(submissionParams).promise();

    // Create analysis job for URL
    const jobData = {
      id: submissionId,
      url: url,
      type: 'url',
      status: 'pending',
      createdAt: new Date().toISOString(),
      priority: 'normal'
    };

    const jobParams = {
      Bucket: bucketName,
      Key: `analysis-jobs/${submissionId}.json`,
      Body: JSON.stringify(jobData, null, 2),
      ContentType: 'application/json'
    };

    await s3.upload(jobParams).promise();

    res.json({
      success: true,
      submissionId: submissionId,
      type: 'url'
    });

  } catch (error) {
    console.error('URL submission error:', error);
    res.status(500).json({ error: 'URL submission failed' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
  console.log(`Upload endpoint: http://localhost:${port}/api/upload`);
});
