# Agent Chat

A simple terminal-based chat interface using OpenAI.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the `agent` directory:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to the `.env` file:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

## Usage

Run the chat agent:
```bash
npm run chat
```

Or directly:
```bash
node agent/index.js
```

Type your messages and press Enter. Type "exit" or "quit" to end the conversation.
