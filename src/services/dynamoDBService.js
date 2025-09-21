import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Configure DynamoDB client
const client = new DynamoDBClient({
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

export const dynamoDBService = {
  // Parse the formatted results_id text to extract individual fields
  parseResultsText(text) {
    if (!text) {
      return {
        claim: '',
        status: 'UNKNOWN',
        confidence: 0,
        summary: '',
        sources: []
      };
    }

    const lines = text.split('\n');
    const result = {
      claim: '',
      status: 'UNKNOWN',
      confidence: 0,
      summary: '',
      sources: []
    };

    let currentSection = '';
    let sources = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('- Claim:')) {
        result.claim = trimmedLine.replace('- Claim:', '').trim();
      } else if (trimmedLine.startsWith('- Status:')) {
        result.status = trimmedLine.replace('- Status:', '').trim();
      } else if (trimmedLine.startsWith('- Confidence:')) {
        const confidenceStr = trimmedLine.replace('- Confidence:', '').trim();
        result.confidence = parseInt(confidenceStr) || 0;
      } else if (trimmedLine.startsWith('- Summary:')) {
        result.summary = trimmedLine.replace('- Summary:', '').trim();
      } else if (trimmedLine.startsWith('- Sources:')) {
        currentSection = 'sources';
      } else if (currentSection === 'sources' && trimmedLine.startsWith('- ')) {
        // Parse source line: "- Title(URL)"
        const sourceMatch = trimmedLine.match(/^- (.+?)\((.+?)\)$/);
        if (sourceMatch) {
          sources.push({
            title: sourceMatch[1].trim(),
            url: sourceMatch[2].trim()
          });
        }
      } else if (currentSection === 'sources' && trimmedLine && !trimmedLine.startsWith('-')) {
        // Continue summary if we're in sources section but line doesn't start with -
        if (result.summary) {
          result.summary += ' ' + trimmedLine;
        }
      }
    }

    result.sources = sources;
    return result;
  },

  // Fetch all fact-check data from DynamoDB
  async fetchFactCheckData() {
    try {
      const params = {
        TableName: process.env.REACT_APP_DYNAMODB_TABLE_NAME || 'fact-check-data',
      };

      const command = new ScanCommand(params);
      const result = await docClient.send(command);
      
      
      // Transform DynamoDB data to match the expected format
      const transformedData = result.Items?.map((item, index) => {
        // Parse the results_id field which contains formatted text
        const resultsText = item.results_id || '';
        
        // Parse the formatted text to extract individual fields
        const parsedData = this.parseResultsText(resultsText);
        
        const title = parsedData.claim || 'No title available';
        const snippet = parsedData.summary || 'No summary available';
        const status = parsedData.status || 'UNKNOWN';
        const confidence = parsedData.confidence || 0;
        const sources = parsedData.sources || [];
        const createdAt = item.createdAt || item.CreatedAt || item.timestamp || item.Timestamp || item.date || item.Date || new Date().toISOString();
        
        
        return {
          id: item.id || item.Id || item.ID || index + 1,
          title: title,
          snippet: snippet,
          classification: this.mapStatusToClassification(status),
          source: this.extractSourceFromSources(sources),
          url: this.extractFirstUrl(sources),
          scrapedAt: createdAt,
          confidence: confidence,
          sources: sources,
          claim: title,
          status: status || 'UNKNOWN',
          summary: snippet
        };
      }) || [];

      // Reverse the array to show latest items first (since DB has no time record)
      const reversedData = transformedData.reverse();

      return reversedData;
    } catch (error) {
      console.error('Error fetching data from DynamoDB:', error);
      throw error;
    }
  },

  // Map DynamoDB status to classification
  mapStatusToClassification(status) {
    if (!status) return 'unverified';
    
    const statusLower = status.toLowerCase();
    if (statusLower === 'real' || statusLower === 'true') return 'real';
    if (statusLower === 'fake' || statusLower === 'false') return 'fake';
    return 'unverified';
  },

  // Extract source name from sources array
  extractSourceFromSources(sources) {
    if (!sources) {
      return 'Unknown Source';
    }
    
    // Handle different source formats
    let sourceArray = sources;
    if (typeof sources === 'string') {
      // If sources is a string, try to parse it or use as is
      try {
        sourceArray = JSON.parse(sources);
      } catch {
        sourceArray = [sources];
      }
    }
    
    if (!Array.isArray(sourceArray) || sourceArray.length === 0) {
      return 'Unknown Source';
    }
    
    // Handle sources array format: [{title: "...", url: "..."}, ...]
    try {
      const firstSource = sourceArray[0];
      
      // If it's an object with title and url
      if (typeof firstSource === 'object' && firstSource.url) {
        const url = new URL(firstSource.url);
        return url.hostname.replace('www.', '');
      }
      
      // If it's a string URL
      if (typeof firstSource === 'string' && firstSource.includes('http')) {
        const url = new URL(firstSource);
        return url.hostname.replace('www.', '');
      }
      
      return 'Multiple Sources';
    } catch {
      return 'Multiple Sources';
    }
  },

  // Extract first URL from sources array
  extractFirstUrl(sources) {
    if (!sources) {
      return '#';
    }
    
    // Handle different source formats
    let sourceArray = sources;
    if (typeof sources === 'string') {
      try {
        sourceArray = JSON.parse(sources);
      } catch {
        sourceArray = [sources];
      }
    }
    
    if (!Array.isArray(sourceArray) || sourceArray.length === 0) {
      return '#';
    }
    
    const firstSource = sourceArray[0];
    
    // If it's an object with title and url
    if (typeof firstSource === 'object' && firstSource.url) {
      return firstSource.url;
    }
    
    // If it's a string URL
    if (typeof firstSource === 'string' && firstSource.includes('http')) {
      return firstSource;
    }
    
    return '#';
  },

  // Get data with error handling and fallback
  async getData() {
    try {
      const data = await this.fetchFactCheckData();
      return data;
    } catch (error) {
      console.error('Failed to fetch from DynamoDB, using fallback:', error);
      // Return empty array or fallback data if DynamoDB fails
      return [];
    }
  }
};
