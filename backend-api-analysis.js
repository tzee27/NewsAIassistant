// Backend API Example for Photo/Video Analysis
// This shows how your backend can pull media from S3 and analyze it

const AWS = require('aws-sdk');
const express = require('express');
const multer = require('multer');
const path = require('path');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;
const app = express();

// Middleware
app.use(express.json());

// Analysis Service (mock - replace with your actual AI/ML service)
class AnalysisService {
  async analyzeImage(imageUrl) {
    // Mock image analysis
    // Replace with your actual image analysis API (e.g., AWS Rekognition, Google Vision, etc.)
    return {
      classification: Math.random() > 0.5 ? 'real' : 'fake',
      confidence: Math.random() * 0.4 + 0.6, // 60-100% confidence
      analysis: {
        textDetection: 'Sample text detected in image',
        faceDetection: 'No faces detected',
        objectDetection: ['text', 'background'],
        metadata: {
          width: 1920,
          height: 1080,
          format: 'JPEG'
        }
      },
      timestamp: new Date().toISOString()
    };
  }

  async analyzeVideo(videoUrl) {
    // Mock video analysis
    // Replace with your actual video analysis API
    return {
      classification: Math.random() > 0.5 ? 'real' : 'fake',
      confidence: Math.random() * 0.4 + 0.6,
      analysis: {
        duration: '00:02:30',
        frameAnalysis: 'No suspicious edits detected',
        audioAnalysis: 'Natural speech patterns detected',
        metadata: {
          duration: 150,
          format: 'MP4',
          resolution: '1920x1080'
        }
      },
      timestamp: new Date().toISOString()
    };
  }
}

const analysisService = new AnalysisService();

// S3 Service for backend
class S3Service {
  async getAnalysisJobs() {
    const params = {
      Bucket: bucketName,
      Prefix: 'analysis-jobs/'
    };

    try {
      const result = await s3.listObjectsV2(params).promise();
      const jobs = [];

      for (const obj of result.Contents || []) {
        try {
          const getParams = {
            Bucket: bucketName,
            Key: obj.Key
          };
          const jobData = await s3.getObject(getParams).promise();
          const job = JSON.parse(jobData.Body.toString());
          jobs.push(job);
        } catch (error) {
          console.error('Error getting job:', obj.Key, error);
        }
      }

      return jobs;
    } catch (error) {
      console.error('Error listing analysis jobs:', error);
      throw error;
    }
  }

  async updateAnalysisStatus(mediaKey, status, analysisResult) {
    try {
      // Get current object metadata
      const headParams = {
        Bucket: bucketName,
        Key: mediaKey
      };
      
      const headResult = await s3.headObject(headParams).promise();
      const metadata = headResult.Metadata || {};
      
      // Update metadata
      const updatedMetadata = {
        ...metadata,
        'analysis-status': status,
        'analysis-timestamp': new Date().toISOString()
      };
      
      if (analysisResult) {
        updatedMetadata['analysis-result'] = JSON.stringify(analysisResult);
      }
      
      // Copy object with updated metadata
      const copyParams = {
        Bucket: bucketName,
        CopySource: `${bucketName}/${mediaKey}`,
        Key: mediaKey,
        Metadata: updatedMetadata,
        MetadataDirective: 'REPLACE'
      };
      
      await s3.copyObject(copyParams).promise();
      console.log('Analysis status updated:', status);
      return true;
    } catch (error) {
      console.error('Error updating analysis status:', error);
      throw error;
    }
  }

  async getMediaFile(mediaKey) {
    const params = {
      Bucket: bucketName,
      Key: mediaKey
    };

    try {
      const result = await s3.getObject(params).promise();
      return result;
    } catch (error) {
      console.error('Error getting media file:', error);
      throw error;
    }
  }
}

const s3Service = new S3Service();

// API Routes

// Get pending analysis jobs
app.get('/api/analysis/jobs', async (req, res) => {
  try {
    const jobs = await s3Service.getAnalysisJobs();
    const pendingJobs = jobs.filter(job => job.status === 'pending');
    res.json(pendingJobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get analysis jobs' });
  }
});

// Process a specific analysis job
app.post('/api/analysis/process/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobs = await s3Service.getAnalysisJobs();
    const job = jobs.find(j => j.id === jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Update job status to processing
    await s3Service.updateAnalysisStatus(job.mediaKey, 'processing');

    let analysisResult;
    
    // Determine media type and analyze
    if (job.mediaKey.includes('.jpg') || job.mediaKey.includes('.jpeg') || 
        job.mediaKey.includes('.png') || job.mediaKey.includes('.gif')) {
      analysisResult = await analysisService.analyzeImage(job.mediaUrl);
    } else if (job.mediaKey.includes('.mp4') || job.mediaKey.includes('.avi') || 
               job.mediaKey.includes('.mov')) {
      analysisResult = await analysisService.analyzeVideo(job.mediaUrl);
    } else {
      throw new Error('Unsupported media type');
    }

    // Update analysis status with results
    await s3Service.updateAnalysisStatus(job.mediaKey, 'completed', analysisResult);

    res.json({
      success: true,
      jobId: jobId,
      analysisResult: analysisResult
    });

  } catch (error) {
    console.error('Analysis processing error:', error);
    
    // Update status to failed
    try {
      const jobs = await s3Service.getAnalysisJobs();
      const job = jobs.find(j => j.id === req.params.jobId);
      if (job) {
        await s3Service.updateAnalysisStatus(job.mediaKey, 'failed');
      }
    } catch (updateError) {
      console.error('Error updating failed status:', updateError);
    }

    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Get analysis results
app.get('/api/analysis/results', async (req, res) => {
  try {
    const params = {
      Bucket: bucketName,
      Prefix: 'media/analysis/'
    };

    const result = await s3.listObjectsV2(params).promise();
    const analysisResults = [];
    
    for (const obj of result.Contents || []) {
      try {
        const headParams = {
          Bucket: bucketName,
          Key: obj.Key
        };
        const headResult = await s3.headObject(headParams).promise();
        const metadata = headResult.Metadata || {};
        
        analysisResults.push({
          key: obj.Key,
          lastModified: obj.LastModified,
          size: obj.Size,
          analysisStatus: metadata['analysis-status'] || 'pending',
          analysisResult: metadata['analysis-result'] ? JSON.parse(metadata['analysis-result']) : null,
          submissionId: metadata['submission-id'],
          originalFilename: metadata['original-filename']
        });
      } catch (error) {
        console.error('Error getting metadata for:', obj.Key, error);
      }
    }
    
    res.json(analysisResults);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get analysis results' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Analysis jobs: http://localhost:${PORT}/api/analysis/jobs`);
});

// Example usage:
// 1. Frontend uploads photo/video to S3
// 2. Frontend creates analysis job in S3
// 3. Backend polls for pending jobs
// 4. Backend downloads media from S3
// 5. Backend analyzes media with AI/ML service
// 6. Backend updates S3 with analysis results
// 7. Frontend displays results to user

module.exports = app;
