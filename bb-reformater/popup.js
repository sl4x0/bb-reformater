// Function to be injected into frames to get selected text
function getSelectionFromFrame() {
    return window.getSelection().toString().trim();
}

// Helper functions
function updateSubmitButton(hasSelectedText) {
    submitBtn.disabled = !hasSelectedText;
}

function displayError(message) {
    errorEl.textContent = message;
    // Add 'active' class to trigger fade-in
    errorEl.classList.add('active');
    statusEl.textContent = '';
    statusEl.classList.remove('active', 'glitching');
}

function displayStatus(message) {
    statusEl.textContent = message;
    // Add 'active' and 'glitching' classes to trigger fade-in and animation
    statusEl.classList.add('active', 'glitching');
    errorEl.textContent = '';
    errorEl.classList.remove('active');
}

function clearStatus() {
    statusEl.textContent = '';
    errorEl.textContent = '';
    // Remove 'active' class to trigger fade-out
    statusEl.classList.remove('active', 'glitching');
    errorEl.classList.remove('active');
}

// Initialize variables
let currentSelectedText = '';
let sourceFrameId = null;

// DOM Elements
let form, selectedTextEl, userPromptEl, submitBtn, statusEl, errorEl;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    form = document.getElementById('rewriteForm');
    selectedTextEl = document.getElementById('selectedText');
    userPromptEl = document.getElementById('userPrompt');
    submitBtn = document.getElementById('submitBtn');
    statusEl = document.getElementById('status');
    errorEl = document.getElementById('error');

    // Clear status when user types
    userPromptEl.addEventListener('input', clearStatus);

    // Get selected text from the active tab, checking all frames
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            displayError("Could not find active tab.");
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
                    displayError("Error getting text. Make sure you've selected some text on the page.");
                    console.error("executeScript error:", chrome.runtime.lastError.message);
                    return;
                }

                let foundText = '';
                if (injectionResults && injectionResults.length > 0) {
                    for (const frameResult of injectionResults) {
                        if (frameResult.result && typeof frameResult.result === 'string' && frameResult.result.trim() !== '') {
                            foundText = frameResult.result.trim();
                            sourceFrameId = frameResult.frameId;
                            break;
                        }
                    }
                }

                if (foundText) {
                    currentSelectedText = foundText;
                    selectedTextEl.value = foundText;
                    clearStatus(); // Clear initial status/error
                    submitBtn.disabled = false; // Enable button when text is selected
                } else {
                    selectedTextEl.value = '';
                    displayError("No text selected on the page or in any iframe.");
                    submitBtn.disabled = true;
                }
            }
        );
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentSelectedText) {
            displayError('No text was selected.');
            return;
        }

        const prompt = userPromptEl.value.trim();
        displayStatus('Processing...');
        submitBtn.disabled = true;

        // Use default system prompt if user didn't provide one
        const finalPrompt = prompt || "Please improve the formatting and clarity of this text while maintaining its original meaning.";

        try {
            const response = await new Promise((resolve, reject) => {
                const messageTimeout = setTimeout(() => {
                    reject(new Error("Request timed out. Please try again."));
                }, 30000); // 30 second timeout

                chrome.runtime.sendMessage(
                    {
                        action: "rewriteText",
                        selectedText: currentSelectedText,
                        userPrompt: finalPrompt,
                        frameId: sourceFrameId
                    },
                    (response) => {
                        clearTimeout(messageTimeout);
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(response);
                        }
                    }
                );
            });

            if (response.success) {
                // Get the text from the correct path in Gemini's response
                const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
                // Remove any surrounding quotes from the response text
                const cleanText = responseText.replace(/^"|"$/g, '');

                displayStatus('Text rewritten!'); // Keep status message for a moment

                // Send the cleaned text back to replace the selection
                chrome.runtime.sendMessage(
                    {
                        action: "replaceSelectedText",
                        newText: cleanText,
                        frameId: sourceFrameId
                    }
                );
                // Optionally close popup after success
                setTimeout(() => window.close(), 1500);
            } else {
                let displayErrorMsg = response.error || 'Unknown error from background.';
                if (displayErrorMsg.startsWith("API Error 5")) {
                    displayErrorMsg = "Network error with API—please try again.";
                } else if (displayErrorMsg.includes("Content blocked:")) {
                    // message is already good
                } else if (displayErrorMsg.startsWith("API Error")) {
                    displayErrorMsg = displayErrorMsg.replace(/^API Error \d+: /, '');
                    displayErrorMsg = displayErrorMsg.replace(/^Error: /, '');
                }
                displayError(displayErrorMsg);
            }
        } catch (error) {
            let errorMessage = error.message || "Unknown error occurred.";
            if (errorMessage.includes("Failed to fetch") || errorMessage.includes("net::")) {
                errorMessage = "Network error—please try again.";
            } else if (errorMessage.includes("Could not establish connection")) {
                errorMessage = "Couldn't link up to the page. Maybe try refreshin'?";
            }
            displayError(errorMessage);
        } finally {
            submitBtn.disabled = false;
        }
    });
});