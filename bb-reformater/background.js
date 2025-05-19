// Configuration - Set your Gemini API key here
// Get your API key from: https://makersuite.google.com/app/apikey
const GEMINI_API_KEY = 'GEMINI_API_KEY';

// Don't edit below this line
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Handle content script injection and message sending
async function injectAndSendMessage(tabId, frameId, rewrittenText, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      sendResponse({ success: false, error: "No active tab found to replace text." });
      return;
    }
    
    const messageOptions = frameId !== null && frameId !== undefined ? { frameId } : {};
    
    // Prepare the injection target
    const execScriptTarget = { tabId };
    if (frameId !== null && frameId !== undefined && frameId !== 0) {
      execScriptTarget.frameIds = [frameId];
    }
    
    console.log("Injecting content script with target:", execScriptTarget);
    
    // Inject the content script
    await chrome.scripting.executeScript({
      target: execScriptTarget,
      files: ['content.js']
    });
    
    console.log("Content script injected, waiting for initialization...");
    
    // Small delay to ensure content script is ready
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log("Sending message with options:", messageOptions);
    
    const message = {
      action: "replaceSelectedText",
      newText: rewrittenText
    };
    
    console.log("Sending message:", message);
    
    // Send message with timeout
    const response = await new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({ error: "Content script response timeout" });
      }, 5000);
      
      chrome.tabs.sendMessage(
        tabId, 
        message,
        messageOptions,
        (response) => {
          clearTimeout(timeoutId);
          resolve(response || {});
        }
      );
    });
    
    if (chrome.runtime.lastError) {
      throw new Error(chrome.runtime.lastError.message);
    }
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    if (response.success) {
      sendResponse({ success: true });
    } else {
      let detail = response.error || "Content script failed to replace text or no suitable element found.";
      if (detail === "No actionable selection in this frame.") {
        detail = "Could not find the selected text on the page to replace it. It might have changed or is in a different frame.";
      }
      throw new Error(detail);
    }
    
  } catch (error) {
    console.error("Error in content script communication:", error);
    let errorMessage = error.message || "Unknown error";
    
    if (errorMessage.includes("Could not establish connection")) {
      errorMessage = "Failed to connect to the page content. Try reloading the tab.";
    } else if (errorMessage.includes("inject content script")) {
      errorMessage = "Failed to inject content script. Please try reloading the page.";
    }
    
    sendResponse({ 
      success: false, 
      error: errorMessage 
    });
  }
}

// Main message listener
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
You are an expert text-rewriting assistant specializing in helping bug bounty hunters communicate like native English speakers. Your primary goal is to transform the user's "Selected Text" according to their "User Instruction" while ensuring perfect grammar, natural syntax, and professional clarity.

🔹 Response rules:
    1. Return exactly one rewritten result—no alternatives.
    2. No preamble, no explanations, no apologies.
    3. Only include explanations if the user explicitly asked for them.
    4. Only include formatting tips (e.g. Markdown code blocks) if the user's instruction calls for formatting.
    5. Keep tone, style, and register aligned with the user's instruction (professional, casual, Gen Z, etc.).

🔹 Language improvement guidelines:
    1. Fix all grammar, spelling, and punctuation errors to native-level English.
    2. Restructure awkward sentences to sound natural and fluent.
    3. Preserve all technical terms, CVE numbers, and security concepts exactly as written.
    4. Maintain the original meaning and technical details while improving clarity.
    5. Use professional security industry terminology and phrasing when appropriate.
    6. For vulnerability reports: ensure clear impact descriptions and concise reproduction steps.
    7. For communications: maintain a respectful, confident tone appropriate for security professionals.
    8. If no specific instruction is given, default to making the text sound professional and native.

Now rewrite:

User Instruction: "${userPrompt}"
Selected Text:
"${selectedText}"
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

              console.log("Preparing to send message to content script...");
              
              // Get the active tab
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) {
                  sendResponse({ success: false, error: "No active tab found to replace text." });
                  return;
                }
                
                const tabId = tabs[0].id;
                
                // Call the helper function to handle injection and messaging
                injectAndSendMessage(tabId, frameId, rewrittenText, sendResponse);
              });
              
              // Return true to indicate we'll respond asynchronously
              return true;
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