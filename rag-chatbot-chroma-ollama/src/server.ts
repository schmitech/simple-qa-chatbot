import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChromaClient } from 'chromadb';
import { Ollama } from '@langchain/community/llms/ollama';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChromaRetriever } from './chromaRetriever';
import { Document } from '@langchain/core/documents';
import { PromptTemplate } from "@langchain/core/prompts";
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { OllamaEmbeddingWrapper } from './ollamaEmbeddingWrapper';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add this before dotenv.config()
const envVarsToReset = [
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'OLLAMA_EMBED_MODEL',
  'CHROMA_HOST',
  'CHROMA_COLLECTION',
  'ELEVEN_LABS_API_KEY',
  'ELEVEN_LABS_VOICE_ID'
];

envVarsToReset.forEach(variable => {
  if (process.env[variable]) {
    console.log(`Clearing existing ${variable}`);
    delete process.env[variable];
  }
});

// Add after path resolution but before dotenv.config()
try {
  const envPath = path.resolve(__dirname, '../.env');
  console.log('Loading .env from:', envPath);
  
  // const envContents = await fs.readFile(envPath, 'utf-8');
  // console.log('.env file contents:\n', envContents);
} catch (error) {
  console.error('Error reading .env file:', error);
  process.exit(1);
}

// Then load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Add this logging block after dotenv.config()
console.log('Environment Variables:');
console.log({
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  OLLAMA_EMBED_MODEL: process.env.OLLAMA_EMBED_MODEL,
  OLLAMA_TEMPERATURE: process.env.OLLAMA_TEMPERATURE,
  CHROMA_HOST: process.env.CHROMA_HOST,
  CHROMA_COLLECTION: process.env.CHROMA_COLLECTION,
  // Masking sensitive data
  ELEVEN_LABS_API_KEY: process.env.ELEVEN_LABS_API_KEY ? '****' : undefined,
  ELEVEN_LABS_VOICE_ID: process.env.ELEVEN_LABS_VOICE_ID
});

// Add this after the environment variables log
async function verifyOllamaConnection() {
  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    console.log('Ollama connection successful');
  } catch (error) {
    console.error('Ollama connection failed:', error);
    process.exit(1);
  }
}

// Add this before initializing the Ollama client
await verifyOllamaConnection();

const app = express();
app.use(cors());
app.use(express.json());

const port = 3000;

// Initialize ChromaDB with proper configuration
const client = new ChromaClient({
    path: `http://${process.env.CHROMA_HOST}:8000`
  });

// Initialize Ollama with more aggressive optimization
const llm = new Ollama({
  baseUrl: process.env.OLLAMA_BASE_URL,
  model: process.env.OLLAMA_MODEL || 'llama2',
  temperature: process.env.OLLAMA_TEMPERATURE ? parseFloat(process.env.OLLAMA_TEMPERATURE) : 0.1,
  numCtx: 2048,
  numPredict: 150,
  numThread: 8,
  // Add verbose mode and custom fetch for logging
  verbose: true,
  fetch: async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.url;
    console.log('\n--- Ollama API Call ---');
    console.log('Endpoint:', url.replace(process.env.OLLAMA_BASE_URL!, ''));
    
    if (init?.body) {
      const body = JSON.parse(init.body.toString());
      console.log('Payload:', {
        model: body.model,
        prompt: body.prompt?.substring(0, 50) + '...', // Show first 50 chars of prompt
        options: body.options
      });
    }
    
    const start = Date.now();
    const response = await fetch(input, init);
    console.log(`Duration: ${Date.now() - start}ms`);
    console.log('Status:', response.status);
    
    return response;
  }
} as any);

// Initialize Ollama embeddings instead of OpenAI
const embeddings = new OllamaEmbeddings({
  baseUrl: process.env.OLLAMA_BASE_URL,
  model: process.env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large',
});

// Create the wrapper instance
const embeddingWrapper = new OllamaEmbeddingWrapper(embeddings);

// Use the wrapper in Chroma collection methods
let collection;
try {
  collection = await client.createCollection({
    name: process.env.CHROMA_COLLECTION || 'qa-chatbot',
    embeddingFunction: embeddingWrapper,
    metadata: { "hnsw:space": "cosine" }
  });
} catch (error) {
  collection = await client.getCollection({
    name: process.env.CHROMA_COLLECTION || 'qa-chatbot',
    embeddingFunction: embeddingWrapper
  });
}

const retriever = new ChromaRetriever(collection, embeddingWrapper);

// Helper function to format documents as string
const formatDocuments = (docs: Document[]): string => {
  if (docs[0]?.metadata?.isGeneral) return 'NO_RELEVANT_CONTEXT';
  return docs.map(doc => doc.pageContent).join('\n\n');
};

// Create a chain that combines retrieval and generation
const chain = RunnableSequence.from([
  async (input: { query: string }) => {
    const docs = await retriever.getRelevantDocuments(input.query);
    return {
      context: formatDocuments(docs),
      question: input.query,
    };
  },
  PromptTemplate.fromTemplate(`CONTEXT: {context}

USER QUESTION: {question}

ANSWER:
`),
  llm,
  new StringOutputParser(),
]);

app.post('/chat', async (req, res) => {
  const { message, voiceEnabled } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    let textBuffer = '';
    let isFirstChunk = true;
    
    const stream = await chain.stream({ query: message });
    
    for await (const chunk of stream) {
      if (chunk) {
        textBuffer += chunk;
        res.write(JSON.stringify({ type: 'text', content: chunk }) + '\n');

        // Wait for first substantial chunk
        if (voiceEnabled && isFirstChunk && textBuffer.length >= 100) {
          const currentText = textBuffer;
          textBuffer = '';
          isFirstChunk = false;

          // Add delay before starting audio
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            await generateAudioChunk(currentText, res);
          } catch (error) {
            console.error('First chunk audio generation failed:', error);
          }
        }
        // For subsequent chunks, wait for complete sentences and add delay
        else if (voiceEnabled && !isFirstChunk && (
          (textBuffer.match(/[.!?]\s*$/) && textBuffer.length >= 50) ||
          textBuffer.length >= 150
        )) {
          const currentText = textBuffer;
          textBuffer = '';

          // Add delay between chunks
          await new Promise(resolve => setTimeout(resolve, 800));
          try {
            await generateAudioChunk(currentText, res);
          } catch (error) {
            console.error('Audio generation failed:', error);
          }
        }
      }
    }
    
    // Handle any remaining text
    if (voiceEnabled && textBuffer.trim()) {
      await new Promise(resolve => setTimeout(resolve, 800));
      try {
        await generateAudioChunk(textBuffer.trim(), res, true);
      } catch (error) {
        console.error('Final chunk audio generation failed:', error);
      }
    }
    
    res.end();
  } catch (error) {
    console.error('Error:', error);
    res.write(JSON.stringify({ type: 'text', content: 'An error occurred while processing your request.' }) + '\n');
    res.end();
  }
});

async function generateAudioChunk(text: string, res: any, isFinal: boolean = false) {
  console.log('Generating audio for:', text);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_LABS_VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVEN_LABS_API_KEY || '',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v1',
        voice_settings: {
          stability: 0.7,              // Increased for more stable speech
          similarity_boost: 0.8,       // Increased for better voice consistency
          speaking_rate: 1.0,          // Normal speaking rate
          style: 0.25,                 // Reduced for more natural delivery
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Audio generation failed: ${response.status} ${response.statusText}`);
  }
    
  const audioBuffer = await response.arrayBuffer();
  const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
  console.log('Audio generated successfully, length:', base64Audio.length);

  res.write(JSON.stringify({
    type: 'audio',
    content: base64Audio,
    isFinal,
  }) + '\n');
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});