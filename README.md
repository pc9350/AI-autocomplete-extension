# AI Smart Autocomplete Extension

## Overview
A Chrome extension that provides real-time AI-powered text suggestions using Gemini Nano. The extension works across various text input fields including regular textboxes, rich text editors, and Gmail compose. Google Docs support is currently under development.

## Current Features
- Real-time text suggestions as you type
- Works in:
  - Regular input fields
  - Textareas
  - Contenteditable divs
  - Rich text editors (ProseMirror, CodeMirror, Monaco, etc.)
  - Gmail compose
- Consistent ghost text UI showing suggestions
  - Gray, italic text for suggestions
  - Proper positioning across different editors
  - Maintains original font styles
- Tab key to accept suggestions
- Escape key to dismiss suggestions
- Debounced input handling for performance

## Project Structure

```
ai-autocomplete-extension/
├── manifest.json
├── src/
│ ├── content/
│ │ ├── content.js # Main content script handling input detection
│ │ └── ghostText.js # UI component for showing suggestions
│ ├── models/
│    └── geminiNano.js # AI model integration
└── styles/
└── styles.css # Ghost text styling
```


## Known Issues & TODOs

### Google Docs Integration
- Currently not working due to canvas-based editor
- Need to implement special handling for canvas text extraction
- Requires different approach for cursor position detection

### Minor Improvements Needed
1. Fine-tune suggestion positioning in complex layouts
2. Improve performance for rapid typing
3. Add configuration options for suggestion style
4. Better error handling for model responses

## Technical Details

### Key Components

#### UniversalAutocomplete (content.js)
- Main controller for the extension
- Handles input detection across different editors
- Manages suggestion display and acceptance
- Special handling for different editor types

#### GeminiNano (geminiNano.js)
- Integrates with Gemini Nano AI model
- Handles prompt generation and response processing
- Manages suggestion timeouts and error handling

### Current Implementation Notes
1. Uses inline styles for consistent appearance
2. Handles different input types uniformly
3. Maintains original editor font styles
4. Proper text measurement for positioning

## Setup and Development

1. Clone the repository
2. Copy `src/config.example.js` to `src/config.js`
3. Add your Cerebras API key to `config.js`
4. Load as unpacked extension in Chrome
5. Enable developer mode in Chrome extensions
6. Test in different contexts

## Testing Priority Areas
1. Google Docs integration
2. Complex editor layouts
3. Performance optimization
4. Error handling improvements

## Future Improvements
1. Complete Google Docs support
2. Add user configuration options
3. Improve suggestion relevance
4. Add support for different languages
5. Optimize performance

## Contributing
Current focus areas:
1. Google Docs integration
2. Performance optimization
3. Error handling
4. Configuration options
5. Testing across different platforms

## Notes for Developers
- Test in various text editors
- Monitor performance with rapid typing
- Check for memory leaks
- Verify suggestion positioning
- Test across different websites
