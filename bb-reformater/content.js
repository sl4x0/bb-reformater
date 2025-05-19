// content.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // The "getSelectedText" action is now handled by popup.js using chrome.scripting.executeScript
    // So, we only need to handle "replaceSelectedText" here.

    if (request.action === "replaceSelectedText") {
        const newText = request.newText;
        const activeElement = document.activeElement; // Element that has focus

        let success = false;
        let errorMessage = "";

        // Function to check if an element is within an iframe that is currently focused
        function isElementInFocusedFrame(element) {
            let currentWindow = element.ownerDocument.defaultView;
            let currentDocument = element.ownerDocument;
            while (currentWindow !== window.top) { // While we are in an iframe
                if (window.top.document.activeElement === currentWindow.frameElement) {
                    // The parent document's active element IS this iframe
                    // Now check if the element itself is the active element within this iframe
                    if (currentDocument.activeElement === element) {
                        return true;
                    }
                }
                // Traverse up to the parent frame, checking if frameElement exists
                if (!currentWindow.parent || currentWindow.parent === currentWindow || !currentWindow.parent.frameElement) break;
                currentWindow = currentWindow.parent;
                currentDocument = currentWindow.document;
            }
            // If we reached the top, check if the element is active in the top window
            return window.top.document.activeElement === element;
        }


        // Scenario 1: Active element is an input or textarea
        if (activeElement && (activeElement.tagName.toLowerCase() === 'textarea' || activeElement.tagName.toLowerCase() === 'input')) {
            if (document.hasFocus() || isElementInFocusedFrame(activeElement)) {
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;

                if (typeof start === 'number' && typeof end === 'number' && start !== end) {
                    const before = activeElement.value.substring(0, start);
                    const after = activeElement.value.substring(end);
                    activeElement.value = before + newText + after;

                    activeElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                    activeElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                    success = true;
                } else {
                    errorMessage = "No text selected in the focused input/textarea for replacement.";
                    console.warn(errorMessage);
                }
            } else {
                console.warn("replaceSelectedText: activeElement is input/textarea but not in the focused frame. Skipping.");
            }
        }
        // Scenario 2: ContentEditable elements or general page content
        else {
            const selection = window.getSelection();
            if ((document.hasFocus() || (selection.anchorNode && selection.anchorNode.ownerDocument === document)) && selection.rangeCount > 0) {
                if (!selection.isCollapsed) { 
                    if (document.execCommand('insertText', false, newText)) {
                        success = true;
                    } else {
                        try {
                            const range = selection.getRangeAt(0);
                            range.deleteContents();
                            range.insertNode(document.createTextNode(newText));
                            success = true;
                        } catch (e) {
                            errorMessage = "Failed to replace text using range manipulation: " + e.message;
                            console.error(errorMessage, e);
                        }
                    }
                } else {
                    errorMessage = "No text selected on the page to replace (selection is collapsed).";
                    console.warn(errorMessage);
                }
            } else {
                 console.warn("replaceSelectedText: No focus or selection in this frame to replace.");
            }
        }

        if (success) {
            sendResponse({ success: true });
        } else {
            if (!errorMessage && !success) { 
                console.log("No actionable selection found for replacement in this frame.");
                sendResponse({ success: false, error: "No actionable selection in this frame." });
            } else if (errorMessage) {
                if (errorMessage.includes("Failed to replace text using range manipulation") || errorMessage.includes("Automatic replacement failed")) {
                    alert("Failed to automatically replace text. Please copy the text below and paste it manually:\n\n" + newText);
                }
                sendResponse({ success: false, error: errorMessage + " User may need to paste manually." });
            }
        }
        return true; // Keep message channel open for async response
    }
    return true; // Important for async sendResponse
});