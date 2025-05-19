// Configuration - Set your Gemini API key here
// Get your API key from: https://makersuite.google.com/app/apikey
const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';

// Don't edit below this line
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "rewriteText":
      { // Block scope for variable declarations
        const { selectedText, userPrompt, frameId } = request; // Added frameId

        // Check if API key is set
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
          console.error("Please set your Gemini API key in background.js");
          sendResponse({ success: false, error: "API Key not set. Please edit background.js and add your Gemini API key." });
          return true;
        }

        // Define a System Prompt to guide Gemini's behavior
        // Note: The leading space on the first line of the template literal is intentional for multiline strings.
        // The actual string sent to Gemini will not have this leading space if the first line of content starts at the beginning of the line.
        // However, for readability and to avoid Gemini interpreting indentation within the prompt itself, it's often kept like this.
        // If you want to be absolutely sure about no leading/trailing whitespace from the template itself, you can .trim() it before sending.
        const systemPromptContent = `
You are a precise text-rewriting assistant. Your job is simple: take the user's “Selected Text” and transform it according to the user's “User Instruction.”

🔹 Response rules:
    1. Return exactly one rewritten result—no alternatives.
    2. No preamble, no explanations, no apologies.
    3. Only include explanations if the user explicitly asked for them.
    4. Only include formatting tips (e.g. Markdown code blocks) if the user's instruction calls for formatting.
    5. Keep tone, style, and register aligned with the user's instruction (professional, casual, Gen Z, etc.).

Now rewrite:

User Instruction: “${userPrompt}”s
Selected Text:
“${selectedText}”
`;
        // Construct the full prompt to be sent
        const promptForAPI = systemPromptContent.trim(); // Trim to remove potential leading/trailing whitespace from the template literal definition

        fetch(GEMINI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: promptForAPI // Use the constructed prompt
              }]
            }]
            // You might also consider adding generationConfig here for more control
            // "generationConfig": {
            //   "temperature": 0.2, // Lower for more directness, less creativity
            //   "maxOutputTokens": 500 // Limit output length if needed
            // }
          })
        })
          .then(response => {
            if (!response.ok) {
              return response.json().then(errData => {
                throw new Error(`API Error ${response.status}: ${errData.error?.message || response.statusText}`);
              }).catch(() => {
                throw new Error(`API Error ${response.status}: ${response.statusText}`);
              });
            }
            return response.json();
          })
          .then(data => {
            console.log("Gemini API Response:", data);
            if (data.candidates && data.candidates.length > 0 &&
              data.candidates[0].content && data.candidates[0].content.parts &&
              data.candidates[0].content.parts.length > 0) {
              const rewrittenText = data.candidates[0].content.parts[0].text;

              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                  const messageOptions = frameId !== null && frameId !== undefined ? { frameId: frameId } : {};
                  chrome.tabs.sendMessage(tabs[0].id, {
                    action: "replaceSelectedText",
                    newText: rewrittenText
                  }, messageOptions, (responseFromContent) => {
                    if (chrome.runtime.lastError) {
                      console.error("Error sending to content script for replacement:", chrome.runtime.lastError.message);
                      let detailError = chrome.runtime.lastError.message;
                      if (detailError && detailError.includes("Could not establish connection")) {
                        sendResponse({ success: false, error: "Failed to connect to the page content. Try reloading the tab." });
                      } else {
                        sendResponse({ success: false, error: "Failed to communicate with content script for replacement: " + detailError });
                      }
                    } else if (responseFromContent && responseFromContent.success) {
                      sendResponse({ success: true });
                    } else {
                      let detail = (responseFromContent && responseFromContent.error) ? responseFromContent.error : "Content script failed to replace text or no suitable element found.";
                      if (detail === "No actionable selection in this frame.") {
                        detail = "Could not find the selected text on the page to replace it. It might have changed or is in a different frame.";
                      }
                      sendResponse({ success: false, error: detail });
                    }
                  });
                } else {
                  sendResponse({ success: false, error: "No active tab found to replace text." });
                }
              });
            } else {
              let errorMessage = "No valid text found in API response.";
              if (data.promptFeedback && data.promptFeedback.blockReason) {
                errorMessage = `Content blocked: ${data.promptFeedback.blockReason}`;
                if (data.promptFeedback.safetyRatings) {
                  const harmfulCategories = data.promptFeedback.safetyRatings
                    .filter(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW')
                    .map(r => r.category);
                  if (harmfulCategories.length > 0) {
                    errorMessage += ` (Categories: ${harmfulCategories.join(', ')})`;
                  }
                }
              } else if (data.candidates && data.candidates.length > 0 && data.candidates[0].finishReason) {
                errorMessage = `Generation finished with reason: ${data.candidates[0].finishReason}`;
              }
              console.error("Gemini API response error:", errorMessage, data);
              sendResponse({ success: false, error: errorMessage });
            }
          })
          .catch(error => {
            console.error('Error calling Gemini API:', error);
            sendResponse({ success: false, error: error.message || "Network or API call failed." });
          });

        return true; // Indicates that the response will be sent asynchronously for this case.
      } // End of case "rewriteText"

    case "getSelectedText":
      console.warn("getSelectedText action received by background.js, but should be handled by content.js.");
      sendResponse({ success: false, error: "getSelectedText should be handled by content script." });
      // This is a synchronous response; no 'return true' here needed if main listener returns true.
      break;

    case "replaceSelectedText":
      console.warn("replaceSelectedText action received by background.js directly, which is unusual.");
      sendResponse({ success: false, error: "replaceSelectedText is an internal action or handled by content script." });
      break;

    default:
      console.warn(`Unhandled action in background.js: ${request.action}`);
      sendResponse({ success: false, error: `Unhandled action: ${request.action}` });
      break;
  }
  // Return true from the listener to keep the message channel open for async responses from any case.
  return true;
});