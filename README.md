# AI Smart Autocomplete Extension

## Overview
A Chrome extension that provides real-time AI-powered text suggestions using Gemini Nano. The extension works across various text input fields including regular textboxes, rich text editors, Gmail compose, and Google Docs (work in progress).

## Current Features
- Real-time text suggestions as you type
- Works in most text input fields
- Ghost text UI showing suggestions
- Tab key to accept suggestions
- Escape key to dismiss suggestions
- Debounced input handling for performance
- Support for:
  - Regular input fields
  - Textareas
  - Contenteditable divs
  - Gmail compose (partial support)

## Project Structure

ai-autocomplete-extension/
├── manifest.json
├── src/
│ ├── content/
│ │ ├── content.js # Main content script handling input detection
│ │ └── ghostText.js # UI component for showing suggestions
│ ├── models/
│ │ └── geminiNano.js # AI model integration
│ └── utils/
│ └── debounce.js # Utility functions
└── styles/
└── styles.css # Ghost text styling


## Known Issues & TODOs

### Google Docs Integration
- Current implementation doesn't fully work with Google Docs' canvas-based editor
- Need to improve text extraction and cursor position detection
- Requires special handling for the canvas-based rendering

### Gmail Compose
- Tab key sometimes navigates to other elements instead of accepting suggestions
- Ghost text positioning needs improvement in complex layouts
- Selection handling can be unreliable

### General Improvements Needed
1. Better position calculation for ghost text overlay
2. More robust selection handling across different editors
3. Improved suggestion relevance and context awareness
4. Better error handling for selection and range issues

## Technical Details

### Key Components

#### AutocompleteManager (content.js)
- Handles input detection and event management
- Sets up listeners for different types of editors
- Manages suggestion requests and UI updates

#### GhostText (ghostText.js)
- Manages the suggestion overlay UI
- Handles positioning and styling of suggestions
- Manages text measurement and placement

#### GeminiNano (geminiNano.js)
- Integrates with Gemini Nano AI model
- Handles prompt generation and response processing
- Manages suggestion timeouts and error handling

### Current Implementation Notes
1. Uses MutationObserver for dynamic content
2. Implements debouncing for performance
3. Handles different text input types
4. Uses custom positioning for ghost text

## Setup and Development

1. Clone the repository
2. Load as unpacked extension in Chrome
3. Enable developer mode in Chrome extensions
4. Test in different contexts to verify functionality

## Testing Priority Areas
1. Google Docs integration
2. Gmail compose functionality
3. Rich text editor support
4. Position calculation accuracy
5. Selection handling reliability

## Future Improvements
1. Add support for more editor types
2. Improve suggestion quality and relevance
3. Add configuration options
4. Implement better error handling
5. Add support for different languages
6. Improve performance and reduce latency

## Contributing
When working on this project, please focus on:
1. Fixing Google Docs integration
2. Improving Gmail compose support
3. Making ghost text positioning more reliable
4. Enhancing selection handling
5. Adding better error recovery

## Notes for Developers
- Test thoroughly in different contexts
- Watch for selection-related errors
- Monitor performance impact
- Consider edge cases in different editors
- Keep the UI consistent across platforms

This project is under active development and needs careful attention to editor-specific implementations and cross-platform compatibility.