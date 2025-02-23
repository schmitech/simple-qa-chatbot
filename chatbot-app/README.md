# AI Q/A Chatbot

A conversational AI assistant, featuring text-to-speech capabilities.

## Prerequisites

- Node.js (v16 or higher)
- Python (for ChromaDB)
- An ElevenLabs API key (for text-to-speech)
- Ollama installed locally
- ChromaDB installed locally or in a server or in a container

## Setup

1. Clone the repository
```bash
git clone https://github.com/schmitech/simple-qa-chatbot.git
cd simple-qa-chatbot
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Create a `.env` file in the root directory with (copy from .env.example):
```env
ELEVEN_LABS_API_KEY=your_elevenlabs_api_key
ELEVEN_LABS_VOICE_ID=XrExE9yKIg1WjnnlVkGX  # or your preferred voice ID
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
CHROMA_COLLECTION=qa-chatbot
```

## Running the Application

1. Start ChromaDB (in a separate terminal)
```bash
chroma run --host localhost --port 8000 --path ./chroma_db
```

2. Start the server (in a separate terminal)
```bash
npm run server
```

3. Start the client (in a separate terminal)
```bash
npm run dev
```

The application should now be running at `http://localhost:5173`

## Testing Text-to-Speech

You can test your ElevenLabs API key with:
```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/XrExE9yKIg1WjnnlVkGX" \
  -H "xi-api-key: $ELEVEN_LABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test audio generation", "model_id": "eleven_monolingual_v1"}' \
  --output test.mp3
```

## Features

- Real-time chat interface
- Text-to-speech capability using ElevenLabs
- Context-aware responses using ChromaDB
- Local LLM support via Ollama

## Troubleshooting

- If ChromaDB fails to start, ensure the `--path` directory exists
- If text-to-speech isn't working, verify your ElevenLabs API key
- For Ollama issues, ensure the service is running (`ollama serve`)

## License

[Your license information here]