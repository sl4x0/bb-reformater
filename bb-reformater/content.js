// content.js
console.log('Content script loaded and executing');

// Constants
const DOMAINS = {
    TWITTER: ['twitter.com', 'x.com']
};

const ERROR_MESSAGES = {
    NO_SELECTION: 'No text selected on the page to replace.',
    NO_INPUT_SELECTION: 'No text selected in the focused input/textarea for replacement.',
    REPLACEMENT_FAILED: 'Failed to replace text using range manipulation: ',
    NO_ACTIONABLE_SELECTION: 'No actionable selection found for replacement.'
};

// Helper Functions
function isTwitterDomain() {
    return DOMAINS.TWITTER.some(domain => window.location.hostname.includes(domain));
}

function isElementInFocusedFrame(element) {
    if (!element || !element.ownerDocument || !element.ownerDocument.defaultView) {
        return false;
    }
    let currentWindow = element.ownerDocument.defaultView;
    let topWindow = window.top;
    
    if (element.ownerDocument.activeElement !== element) {
        return false;
    }

    while (currentWindow !== topWindow) {
        if (topWindow.document.activeElement === currentWindow.frameElement) {
            if (!currentWindow.parent || currentWindow.parent === currentWindow) break;
            currentWindow = currentWindow.parent;
        } else {
            return false;
        }
    }
    return true;
}

function handleTwitterContentEditable(newText) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return false;

    try {
        const range = selection.getRangeAt(0);
        const commonAncestor = range.commonAncestorContainer;
        const contentEditableElement = commonAncestor.nodeType === Node.ELEMENT_NODE 
            ? commonAncestor.closest('[contenteditable="true"]') 
            : commonAncestor.parentElement.closest('[contenteditable="true"]');
        
        if (!contentEditableElement) {
            console.warn('No contentEditable element found in selection for Twitter');
            return false;
        }

        // For Twitter, we need to preserve the selection and trigger proper events
        range.deleteContents();
        const textNode = document.createTextNode(newText);
        range.insertNode(textNode);
        
        // Move cursor to end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);

        // Trigger necessary events for Twitter
        contentEditableElement.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: newText
        }));

        // Sometimes Twitter needs a focus event to update its state
        contentEditableElement.focus();

        return true;
    } catch (e) {
        console.error('Twitter contentEditable error:', e);
        return false;
    }
}

function handleInputTextarea(element, newText) {
    const start = element.selectionStart;
    const end = element.selectionEnd;

    if (typeof start === 'number' && typeof end === 'number' && start !== end) {
        const before = element.value.substring(0, start);
        const after = element.value.substring(end);
        element.value = before + newText + after;

        element.selectionStart = element.selectionEnd = start + newText.length;

        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        element.focus();
        return true;
    }
    console.warn("No text selected in input/textarea to replace.");
    return false;
}

function handleStandardContentEditable(newText) {
    if (document.queryCommandSupported('insertText') && document.execCommand('insertText', false, newText)) {
        return true;
    }

    try {
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) return false;

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        
        range.setStartAfter(range.commonAncestorContainer.lastChild);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        return true;
    } catch (e) {
        console.error(ERROR_MESSAGES.REPLACEMENT_FAILED, e);
        return false;
    }
}

// Main Message Handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Only handle messages with the "replaceSelectedText" action
    if (request.action !== "replaceSelectedText") {
        return false; // Explicitly return false for unhandled actions
    }

    try {
        const newText = request.newText;
        const activeElement = document.activeElement;
        let success = false;
        let errorMessage = "";

        // Scenario 1: Active element is an input or textarea AND is in the focused document/frame
        if (activeElement && 
            (activeElement.tagName.toLowerCase() === 'textarea' || activeElement.tagName.toLowerCase() === 'input') &&
            (document.hasFocus() || isElementInFocusedFrame(activeElement))) {
            
            success = handleInputTextarea(activeElement, newText);
            if (!success && activeElement.selectionStart === activeElement.selectionEnd) {
                errorMessage = ERROR_MESSAGES.NO_INPUT_SELECTION;
            }
        }
        
        // Scenario 2: ContentEditable elements or general page selection
        if (!success) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                if (isTwitterDomain()) {
                    success = handleTwitterContentEditable(newText);
                }
                
                if (!success) {
                    success = handleStandardContentEditable(newText);
                    }
            } else if (!errorMessage) {
                errorMessage = ERROR_MESSAGES.NO_SELECTION;
            }
        }

        if (success) {
            sendResponse({ success: true });
        } else {
            if (!errorMessage) {
                errorMessage = ERROR_MESSAGES.NO_ACTIONABLE_SELECTION;
            }
            
            if (isTwitterDomain() && (errorMessage === ERROR_MESSAGES.NO_ACTIONABLE_SELECTION || errorMessage === ERROR_MESSAGES.NO_SELECTION)) {
                alert("Twitter text replacement failed. Please copy the text below and paste it manually:\n\n" + newText);
            } else if (errorMessage.startsWith(ERROR_MESSAGES.REPLACEMENT_FAILED.trim())) {
                    alert("Failed to automatically replace text. Please copy the text below and paste it manually:\n\n" + newText);
                }
            
            sendResponse({ success: false, error: errorMessage });
        }
    } catch (error) {
        console.error('Unexpected error in content.js message handler:', error);
        sendResponse({ 
            success: false, 
            error: 'An unexpected error occurred in the content script. Please try again or paste manually.' 
        });
    }

    return true; // Only return true for handled messages where we call sendResponse
});