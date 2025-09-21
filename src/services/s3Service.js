import AWS from 'aws-sdk';

// Check if AWS credentials are configured
const hasCredentials = () => {
  return process.env.REACT_APP_AWS_ACCESS_KEY_ID && 
         process.env.REACT_APP_AWS_SECRET_ACCESS_KEY && 
         process.env.REACT_APP_AWS_REGION && 
         process.env.REACT_APP_S3_BUCKET_NAME;
};

// Configure AWS
if (hasCredentials()) {
  AWS.config.update({
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
    region: process.env.REACT_APP_AWS_REGION
  });
} else {
  console.warn('AWS credentials not configured. Please set up your .env file with AWS credentials.');
}

const s3 = new AWS.S3();
const bucketName = process.env.REACT_APP_S3_BUCKET_NAME;

export const s3Service = {

  // Upload news data to S3
  async uploadNewsData(data) {
    if (!hasCredentials() || !bucketName) {
      throw new Error('AWS S3 is not properly configured. Please check your environment variables.');
    }
    const params = {
      Bucket: bucketName,
      Key: 'data/news-data.json',
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json'
    };

    try {
      const result = await s3.upload(params).promise();
      console.log('News data uploaded:', result.Location);
      return result;
    } catch (error) {
      console.error('Error uploading news data:', error);
      throw error;
    }
  },

  // Retrieve news data from S3
  async getNewsData() {
    const params = {
      Bucket: bucketName,
      Key: 'data/news-data.json'
    };

    try {
      const result = await s3.getObject(params).promise();
      return JSON.parse(result.Body.toString());
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        console.log('No news data found, returning empty array');
        return [];
      }
      console.error('Error retrieving news data:', error);
      throw error;
    }
  },

  // Upload user submission
  async uploadSubmission(submission) {
    if (!hasCredentials() || !bucketName) {
      throw new Error('AWS S3 is not properly configured. Please check your environment variables.');
    }
    const timestamp = new Date().toISOString();
    const key = `submissions/${timestamp}-${submission.id}.json`;
    
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(submission, null, 2),
      ContentType: 'application/json'
    };

    try {
      const result = await s3.upload(params).promise();
      return result;
    } catch (error) {
      console.error('Error uploading submission:', error);
      throw error;
    }
  },

  // List all submissions
  async listSubmissions() {
    const params = {
      Bucket: bucketName,
      Prefix: 'submissions/'
    };

    try {
      const result = await s3.listObjectsV2(params).promise();
      return result.Contents || [];
    } catch (error) {
      console.error('Error listing submissions:', error);
      throw error;
    }
  },

  // Generate presigned URL for upload (avoids CORS issues)
  async generatePresignedUploadUrl(file, submissionId) {
    // Get file extension from name or type
    let fileExtension = 'bin';
    if (file.name && file.name.includes('.')) {
      fileExtension = file.name.split('.').pop();
    } else if (file.type) {
      // Extract extension from MIME type
      const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/avi': 'avi',
        'video/mov': 'mov',
        'video/quicktime': 'mov'
      };
      fileExtension = mimeToExt[file.type] || 'bin';
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `media/analysis/${timestamp}-${submissionId}.${fileExtension}`;
    
    const params = {
      Bucket: bucketName,
      Key: key,
      ContentType: file.type,
      Metadata: {
        'submission-id': submissionId,
        'original-filename': file.name || `upload-${submissionId}.${fileExtension}`,
        'file-size': file.size.toString(),
        'upload-timestamp': timestamp,
        'analysis-status': 'pending'
      },
      Expires: 300 // 5 minutes
    };

    try {
      const presignedUrl = await s3.getSignedUrl('putObject', params);
      console.log('Presigned URL generated for upload:', key);
      return {
        presignedUrl: presignedUrl,
        key: key,
        submissionId: submissionId,
        analysisStatus: 'pending'
      };
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw error;
    }
  },

  // Upload media file using presigned URL
  async uploadMediaFileWithPresignedUrl(file, presignedUrl) {
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      console.log('Media file uploaded successfully via presigned URL');
      return true;
    } catch (error) {
      console.error('Error uploading with presigned URL:', error);
      throw error;
    }
  },

  // Upload media file (image/video) for analysis
  async uploadMediaFile(file, submissionId) {
    try {
      // Try direct S3 upload first
      const result = await this.uploadMediaFileDirect(file, submissionId);
      return result;
    } catch (error) {
      console.log('Direct upload failed, trying proxy server...', error.message);
      // Fallback to proxy server
      return await this.uploadMediaFileViaProxy(file, submissionId);
    }
  },

  // Submit URL for analysis
  async submitUrl(url, submissionId, title, snippet, type) {
    try {
      const response = await fetch('http://localhost:3001/api/submit-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submissionId: submissionId,
          url: url,
          title: title,
          snippet: snippet,
          type: type
        })
      });

      if (!response.ok) {
        throw new Error(`URL submission failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('URL submitted via proxy:', result);
      return result;
    } catch (error) {
      console.error('Error submitting URL:', error);
      throw error;
    }
  },

  // Direct S3 upload
  async uploadMediaFileDirect(file, submissionId) {
    // Get file extension from name or type
    let fileExtension = 'bin';
    if (file.name && file.name.includes('.')) {
      fileExtension = file.name.split('.').pop();
    } else if (file.type) {
      // Extract extension from MIME type
      const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/avi': 'avi',
        'video/mov': 'mov',
        'video/quicktime': 'mov'
      };
      fileExtension = mimeToExt[file.type] || 'bin';
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `media/analysis/${timestamp}-${submissionId}.${fileExtension}`;
    
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: file,
      ContentType: file.type,
      Metadata: {
        'submission-id': submissionId,
        'original-filename': file.name || `upload-${submissionId}.${fileExtension}`,
        'file-size': file.size.toString(),
        'upload-timestamp': timestamp,
        'analysis-status': 'pending'
      }
    };

    const result = await s3.upload(params).promise();
    console.log('Media file uploaded for analysis:', result.Location);
    return {
      ...result,
      key: key,
      submissionId: submissionId,
      analysisStatus: 'pending'
    };
  },

  // Upload via proxy server (avoids CORS issues)
  async uploadMediaFileViaProxy(file, submissionId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('submissionId', submissionId);

    const response = await fetch('http://localhost:3001/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Proxy upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Media file uploaded via proxy:', result.location);
    console.log('Analysis job created via proxy');
    return {
      Location: result.location,
      key: result.key,
      submissionId: result.submissionId,
      analysisStatus: 'pending'
    };
  },

  // Get presigned URL for media file (for backend API access)
  async getPresignedUrl(key, expiration = 3600) {
    const params = {
      Bucket: bucketName,
      Key: key,
      Expires: expiration
    };

    try {
      const url = await s3.getSignedUrl('getObject', params);
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw error;
    }
  },

  // Get media file URL (public access)
  getMediaUrl(key) {
    return `https://${bucketName}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${key}`;
  },

  // Update analysis status
  async updateAnalysisStatus(key, status, analysisResult = null) {
    try {
      // Get current object metadata
      const headParams = {
        Bucket: bucketName,
        Key: key
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
        CopySource: `${bucketName}/${key}`,
        Key: key,
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
  },

  // Get analysis results
  async getAnalysisResults() {
    const params = {
      Bucket: bucketName,
      Prefix: 'media/analysis/'
    };

    try {
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
      
      return analysisResults;
    } catch (error) {
      console.error('Error getting analysis results:', error);
      throw error;
    }
  },

  // Delete submission
  async deleteSubmission(key) {
    const params = {
      Bucket: bucketName,
      Key: key
    };

    try {
      await s3.deleteObject(params).promise();
      console.log('Submission deleted:', key);
      return true;
    } catch (error) {
      console.error('Error deleting submission:', error);
      throw error;
    }
  },

  // Update news classification
  async updateNewsClassification(newsId, classification) {
    try {
      // Get current data
      const currentData = await this.getNewsData();
      
      // Update the specific news item
      const updatedData = currentData.map(item => 
        item.id === newsId 
          ? { ...item, classification, updatedAt: new Date().toISOString() }
          : item
      );
      
      // Upload updated data
      await this.uploadNewsData(updatedData);
      
      return updatedData;
    } catch (error) {
      console.error('Error updating news classification:', error);
      throw error;
    }
  },

  // Get analytics data
  async getAnalytics() {
    try {
      const newsData = await this.getNewsData();
      const submissions = await this.listSubmissions();
      const analysisResults = await this.getAnalysisResults();
      
      const analytics = {
        totalNews: newsData.length,
        realNews: newsData.filter(item => item.classification === 'real').length,
        fakeNews: newsData.filter(item => item.classification === 'fake').length,
        unverified: newsData.filter(item => item.classification === 'unverified').length,
        totalSubmissions: submissions.length,
        pendingAnalysis: analysisResults.filter(item => item.analysisStatus === 'pending').length,
        completedAnalysis: analysisResults.filter(item => item.analysisStatus === 'completed').length,
        lastUpdated: new Date().toISOString()
      };
      
      return analytics;
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  },

  // Create analysis job for backend API
  async createAnalysisJob(mediaKey, submissionId) {
    const jobData = {
      id: submissionId,
      mediaKey: mediaKey,
      mediaUrl: this.getMediaUrl(mediaKey),
      presignedUrl: await this.getPresignedUrl(mediaKey),
      status: 'pending',
      createdAt: new Date().toISOString(),
      priority: 'normal'
    };

    const params = {
      Bucket: bucketName,
      Key: `analysis-jobs/${submissionId}.json`,
      Body: JSON.stringify(jobData, null, 2),
      ContentType: 'application/json'
    };

    try {
      const result = await s3.upload(params).promise();
      console.log('Analysis job created:', result.Location);
      return result;
    } catch (error) {
      console.error('Error creating analysis job:', error);
      throw error;
    }
  }
};

