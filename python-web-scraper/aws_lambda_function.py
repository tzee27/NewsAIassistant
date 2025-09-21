#!/usr/bin/env python3
"""
AWS Lambda Function for Twitter Scraping
Deploy this file to AWS Lambda
"""

import json
import time
import re
import boto3
import os
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException

class LambdaWebScraper:
    """Web scraper optimized for AWS Lambda using Selenium - supports Twitter and news websites"""
    
    def __init__(self):
        self.driver = None
        self.dynamodb = boto3.resource('dynamodb')
        self.table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'twitter-scraped-data')
        self.verification_webhook_url = os.environ.get('VERIFICATION_WEBHOOK_URL', 'https://n8n-staging.ai-spacex.co/webhook/1f21eafb-d9eb-438c-a239-5fe4c9676078')
        
    def __enter__(self):
        """Context manager entry"""
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        if self.driver:
            self.driver.quit()
    
    def save_to_dynamodb(self, data: Dict[str, Any], url: str, verification_data: Dict[str, Any] = None) -> str:
        """Save response data to DynamoDB including verification results"""
        try:
            # Extract tweet ID from URL
            tweet_id = self._extract_tweet_id(url)
            
            # Prepare item for DynamoDB
            item = {
                'tweet_id': tweet_id,
                'scraped_at': data.get('scraped_at'),
                'url': url,
                'main_text': data.get('main_text', ''),
                'paragraphs': data.get('paragraphs', []),
                'author': data.get('author', ''),
                'timestamp': data.get('timestamp', ''),
                'page_title': data.get('page_title', ''),
                'page_type': data.get('page_type', ''),
                'images': data.get('images', []),
                'links': data.get('links', []),
                'metrics': data.get('metrics', {}),
                'scraping_method': data.get('scraping_method', ''),
                'lambda_ready': data.get('lambda_ready', False)
            }
            
            # Add verification data if provided
            if verification_data:
                item['verification_success'] = verification_data.get('verification_success', False)
                item['verification_response'] = verification_data.get('verification_response', {})
                item['verification_status_code'] = verification_data.get('verification_status_code', 0)
                item['verified_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
                
                # Add structured verification data
                structured_verification = verification_data.get('structured_verification', {})
                if structured_verification:
                    item['structured_verification'] = structured_verification
                
                # If verification_response is a dict, merge its contents into the main item
                if isinstance(item['verification_response'], dict):
                    for key, value in item['verification_response'].items():
                        if key not in item:  # Don't overwrite existing fields
                            item[f'verified_{key}'] = value
            
            # Save to DynamoDB
            table = self.dynamodb.Table(self.table_name)
            table.put_item(Item=item)
            
            print(f"Response saved to DynamoDB: tweet_id={tweet_id}")
            return tweet_id
            
        except Exception as e:
            print(f"Error saving to DynamoDB: {str(e)}")
            return None
    
    def parse_verification_response(self, verification_result: Dict[str, Any]) -> Dict[str, Any]:
        """Parse verification response into structured claims format"""
        try:
            # Extract the output text from the verification response
            output_text = verification_result.get('output', '')
            
            # Parse the structured format from the text
            claims = []
            
            # Split by claim sections
            claim_sections = output_text.split('- Claim:')
            
            for section in claim_sections[1:]:  # Skip the first empty section
                lines = section.strip().split('\n')
                
                if not lines:
                    continue
                    
                # Extract claim
                claim = lines[0].strip()
                
                # Initialize claim data
                claim_data = {
                    "claim": claim,
                    "status": "UNKNOWN",
                    "confidence": 0,
                    "summary": "",
                    "sources": []
                }
                
                # Parse other fields
                for line in lines[1:]:
                    line = line.strip()
                    if line.startswith('- Status:'):
                        claim_data["status"] = line.replace('- Status:', '').strip()
                    elif line.startswith('- Confidence:'):
                        try:
                            claim_data["confidence"] = int(line.replace('- Confidence:', '').strip())
                        except ValueError:
                            claim_data["confidence"] = 0
                    elif line.startswith('- Summary:'):
                        claim_data["summary"] = line.replace('- Summary:', '').strip()
                    elif line.startswith('- Sources:'):
                        # Extract sources from the rest of the text
                        sources_text = '\n'.join(lines[lines.index(line):])
                        sources = self.extract_sources_from_text(sources_text)
                        claim_data["sources"] = sources
                
                claims.append(claim_data)
            
            return {"claims": claims}
            
        except Exception as e:
            print(f"Error parsing verification response: {e}")
            return {"claims": []}
    
    def extract_sources_from_text(self, sources_text: str) -> List[str]:
        """Extract source names from the sources text"""
        sources = []
        try:
            # Look for source names in brackets or links
            import re
            
            # Pattern to match source names in brackets like [Source Name]
            bracket_pattern = r'\[([^\]]+)\]'
            bracket_matches = re.findall(bracket_pattern, sources_text)
            
            for match in bracket_matches:
                # Skip if it's a link (contains http)
                if 'http' not in match.lower():
                    sources.append(match)
            
            # If no bracket sources found, try to extract from links
            if not sources:
                # Pattern to match markdown links like [Source](url)
                link_pattern = r'\[([^\]]+)\]\([^)]+\)'
                link_matches = re.findall(link_pattern, sources_text)
                sources.extend(link_matches)
            
            # Remove duplicates and return
            return list(set(sources))
            
        except Exception as e:
            print(f"Error extracting sources: {e}")
            return []
    
    def verify_content(self, scraped_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send scraped data to verification API and return verification response"""
        try:
            print(f"Sending data to verification API: {self.verification_webhook_url}")
            
            # Prepare the payload for verification API
            verification_payload = {
                "author": scraped_data.get('author', ''),
                "images": scraped_data.get('images', []),
                "links": scraped_data.get('links', []),
                "main_text": scraped_data.get('main_text', ''),
                "metrics": scraped_data.get('metrics', {}),
                "page_title": scraped_data.get('page_title', ''),
                "page_type": scraped_data.get('page_type', ''),
                "paragraphs": scraped_data.get('paragraphs', []),
                "timestamp": scraped_data.get('timestamp', ''),
                "url": scraped_data.get('url', ''),
                "scraping_method": scraped_data.get('scraping_method', ''),
                "scraped_at": scraped_data.get('scraped_at', ''),
                "lambda_ready": scraped_data.get('lambda_ready', False),
                "dynamodb_id": scraped_data.get('dynamodb_id', ''),
                "saved_to_dynamodb": scraped_data.get('saved_to_dynamodb', False)
            }
            
            print(f"Payload being sent: {json.dumps(verification_payload, indent=2)}")
            
            # Send POST request to verification API
            response = requests.post(
                self.verification_webhook_url,
                json=verification_payload,
                headers={'Content-Type': 'application/json'},
                timeout=120  # Increased to 2 minutes
            )
            
            if response.status_code == 200:
                try:
                    verification_result = response.json()
                    print(f"Verification API response: {verification_result}")
                    
                    # Parse the structured verification data
                    structured_verification = self.parse_verification_response(verification_result)
                    
                except json.JSONDecodeError as e:
                    print(f"Failed to parse JSON response: {e}")
                    print(f"Raw response text: {response.text}")
                    verification_result = {"error": "Invalid JSON response", "raw_response": response.text}
                    structured_verification = {"claims": []}
                
                return {
                    "verification_success": True,
                    "verification_response": verification_result,
                    "verification_status_code": response.status_code,
                    "structured_verification": structured_verification
                }
            else:
                print(f"Verification API failed with status {response.status_code}: {response.text}")
                return {
                    "verification_success": False,
                    "verification_response": response.text,
                    "verification_status_code": response.status_code
                }
                
        except Exception as e:
            print(f"Error calling verification API: {str(e)}")
            return {
                "verification_success": False,
                "verification_response": str(e),
                "verification_status_code": 0
            }
    
    def _extract_tweet_id(self, url: str) -> str:
        """Extract tweet ID from Twitter URL"""
        try:
            # Extract status ID from URL like https://x.com/user/status/1234567890
            import re
            match = re.search(r'/status/(\d+)', url)
            if match:
                return match.group(1)
            else:
                # Fallback: use hash of URL
                return str(hash(url))[-10:]
        except:
            return str(int(time.time()))
    
    def setup_selenium_driver(self):
        """Setup Selenium WebDriver for Lambda (requires selenium package)"""
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--disable-web-security')
        chrome_options.add_argument('--disable-features=VizDisplayCompositor')
        chrome_options.add_argument('--single-process')
        chrome_options.add_argument('--no-zygote')
        chrome_options.add_argument('--disable-background-timer-throttling')
        chrome_options.add_argument('--disable-backgrounding-occluded-windows')
        chrome_options.add_argument('--disable-renderer-backgrounding')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        # Use /tmp for any Chrome state to avoid permission issues on Lambda
        chrome_options.add_argument('--user-data-dir=/tmp/chrome-user-data')
        chrome_options.add_argument('--data-path=/tmp/chrome-data')
        chrome_options.add_argument('--disk-cache-dir=/tmp/chrome-cache')
        # Additional anti-detection measures
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Try multiple Chrome binary locations
        import os
        env_chrome = os.environ.get('CHROME_PATH')
        env_driver = os.environ.get('CHROMEDRIVER_PATH')
        chrome_paths = []
        if env_chrome:
            chrome_paths.append(env_chrome)
        chrome_paths += [
            '/opt/bin/chrome',              # Common Lambda layer path
            '/opt/bin/headless-chromium',   # Some layers expose this name under bin
            '/opt/chrome',                  # Some layers place binaries directly under /opt
            '/opt/headless-chromium',       # Alternative direct path
            '/opt/google/chrome',           # Less common packaged path
            '/var/task/bin/chrome',         # When bundled inside function zip
            '/var/task/chrome',             # Alternate bundling
            '/var/task/headless-chromium',  # Alternate bundling
            '/usr/bin/chromium',            # Local/dev
            '/usr/bin/google-chrome',       # Local/dev
            '/usr/bin/chrome',              # Local/dev
        ]
        
        chromedriver_paths = []
        if env_driver:
            chromedriver_paths.append(env_driver)
        chromedriver_paths += [
            '/opt/bin/chromedriver',  # Lambda layer
            '/opt/chromedriver',      # Some layers place it directly under /opt
            '/var/task/bin/chromedriver',  # When bundled inside function zip
            '/var/task/chromedriver',      # Alternate bundling
            '/usr/bin/chromedriver',  # Local
        ]
        
        chrome_found = None
        driver_found = None
        
        # Find Chrome binary
        for path in chrome_paths:
            if os.path.exists(path):
                chrome_found = path
                print(f"Found Chrome binary at: {path}")
                break
        
        # Find ChromeDriver (but we'll check compatibility after Chrome download)
        for path in chromedriver_paths:
            if os.path.exists(path):
                driver_found = path
                print(f"Found ChromeDriver at: {path}")
                break
        
        # Check if we have the proper layer setup
        if not chrome_found or not driver_found:
            print("Chrome or ChromeDriver not found in expected locations.")
            print("Searched Chrome paths:")
            for p in chrome_paths:
                print(f" - {p}")
            print("Searched ChromeDriver paths:")
            for p in chromedriver_paths:
                print(f" - {p}")
            # Extra diagnostics to help identify what's actually present in /opt
            try:
                print("Listing /opt contents for diagnostics:")
                print(os.listdir('/opt'))
            except Exception as _e:
                print(f"Could not list /opt: {_e}")
            try:
                print("Listing /opt/bin contents for diagnostics:")
                print(os.listdir('/opt/bin'))
            except Exception as _e:
                print(f"Could not list /opt/bin: {_e}")
            try:
                print("Listing /var/task/bin contents for diagnostics:")
                print(os.listdir('/var/task/bin'))
            except Exception as _e:
                print(f"Could not list /var/task/bin: {_e}")
            print("Hint: Ensure your Lambda layer or package provides both Chrome and Chromedriver, and set CHROME_PATH/CHROMEDRIVER_PATH env vars if using nonstandard paths.")
            return False
        
        # Set Chrome binary location
        if chrome_found:
            chrome_options.binary_location = chrome_found
            print(f"Using Chrome binary at: {chrome_found}")
        else:
            print("No Chrome binary found, trying default...")
        
        try:
            if driver_found:
                # Use Service to specify ChromeDriver path
                from selenium.webdriver.chrome.service import Service
                service = Service(driver_found)
                
                # Add some debugging
                print(f"ChromeDriver path: {driver_found}")
                print(f"Chrome binary path: {chrome_options.binary_location}")
                
                # Check if ChromeDriver is executable
                import stat
                if os.path.exists(driver_found):
                    st = os.stat(driver_found)
                    is_executable = bool(st.st_mode & stat.S_IEXEC)
                    print(f"ChromeDriver executable: {is_executable}")
                
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
            else:
                # Try without specifying driver path
                self.driver = webdriver.Chrome(options=chrome_options)
            
            self.driver.set_page_load_timeout(30)
            print("Selenium WebDriver setup successful!")
            return True
        except Exception as e:
            print(f"Selenium setup failed: {e}")
            return False
    
    
    def scrape_website(self, url: str) -> Dict[str, Any]:
        """Scrape website content using Selenium WebDriver - supports Twitter and news sites"""
        try:
            if not self.setup_selenium_driver():
                return {"error": "Failed to setup Selenium driver", "url": url}
            
            print(f"Loading URL: {url}")
            
            # Execute script to hide automation indicators
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            self.driver.get(url)
            
            # Wait for content to load (reduced timeout)
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Wait for dynamic content to load
            time.sleep(5)
            
            # Try scrolling to trigger lazy loading
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            self.driver.execute_script("window.scrollTo(0, 0);")
            time.sleep(2)
            
            # Check if we're on a login/signup page

            page_source = self.driver.page_source.lower()
            if 'sign up' in page_source or 'log in' in page_source or 'create account' in page_source:
                print("Detected login/signup page, trying to wait longer...")
                time.sleep(10)  # Wait longer for potential redirect
                
                # Try scrolling to trigger lazy loading
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(3)
                self.driver.execute_script("window.scrollTo(0, 0);")
                time.sleep(2)
            
            # Extract data using JavaScript
            data = self.driver.execute_script("""
                // Debug: Log page structure for troubleshooting
                console.log('Page title:', document.title);
                console.log('Page URL:', window.location.href);
                console.log('Body content length:', document.body.textContent.length);
                
                // Check for common content containers
                const contentContainers = [
                    '.article-page-content',
                    '[itemprop="articleBody"]',
                    '.article-content',
                    '.content',
                    'main',
                    'article'
                ];
                
                for (const selector of contentContainers) {
                    const element = document.querySelector(selector);
                    if (element) {
                        console.log('Found container:', selector, 'with text length:', element.textContent.length);
                    }
                }
                const safe_extract = (selector) => {
                    try {
                        const element = document.querySelector(selector);
                        return element ? element.textContent.trim() : null;
                    } catch (e) {
                        return null;
                    }
                };
                
                const safe_extract_all = (selector) => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        return Array.from(elements).map(el => el.textContent.trim()).filter(text => text.length > 0);
                    } catch (e) {
                        return [];
                    }
                };
                
                const extract_links = () => {
                    try {
                        return Array.from(document.querySelectorAll('a[href]'))
                            .map(link => link.href)
                            .filter(href => href && !href.startsWith('javascript:') && !href.startsWith('#'))
                            .slice(0, 15);
                    } catch (e) {
                        return [];
                    }
                };
                
                const extract_images = () => {
                    try {
                        const images = [];
                        // Try multiple selectors for images (both Twitter and news sites)
                        const selectors = [
                            'img[src*="pbs.twimg.com"]',  // Twitter's image CDN
                            'img[src*="media"]',          // Media images
                            'img[alt*="Image"]',          // Images with alt text
                            'article img',                // Images in articles
                            'div[data-testid="tweetPhoto"] img',  // Tweet photos
                            'img[src*="twimg"]',          // Any Twitter images
                            '.article-content img',       // News article images
                            '.content img',               // General content images
                            'main img',                   // Main content images
                            'figure img',                 // Figure images
                            '.article-page-content img',  // Sin Chew Daily article images
                            '[itemprop="articleBody"] img', // Article body images
                            '.article-text img',          // Article text images
                            '.news-article img',          // News article images
                            '.story img',                 // Story images
                            '.post img'                   // Post images
                        ];
                        
                        for (const selector of selectors) {
                            const imgs = document.querySelectorAll(selector);
                            for (const img of imgs) {
                                const src = img.src;
                                if (src && !src.includes('data:') && src.includes('http') && !images.includes(src)) {
                                    images.push(src);
                                }
                            }
                        }
                        
                        return images.slice(0, 10);  // Return up to 10 images
                    } catch (e) {
                        return [];
                    }
                };
                
                const extract_paragraphs = () => {
                    try {
                        const paragraphs = [];
                        // Common selectors for article paragraphs
                        const paragraphSelectors = [
                            'article p',                  // Standard article paragraphs
                            '.article-content p',         // Article content paragraphs
                            '.content p',                 // General content paragraphs
                            'main p',                     // Main content paragraphs
                            '.story-content p',           // Story content paragraphs
                            '.post-content p',            // Post content paragraphs
                            '.entry-content p',           // Entry content paragraphs
                            '[data-testid="tweetText"]',  // Twitter tweet text
                            'div[data-testid="tweetText"]', // Twitter tweet text div
                            'article div[lang]',          // Twitter article content
                            'div[lang]',                  // General lang divs
                            '.article-body p',            // Article body paragraphs
                            '.news-content p',            // News content paragraphs
                            '.text-content p',            // Text content paragraphs
                            '.article-page-content p',    // Sin Chew Daily article content
                            '[itemprop="articleBody"] p', // Article body with itemprop
                            '#article-page-content p',    // Article content by ID
                            '.article-text p',            // Article text paragraphs
                            '.news-article p',            // News article paragraphs
                            '.story p',                   // Story paragraphs
                            '.post p'                     // Post paragraphs
                        ];
                        
                        for (const selector of paragraphSelectors) {
                            const elements = document.querySelectorAll(selector);
                            for (const element of elements) {
                                const text = element.textContent.trim();
                                // Filter out very short text and navigation elements
                                if (text && text.length > 20 && 
                                    !text.toLowerCase().includes('cookie') &&
                                    !text.toLowerCase().includes('subscribe') &&
                                    !text.toLowerCase().includes('newsletter') &&
                                    !text.toLowerCase().includes('advertisement') &&
                                    !text.toLowerCase().includes('sponsored')) {
                                    paragraphs.push(text);
                                }
                            }
                        }
                        
                        // Remove duplicates and return unique paragraphs
                        return [...new Set(paragraphs)].slice(0, 20);  // Return up to 20 paragraphs
                    } catch (e) {
                        return [];
                    }
                };
                
                const extract_metrics = () => {
                    try {
                        const metrics = {};
                        const selectors = {
                            'retweets': '[data-testid="retweet"]',
                            'likes': '[data-testid="like"]',
                            'replies': '[data-testid="reply"]'
                        };
                        
                        for (const [metric, selector] of Object.entries(selectors)) {
                            const element = document.querySelector(selector);
                            if (element) {
                                const text = element.textContent || element.getAttribute('aria-label') || '';
                                const number = text.match(/[\\d,]+/);
                                metrics[metric] = number ? number[0].replace(/,/g, '') : '0';
                            }
                        }
                        
                        return metrics;
                    } catch (e) {
                        return {};
                    }
                };
                
                const extract_author = () => {
                    try {
                        // Try multiple selectors for author (both Twitter and news sites)
                        const authorSelectors = [
                            '[data-testid="User-Name"]',     // Twitter user name
                            '[data-testid="UserName"]',      // Twitter user name
                            'h1[data-testid="UserName"]',    // Twitter user name h1
                            'div[data-testid="UserName"]',   // Twitter user name div
                            '.author',                       // General author class
                            '.byline',                       // Byline class
                            '.article-author',               // Article author
                            '.story-author',                 // Story author
                            '.post-author',                  // Post author
                            '.writer',                       // Writer class
                            'meta[name="author"]',           // Meta author tag
                            '.author-name',                  // Author name class
                            '.byline-author'                 // Byline author class
                        ];
                        
                        for (const selector of authorSelectors) {
                            const author = safe_extract(selector);
                            if (author && author.length > 1 && author.length < 100) {
                                return author;
                            }
                        }
                        
                        // Try to extract from meta tags
                        const metaAuthor = document.querySelector('meta[name="author"]');
                        if (metaAuthor) {
                            return metaAuthor.getAttribute('content');
                        }
                        
                        return 'Unknown author';
                    } catch (e) {
                        return 'Unknown author';
                    }
                };
                
                const extract_timestamp = () => {
                    try {
                        // Try multiple selectors for timestamp (both Twitter and news sites)
                        const timestampSelectors = [
                            'time',                         // Standard time element
                            'time[datetime]',               // Time with datetime attribute
                            '.timestamp',                   // Timestamp class
                            '.publish-date',                // Publish date
                            '.article-date',                // Article date
                            '.story-date',                  // Story date
                            '.post-date',                   // Post date
                            '.date',                        // Date class
                            'meta[property="article:published_time"]', // Meta published time
                            'meta[name="date"]'             // Meta date
                        ];
                        
                        for (const selector of timestampSelectors) {
                            const element = document.querySelector(selector);
                            if (element) {
                                const timestamp = element.getAttribute('datetime') || 
                                                element.getAttribute('content') || 
                                                element.textContent.trim();
                                if (timestamp) {
                                    return timestamp;
                                }
                            }
                        }
                        
                        return null;
                    } catch (e) {
                        return null;
                    }
                };
                
                // Extract main content text (for Twitter compatibility)
                let main_text = safe_extract('[data-testid="tweetText"]');
                if (!main_text) {
                    const tweetSelectors = [
                        '[data-testid="tweetText"]',
                        'div[data-testid="tweetText"]',
                        'article div[lang]',
                        'div[lang]'
                    ];
                    
                    for (const selector of tweetSelectors) {
                        main_text = safe_extract(selector);
                        if (main_text && main_text.length > 10) break;
                    }
                }
                
                // Extract paragraphs
                const paragraphs = extract_paragraphs();
                
                // If we have paragraphs, use the first one as main text if no main text found
                if (!main_text && paragraphs.length > 0) {
                    main_text = paragraphs[0];
                }
                
                if (!main_text) {
                    main_text = 'Content extracted from page';
                }
                
                const author = extract_author();
                const timestamp = extract_timestamp();
                
                // Determine page type
                let page_type = 'unknown';
                if (paragraphs.length > 0) {
                    page_type = 'news_article';
                } else if (main_text && main_text !== 'Content extracted from page') {
                    page_type = 'tweet';
                } else {
                    page_type = 'profile';
                }
                
                return {
                    main_text: main_text,
                    paragraphs: paragraphs,
                    author: author,
                    timestamp: timestamp,
                    links: extract_links(),
                    images: extract_images(),
                    metrics: extract_metrics(),
                    page_title: document.title,
                    url: window.location.href,
                    page_type: page_type
                };
            """)
            
            data['scraping_method'] = 'selenium_webdriver'
            data['scraped_at'] = time.strftime('%Y-%m-%d %H:%M:%S')
            data['lambda_ready'] = True
            
            # Step 1: Save scraped data to DynamoDB first (ensures data is never lost)
            dynamodb_id = self.save_to_dynamodb(data, url)
            if dynamodb_id:
                data['dynamodb_id'] = dynamodb_id
                data['saved_to_dynamodb'] = True
            else:
                data['saved_to_dynamodb'] = False
            
            # Step 2: Send scraped data to verification API
            verification_result = self.verify_content(data)
            
            # Step 3: Combine scraped data with verification result
            combined_data = data.copy()
            combined_data['verification_result'] = verification_result
            
            # Step 4: Update DynamoDB with verification results
            if dynamodb_id:
                updated_dynamodb_id = self.save_to_dynamodb(combined_data, url, verification_result)
                if updated_dynamodb_id:
                    combined_data['verification_saved_to_dynamodb'] = True
                else:
                    combined_data['verification_saved_to_dynamodb'] = False
            
            return combined_data
            
        except Exception as e:
            return {"error": str(e), "url": url, "scraping_method": "selenium_webdriver"}
        finally:
            if self.driver:
                self.driver.quit()
                self.driver = None
    
    

# AWS Lambda Handler Function
def lambda_handler(event, context):
    """AWS Lambda handler function"""
    
    # Extract URL from event
    url = event.get('url', 'https://www.freemalaysiatoday.com/category/nation/2024/12/19/register-vehicles-for-subsidised-ron95-petrol-transport-companies-told/')
    
    # Scrape website data
    with LambdaWebScraper() as scraper:
        result = scraper.scrape_website(url)
    
    # Return Lambda response
    return {
        'statusCode': 200,
        'body': json.dumps(result, ensure_ascii=False),
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    }

# For local testing (remove this in production)
if __name__ == "__main__":
    # Test the lambda function locally
    def test_local():
        # Test with a news website URL
        event = {"url": "https://www.freemalaysiatoday.com/category/nation/2024/12/19/register-vehicles-for-subsidised-ron95-petrol-transport-companies-told/"}
        context = None
        result = lambda_handler(event, context)
        print(json.dumps(result, indent=2))
    
    test_local()
