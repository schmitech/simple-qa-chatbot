# QA Chatbot Server

A Node.js server for RAG (Retrieval Augmented Generation) chatbot with text-to-speech capabilities.

## Prerequisites

- Node.js (v16 or higher)
- Python (for ChromaDB)
- An ElevenLabs API key (for text-to-speech)
- Ollama installed locally
- ChromaDB installed locally or in a container

## Setup as Server

1. Install dependencies
```bash
npm install
```

2. Set up environment variables (copy from .env.example)


3. Start ChromaDB (in simple-qa-chatbot terminal venv)
```bash
chroma run --host localhost --port 8000 --path ./chroma_db
```

4. Ingest data (in another simple-qa-chatbot terminal)
```bash
python ./chatbot-server/chroma-utils/create-chroma-collection.py qa_pairs.json
```
4.1 Test ingested data, example:
```bash
python ./chatbot-server/chroma-utils/query-chroma-collection.py "Where can I view the assessment roll for my property taxes in Ottawa?"
```

5. Start the chatbot-server (in chatbot-server terminal)
```bash
cd chatbot-server
npm install
npm run dev
```

6. Start chatbot UI (in chatbot-app terminal)
```bash
cd chatbot-app
npm install
npm run dev
```

## Usage as Package (see chatbot-app for example of usage)

1. Install in your project:
```bash
npm install file:../path/to/chatbot-server
# or if published:
# npm install chatbot-server
```

2. Import and use:
```typescript
import { ChatbotClient, StreamResponse } from 'chatbot-server';

const client = new ChatbotClient('http://localhost:3000');

async function chat() {
  try {
    for await (const response of client.streamChat({
      message: "Hello",
      voiceEnabled: true
    })) {
      if (response.type === 'text') {
        console.log(response.content);
      } else if (response.type === 'audio') {
        // Handle audio response (base64 encoded)
        playAudio(response.content);
      }
    }
  } catch (error) {
    console.error('Chat error:', error);
  }
}

```

## API Types

```typescript
interface StreamResponse {
  type: 'text' | 'audio';
  content: string;
  isFinal?: boolean;
}
```

## Environment Variables

See `.env.example` for all configuration options.