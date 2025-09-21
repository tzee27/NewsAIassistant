import json
import os
import boto3
import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
import time
from datetime import datetime
import re
import threading
import asyncio
import concurrent.futures

class SimpleWebScraper:
    """Simple web scraper optimized for AWS Lambda using Selenium - no verification API calls"""
    
    def __init__(self):
        self.driver = None
        self.n8n_webhook_url = "https://n8n-staging.ai-spacex.co/webhook/d3afd105-4db6-47d3-8aaa-87f9d268c3ea"
        
    def __enter__(self):
        """Context manager entry"""
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - cleanup resources"""
        if self.driver:
            try:
                self.driver.quit()
            except Exception as e:
                print(f"Error closing driver: {e}")
    
    def setup_selenium_driver(self):
        """Setup Selenium WebDriver with Chrome for AWS Lambda"""
        try:
            # Chrome options for Lambda (same as working main scraper)
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
            
            # Find Chrome and ChromeDriver paths
            chrome_paths = [
                '/opt/bin/chrome',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium'
            ]
            
            chromedriver_paths = [
                '/opt/bin/chromedriver',
                '/usr/bin/chromedriver'
            ]
            
            chrome_binary = None
            for path in chrome_paths:
                if os.path.exists(path) and os.access(path, os.X_OK):
                    chrome_binary = path
                    print(f"Found Chrome binary at: {path}")
                    break
            
            chromedriver_binary = None
            for path in chromedriver_paths:
                if os.path.exists(path) and os.access(path, os.X_OK):
                    chromedriver_binary = path
                    print(f"Found ChromeDriver at: {path}")
                    break
            
            if not chrome_binary or not chromedriver_binary:
                raise Exception("Chrome or ChromeDriver not found in layer. Please use the selenium-chrome-layer.")
            
            print(f"Using Chrome binary at: {chrome_binary}")
            print(f"ChromeDriver path: {chromedriver_binary}")
            print(f"Chrome binary path: {chrome_binary}")
            print(f"ChromeDriver executable: {os.access(chromedriver_binary, os.X_OK)}")
            
            # Set Chrome binary path
            chrome_options.binary_location = chrome_binary
            
            # Create WebDriver
            try:
                service = Service(chromedriver_binary)
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
            except Exception as e:
                print(f"Failed to create WebDriver with service: {e}")
                # Try without specifying driver path
                self.driver = webdriver.Chrome(options=chrome_options)
            
            # Execute script to remove webdriver property
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # Set page load timeout
            self.driver.set_page_load_timeout(30)
            
            print("Selenium WebDriver setup successful!")
            return True
            
        except Exception as e:
            print(f"Error setting up Selenium driver: {str(e)}")
            return False
    
    def scrape_website(self, url):
        """Scrape website content using Selenium"""
        try:
            if not self.driver:
                if not self.setup_selenium_driver():
                    return {"error": "Failed to setup Selenium driver"}
            
            print(f"Loading URL: {url}")
            self.driver.get(url)
            
            # Wait for page to load
            time.sleep(3)
            
            # Check if we're on a login/signup page
            page_source = self.driver.page_source.lower()
            if any(keyword in page_source for keyword in ['sign in', 'log in', 'login', 'sign up', 'register']):
                print("Detected login/signup page, waiting longer for dynamic content...")
                time.sleep(5)
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
            
            # Get page title
            page_title = self.driver.title or "No title"
            
            # Determine page type
            page_type = "unknown"
            if "twitter.com" in url or "x.com" in url:
                page_type = "twitter_post"
            elif any(news_site in url for news_site in ["freemalaysiatoday.com", "sinchew.com.my", "malaysiakini.com", "thestar.com.my"]):
                page_type = "news_article"
            
            # Extract content based on page type
            if page_type == "twitter_post":
                return self._scrape_twitter_post(url, page_title)
            elif page_type == "news_article":
                return self._scrape_news_article(url, page_title)
            else:
                return self._scrape_generic_page(url, page_title)
                
        except Exception as e:
            print(f"Error scraping website: {str(e)}")
            return {"error": str(e), "url": url, "scraping_method": "selenium_webdriver"}
    
    def _scrape_twitter_post(self, url, page_title):
        """Scrape Twitter/X post content"""
        try:
            # Wait for content to load
            time.sleep(3)
            
            # Extract tweet text
            tweet_text = ""
            try:
                tweet_element = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="tweetText"]'))
                )
                tweet_text = tweet_element.text
            except TimeoutException:
                # Try alternative selectors
                for selector in ['[data-testid="tweetText"]', '.tweet-text', '.js-tweet-text', 'article p']:
                    try:
                        element = self.driver.find_element(By.CSS_SELECTOR, selector)
                        tweet_text = element.text
                        break
                    except:
                        continue
            
            # Extract author
            author = ""
            try:
                author_element = self.driver.find_element(By.CSS_SELECTOR, '[data-testid="User-Name"]')
                author = author_element.text.split('\n')[0] if author_element else ""
            except:
                pass
            
            # Extract images
            images = []
            try:
                img_elements = self.driver.find_elements(By.CSS_SELECTOR, '[data-testid="tweetPhoto"] img, .tweet-image img, article img')
                images = [img.get_attribute('src') for img in img_elements if img.get_attribute('src')]
            except:
                pass
            
            # Extract links
            links = []
            try:
                link_elements = self.driver.find_elements(By.CSS_SELECTOR, 'a[href]')
                links = [link.get_attribute('href') for link in link_elements if link.get_attribute('href')]
                links = list(set(links))  # Remove duplicates
            except:
                pass
            
            # Extract metrics (likes, retweets, etc.)
            metrics = {}
            try:
                # Try to find engagement metrics
                for metric_type in ['like', 'retweet', 'reply', 'share']:
                    try:
                        metric_element = self.driver.find_element(By.CSS_SELECTOR, f'[data-testid="{metric_type}"]')
                        metric_text = metric_element.text
                        if metric_text:
                            metrics[metric_type] = metric_text
                    except:
                        continue
            except:
                pass
            
            return {
                "url": url,
                "page_title": page_title,
                "page_type": "twitter_post",
                "author": author,
                "main_text": tweet_text,
                "paragraphs": [tweet_text] if tweet_text else [],
                "images": images,
                "links": links,
                "metrics": metrics,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "scraping_method": "selenium_webdriver",
                "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "lambda_ready": True
            }
            
        except Exception as e:
            print(f"Error scraping Twitter post: {str(e)}")
            return {"error": str(e), "url": url, "scraping_method": "selenium_webdriver"}
    
    def _scrape_news_article(self, url, page_title):
        """Scrape news article content"""
        try:
            # Wait for content to load
            time.sleep(3)
            
            # Scroll to load dynamic content
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            
            # Extract main content
            main_text = ""
            paragraphs = []
            
            # Try multiple selectors for article content
            content_selectors = [
                '.article-page-content p',
                '[itemprop="articleBody"] p',
                '.article-content p',
                '.post-content p',
                '.entry-content p',
                'article p',
                '.content p'
            ]
            
            for selector in content_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        paragraphs = [elem.text.strip() for elem in elements if elem.text.strip()]
                        main_text = " ".join(paragraphs)
                        break
                except:
                    continue
            
            # Extract author
            author = ""
            author_selectors = [
                '.author-name',
                '.byline',
                '[itemprop="author"]',
                '.article-author',
                '.post-author'
            ]
            
            for selector in author_selectors:
                try:
                    author_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    author = author_element.text.strip()
                    if author:
                        break
                except:
                    continue
            
            # Extract images
            images = []
            image_selectors = [
                '.article-page-content img',
                '[itemprop="articleBody"] img',
                '.article-content img',
                '.post-content img',
                'article img'
            ]
            
            for selector in image_selectors:
                try:
                    img_elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    images = [img.get_attribute('src') for img in img_elements if img.get_attribute('src')]
                    if images:
                        break
                except:
                    continue
            
            # Extract links
            links = []
            try:
                link_elements = self.driver.find_elements(By.CSS_SELECTOR, 'a[href]')
                links = [link.get_attribute('href') for link in link_elements if link.get_attribute('href')]
                links = list(set(links))  # Remove duplicates
            except:
                pass
            
            return {
                "url": url,
                "page_title": page_title,
                "page_type": "news_article",
                "author": author,
                "main_text": main_text,
                "paragraphs": paragraphs,
                "images": images,
                "links": links,
                "metrics": {},
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "scraping_method": "selenium_webdriver",
                "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "lambda_ready": True
            }
            
        except Exception as e:
            print(f"Error scraping news article: {str(e)}")
            return {"error": str(e), "url": url, "scraping_method": "selenium_webdriver"}
    
    def _scrape_generic_page(self, url, page_title):
        """Scrape generic webpage content"""
        try:
            # Wait for content to load
            time.sleep(3)
            
            # Extract main content
            main_text = ""
            paragraphs = []
            
            # Try to find main content
            content_selectors = [
                'main p',
                'article p',
                '.content p',
                '.main-content p',
                'body p'
            ]
            
            for selector in content_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        paragraphs = [elem.text.strip() for elem in elements if elem.text.strip()]
                        main_text = " ".join(paragraphs)
                        break
                except:
                    continue
            
            # Extract images
            images = []
            try:
                img_elements = self.driver.find_elements(By.CSS_SELECTOR, 'img')
                images = [img.get_attribute('src') for img in img_elements if img.get_attribute('src')]
            except:
                pass
            
            # Extract links
            links = []
            try:
                link_elements = self.driver.find_elements(By.CSS_SELECTOR, 'a[href]')
                links = [link.get_attribute('href') for link in link_elements if link.get_attribute('href')]
                links = list(set(links))  # Remove duplicates
            except:
                pass
            
            return {
                "url": url,
                "page_title": page_title,
                "page_type": "generic_page",
                "author": "",
                "main_text": main_text,
                "paragraphs": paragraphs,
                "images": images,
                "links": links,
                "metrics": {},
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "scraping_method": "selenium_webdriver",
                "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "lambda_ready": True
            }
            
        except Exception as e:
            print(f"Error scraping generic page: {str(e)}")
            return {"error": str(e), "url": url, "scraping_method": "selenium_webdriver"}
    
    def send_result_to_n8n(self, result, original_url, chat_id=None):
        """Send scraping result back to n8n webhook"""
        try:
            payload = {
                "status": "completed",
                "url": original_url,
                "result": result,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
            # Include chatId if provided
            if chat_id:
                payload["chatId"] = chat_id
            
            response = requests.post(
                self.n8n_webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"Successfully sent result to n8n webhook for URL: {original_url}")
            else:
                print(f"Failed to send result to n8n webhook. Status: {response.status_code}, Response: {response.text}")
                
        except Exception as e:
            print(f"Error sending result to n8n webhook: {str(e)}")
    

def lambda_handler(event, context):
    """AWS Lambda handler function - returns 200 immediately, then scrapes in background"""
    try:
        # Parse the event
        if isinstance(event, str):
            event = json.loads(event)
        
        # Handle API Gateway event format
        if 'body' in event:
            # This is an API Gateway event
            body = event.get('body', '{}')
            if isinstance(body, str):
                body = json.loads(body)
            url = body.get('url')
            chat_id = body.get('chatId')
            is_background = body.get('background', False)
        else:
            # Direct Lambda invocation
            url = event.get('url')
            chat_id = event.get('chatId')
            is_background = event.get('background', False)
        
        if not url:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'URL is required'})
            }
        
        
        # Immediately return 200 status to n8n
        immediate_response_body = {
            'status': 'accepted',
            'message': 'Scraping request received, processing in background',
            'url': url,
            'timestamp': datetime.utcnow().isoformat() + "Z"
        }
        
        # Include chatId in immediate response if provided
        if chat_id:
            immediate_response_body['chatId'] = chat_id
        
        immediate_response = {
            'statusCode': 200,
            'body': json.dumps(immediate_response_body),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
        
        # Invoke background scraper Lambda function
        try:
            lambda_client = boto3.client('lambda', region_name='ap-southeast-5')
            payload = {
                'url': url,
                'chatId': chat_id
            }
            
            # Invoke the background scraper function asynchronously
            response = lambda_client.invoke(
                FunctionName='background-web-scraper',
                InvocationType='Event',  # Async invocation
                Payload=json.dumps(payload)
            )
            print(f"Background scraper Lambda invoked successfully: {response['StatusCode']}")
        except Exception as e:
            print(f"Failed to invoke background scraper Lambda: {str(e)}")
            # Fallback: try to do it in a thread anyway
            def background_scraping():
                try:
                    print(f"Fallback background thread started for URL: {url}, chatId: {chat_id}")
                    with SimpleWebScraper() as scraper:
                        print(f"Scraper initialized, starting scraping...")
                        scraped_data = scraper.scrape_website(url)
                        print(f"Scraping completed, sending to n8n...")
                        scraper.send_result_to_n8n(scraped_data, url, chat_id)
                        print(f"Result sent to n8n successfully")
                except Exception as e:
                    print(f"Background scraping error: {str(e)}")
                    # Send error result to n8n
                    try:
                        with SimpleWebScraper() as scraper:
                            error_result = {"error": str(e), "url": url, "scraping_method": "selenium_webdriver"}
                            scraper.send_result_to_n8n(error_result, url, chat_id)
                            print(f"Error result sent to n8n")
                    except Exception as e2:
                        print(f"Failed to send error result to n8n: {str(e2)}")
            
            # Start background thread (non-daemon to keep Lambda alive)
            thread = threading.Thread(target=background_scraping)
            thread.daemon = False
            thread.start()
            print(f"Fallback background thread started for URL: {url}")
            
            # Give the thread a moment to start
            time.sleep(0.1)
        
        return immediate_response
            
    except Exception as e:
        print(f"Lambda handler error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
