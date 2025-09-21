const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  region: process.env.REACT_APP_AWS_REGION
});

const s3 = new AWS.S3();

async function deployToS3() {
  const bucketName = process.env.REACT_APP_S3_BUCKET_NAME;
  const buildDir = path.join(__dirname, 'build');

  if (!fs.existsSync(buildDir)) {
    console.error('❌ Build directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting deployment to S3...');
    console.log(`📦 Bucket: ${bucketName}`);
    console.log(`📁 Source: ${buildDir}`);

    // Upload all files from build directory
    const uploadFile = (filePath, key) => {
      const fileContent = fs.readFileSync(filePath);
      const params = {
        Bucket: bucketName,
        Key: key,
        Body: fileContent,
        ContentType: getContentType(filePath),
        CacheControl: getCacheControl(filePath)
      };
      return s3.upload(params).promise();
    };

    // Recursively upload files
    const uploadDirectory = async (dir, prefix = '') => {
      const files = fs.readdirSync(dir);
      let uploadCount = 0;
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const key = prefix + file;
        
        if (fs.statSync(filePath).isDirectory()) {
          await uploadDirectory(filePath, key + '/');
        } else {
          console.log(`📤 Uploading: ${key}`);
          await uploadFile(filePath, key);
          uploadCount++;
        }
      }
      
      return uploadCount;
    };

    const uploadCount = await uploadDirectory(buildDir);
    
    console.log('✅ Deployment successful!');
    console.log(`📊 Files uploaded: ${uploadCount}`);
    console.log(`🌐 Website URL: https://${bucketName}.s3-website-${process.env.REACT_APP_AWS_REGION}.amazonaws.com`);
    
    // Upload initial data if it doesn't exist
    await uploadInitialData();
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

async function uploadInitialData() {
  const bucketName = process.env.REACT_APP_S3_BUCKET_NAME;
  
  try {
    // Check if news data already exists
    const params = {
      Bucket: bucketName,
      Key: 'data/news-data.json'
    };
    
    try {
      await s3.headObject(params).promise();
      console.log('📄 News data already exists, skipping initial upload');
    } catch (error) {
      if (error.code === 'NotFound') {
        // Upload initial mock data
        const mockData = require('./src/data/mockData');
        const dataParams = {
          Bucket: bucketName,
          Key: 'data/news-data.json',
          Body: JSON.stringify(mockData.mockNewsData, null, 2),
          ContentType: 'application/json'
        };
        
        await s3.upload(dataParams).promise();
        console.log('📄 Initial news data uploaded');
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not upload initial data:', error.message);
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

function getCacheControl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Static assets should be cached longer
  if (['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2'].includes(ext)) {
    return 'public, max-age=31536000'; // 1 year
  }
  
  // HTML files should be cached shorter
  if (ext === '.html') {
    return 'public, max-age=0, must-revalidate';
  }
  
  return 'public, max-age=3600'; // 1 hour default
}

// Run deployment
deployToS3();

