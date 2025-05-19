document.addEventListener('DOMContentLoaded', () => {
    const selectedTextEl = document.getElementById('selectedText');
    const userPromptEl = document.getElementById('userPrompt');
    const submitBtn = document.getElementById('submitBtn');
    const statusEl = document.getElementById('status');
    const errorEl = document.getElementById('error');

    let currentSelectedText = '';
    let sourceFrameId = null; // To store the frameId of the selection

    // Function to be injected into frames to get selected text
    function getSelectionFromFrame() {
        return window.getSelection().toString().trim();
    }

    // Get selected text from the active tab, checking all frames
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            errorEl.textContent = "Could not find active tab.";
            return;
        }
        const tabId = tabs[0].id;

        chrome.scripting.executeScript(
            {
                target: { tabId: tabId, allFrames: true },
                func: getSelectionFromFrame
            },
            (injectionResults) => {
                if (chrome.runtime.lastError) {
                    errorEl.textContent = "Error getting text. Make sure you've selected some text on the page.";
                    console.error("executeScript error:", chrome.runtime.lastError.message);
                    return;
                }

                let foundText = '';
                if (injectionResults && injectionResults.length > 0) {
                    for (const frameResult of injectionResults) {
                        if (frameResult.result && typeof frameResult.result === 'string' && frameResult.result.trim() !== '') {
                            foundText = frameResult.result.trim();
                            sourceFrameId = frameResult.frameId; // Store frameId
                            break; // Found selected text in one of the frames
                        }
                    }
                }

                if (foundText) {
                    currentSelectedText = foundText;
                    selectedTextEl.value = foundText;
                    errorEl.textContent = ''; // Clear any previous error
                } else {
                    selectedTextEl.value = ''; // Clear the textarea
                    errorEl.textContent = "No text selected on the page or in any iframe.";
                }
            }
        );
    });

    submitBtn.addEventListener('click', () => {
        const prompt = userPromptEl.value.trim();
        if (!currentSelectedText) {
            errorEl.textContent = 'No text was selected.';
            return;
        }
        if (!prompt) {
            errorEl.textContent = 'Please enter an instruction.';
            return;
        }

        statusEl.textContent = 'Processing...';
        errorEl.textContent = '';
        submitBtn.disabled = true;

        chrome.runtime.sendMessage(
            {
                action: "rewriteText",
                selectedText: currentSelectedText,
                userPrompt: prompt,
                frameId: sourceFrameId // Send frameId
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    let errMsg = chrome.runtime.lastError.message || "Unknown error during message send.";
                    if (errMsg.includes("Failed to fetch") || errMsg.includes("net::")) {
                        errorEl.textContent = "Network error—please try again.";
                    } else if (errMsg.includes("Could not establish connection. Receiving end does not exist.")) {
                        errorEl.textContent = "Error: Extension context invalidated. Please reload the extension or tab.";
                    } else {
                        errorEl.textContent = `Error: ${errMsg}`;
                    }
                    statusEl.textContent = '';
                    submitBtn.disabled = false;
                    return;
                }
                if (response) {
                    if (response.success) {
                        statusEl.textContent = 'Text rewritten!';
                        // Optionally, close popup or give other feedback
                        // For instance, the original code had: setTimeout(() => window.close(), 1500);
                    } else {
                        let displayError = response.error || 'Unknown error from background.';
                        // Improved error message parsing from user's code
                        if (displayError.startsWith("API Error 5")) {
                            displayError = "Network error with API—please try again.";
                        } else if (displayError.includes("Content blocked:")) {
                            // message is already good
                        } else if (displayError.startsWith("API Error")) {
                             displayError = displayError.replace(/^API Error \d+: /, ''); // Clean up generic API error prefixes
                             displayError = displayError.replace(/^Error: /, '');
                        }
                        errorEl.textContent = displayError;
                        statusEl.textContent = '';
                    }
                } else {
                    errorEl.textContent = "No response from background script.";
                    statusEl.textContent = '';
                }
                submitBtn.disabled = false;
            }
        );
    });
});