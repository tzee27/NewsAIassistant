# Website Scraper Chrome Extension

A Chrome extension that allows you to scrape website content using a custom API endpoint.

## Features

- **Popup Interface**: Click the extension icon to open a popup with a "Scrape This Website" button
- **Content Script Button**: A floating button is injected into every webpage for quick access
- **API Integration**: Calls your custom scraping API with the current page URL
- **Result Display**: Shows API response in a formatted modal or popup
- **Modern UI**: Beautiful gradient design with smooth animations

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this folder
4. The extension will be installed and ready to use

## Usage

### Method 1: Extension Popup
1. Click the extension icon in the Chrome toolbar
2. Click "Scrape This Website" button
3. View the results in the popup

### Method 2: Floating Button
1. Navigate to any website
2. Look for the floating "🔍 Scrape This Page" button in the top-right corner
3. Click the button to scrape the current page
4. View results in a modal overlay

## API Endpoint

The extension calls your API at:
```
POST https://u4wnt31ti1.execute-api.ap-southeast-5.amazonaws.com/test/scrape
```

With the request body:
```json
{
  "url": "CURRENT_PAGE_URL"
  
}
```

## Files Structure

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality and API calls
- `content.js` - Content script for injecting floating button
- `content.css` - Styles for the floating button and modals
- `icon16.png`, `icon48.png`, `icon128.png` - Extension icons (placeholder)

## Customization

You can customize the extension by:
- Replacing the placeholder icon files with your own icons
- Modifying the API endpoint in `popup.js` and `content.js`
- Changing the styling in `popup.html` and `content.css`
- Adjusting the button position in `content.js`

## Permissions

The extension requires:
- `activeTab` - To get the current tab's URL
- `scripting` - To inject content scripts
- Host permission for your API domain

## Development

To modify the extension:
1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on your extension
4. Test your changes

## Notes

- The extension works on all websites (`<all_urls>`)
- Results are displayed in JSON format
- Error handling is included for failed API calls
- The floating button automatically appears on page navigation (SPA support)
