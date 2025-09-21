document.addEventListener('DOMContentLoaded', function () {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('resultContainer');
    const resultTitle = document.getElementById('resultTitle');
    const resultContent = document.getElementById('resultContent');

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
            loading.style.display = 'block';
            resultContainer.style.display = 'none';

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

            // Display result
            showResult('Success!', JSON.stringify(data, null, 2), 'success');

        } catch (error) {
            console.error('Error scraping website:', error);
            showError(`Error: ${error.message}`);
        } finally {
            // Hide loading state
            scrapeBtn.disabled = false;
            loading.style.display = 'none';
        }
    });

    function showResult(title, content, type) {
        resultTitle.textContent = title;
        resultTitle.className = `result-title ${type}`;
        resultContent.textContent = content;
        resultContent.className = `result-content ${type}`;
        resultContainer.style.display = 'block';
    }

    function showError(message) {
        showResult('Error', message, 'error');
    }
});
