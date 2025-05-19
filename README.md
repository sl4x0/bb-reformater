# BB-Reformater: One-Click Text Rewriting for Bug Bounty Hunters

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/sl4x0/bb-reformater?style=social)](https://github.com/sl4x0/bb-reformater/stargazers)

> ⚡ **Stop wasting time switching to ChatGPT!** BB-Reformater lets you rewrite text directly from any webpage with a single click.

A Chrome extension built by bug bounty hunters, for bug bounty hunters. Instantly improve your reports and communications without leaving your workflow.

### ✨ Key Benefits:s
- **No more copy-pasting** to external tools
- **One-click rewriting** of any selected text
- **Works everywhere** - forms, textareas, and rich text editors
- **Lightning fast** - get polished text in seconds
- **Privacy focused** - your data stays on your machine until sent to Gemini API

💡 **Perfect for non-native English speakers** who want to sound professional in their bug reports and communications.

## 🚀 How It Works

1. **Select text** on any webpage (vulnerability description, report, email, etc.)
2. **Click the extension icon** in your browser toolbar
3. **Add instructions** (optional) like "make more professional" or "fix grammar"
4. **Click Rewrite** - your text is instantly improved

### 📝 Common Use Cases

- **Bug Reports** - Make your findings clear and professional
- **Emails to Security Teams** - Ensure clear communication
- **Proof of Concepts** - Improve technical explanations
- **Documentation** - Make your writeups more readable
- **Responses to Triagers** - Answer questions professionally

### ⚙️ Technical Details

- **AI Model**: Gemini 2.5 Pro Preview 05-06
- **Privacy**: Your data is only sent to Gemini API
- **Compatibility**: Works on all major bug bounty platforms
- **Lightweight**: Minimal impact on browser performance

## 🛠️ Installation (30 Seconds)

1. **Get a Gemini API Key** (free):
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create an API key and copy it

2. **Set up the extension**:
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/bb-reformater.git
   cd bb-reformater/bb-reformater  # Go to extension directory
   
   # Edit `background.js` and add your API key
   # (Look for 'YOUR_API_KEY_HERE' near the top of the file)
   ```

3. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top-right)
   - Click "Load unpacked" and select the `bb-reformater` directory

🎉 Done! The extension is ready to use.

## 🎥 Quick Demo

1. Select text on any webpage
2. Click the BB-Reformater icon
3. Add instructions (optional)
4. Click "Rewrite"
5. Your improved text appears instantly

No more switching tabs or copy-pasting to ChatGPT!

## 🛠️ Development

## 🏗️ For Developers

### Project Structure
```
bb-reformater/
├── background.js        # Handles API communication
├── content.js          # Manages text selection
├── popup.js            # Popup interface logic
├── popup.html          # Popup UI
├── manifest.json       # Extension config
└── icon/               # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ by [@sl4x0](https://x.com/sl4x0) for the bug bounty community
</div>