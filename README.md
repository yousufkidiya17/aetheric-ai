# 🌟 Aetheric — AI Service Marketplace

![GitHub release (latest by date)](https://img.shields.io/github/v/release/yousufkidiya17/aetheric-ai?style=flat-square)
![GitHub license](https://img.shields.io/github/license/yousufkidiya17/aetheric-ai?style=flat-square)
![Node Version](https://img.shields.io/badge/node-18%2B-blue?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)
<p align="left">
  <img src="https://komarev.com/ghpvc/?username=yousufkidiya17&label=Views&color=blue&style=flat-square" alt="yousufkidiya17" />
</p>

AI-powered service marketplace. Order food, book rides, hire workers — all through voice and chat.

## 🚀 Deploy to Render.com (One Click)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## Features ✨

- 🍕 **Order Food** — Mock Zomato/Swiggy functionality
- 🚕 **Book Rides** — Mock Ola/Uber ride booking
- 🔧 **Hire Workers** — Find Electrician, Plumber, Tutor
- 🎤 **Voice Input** — Web Speech API integration
- ⚡ **Real-time Updates** — WebSocket notifications
- 🤖 **AI Powered Chat** — Mistral AI integration

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/yousufkidiya17/aetheric-ai.git
cd aetheric-ai
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Add your API keys in `.env`:
```
MISTRAL_API_KEY=your_mistral_api_key_here
```

5. Start the server:
```bash
npm start
```

## 🌐 Environment Variables

| Variable | Description |
|----------|-------------|
| `MISTRAL_API_KEY` | Your Mistral AI API key |

## 📁 Project Structure

```
aetheric-ai/
├── public/          # Static files
├── server.js        # Main server file
├── models.js        # Data models
├── package.json     # Dependencies
├── .env.example     # Environment template
└── README.md        # This file
```

## 🤝 Contributing

PRs are welcome! Feel free to fork and improve this project.

## 📜 License

MIT License. Feel free to use and modify for your own projects.
