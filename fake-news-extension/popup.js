document.addEventListener('DOMContentLoaded', function () {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const loading = document.getElementById('loading');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    scrapeBtn.addEventListener('click', async function () {
        try {
            // Get the current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url) {
                showError('No active tab found or URL not available');
                return;
            }

            // Show loading state
            scrapeBtn.disabled = true;
            loading.style.display = 'none';
            progressContainer.style.display = 'block';

            // Start progress animation
            updateProgress(0, 'Initializing...');

            // Simulate progress steps
            setTimeout(() => updateProgress(20, 'Extracting content...'), 300);
            setTimeout(() => updateProgress(40, 'Analyzing text...'), 600);
            setTimeout(() => updateProgress(60, 'Checking sources...'), 900);
            setTimeout(() => updateProgress(80, 'Running AI analysis...'), 1200);

            // Make API call
            const response = await fetch('https://u4wnt31ti1.execute-api.ap-southeast-5.amazonaws.com/test/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: tab.url
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Complete progress
            updateProgress(100, 'Analysis complete!');

            // Log results to console
            console.log('Fake news analysis completed:', data);

        } catch (error) {
            console.error('Error scraping website:', error);
        } finally {
            // Hide loading state
            scrapeBtn.disabled = false;
            loading.style.display = 'none';
            progressContainer.style.display = 'none';
        }
    });


    function updateProgress(percentage, text) {
        progressFill.style.width = percentage + '%';
        progressText.textContent = text;
    }
});
