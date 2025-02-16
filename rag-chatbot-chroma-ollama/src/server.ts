import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChromaClient } from 'chromadb';
import { Ollama } from '@langchain/community/llms/ollama';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChromaRetriever } from './chromaRetriever';
import ElevenLabs from 'elevenlabs-node';
import { Document } from '@langchain/core/documents';
import { PromptTemplate } from "@langchain/core/prompts";
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { OllamaEmbeddingWrapper } from './ollamaEmbeddingWrapper';
import fs from 'fs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = 3000;

// Initialize ChromaDB with proper configuration
const client = new ChromaClient({
  path: 'http://localhost:8000'
});

// Initialize Ollama
const llm = new Ollama({
  baseUrl: process.env.OLLAMA_BASE_URL,
  model: process.env.OLLAMA_MODEL || 'llama2',
  temperature: 0.2,
  numCtx: 2048,
  numPredict: 100,
});

// Initialize Eleven Labs with streaming support
const voice = new ElevenLabs({
  apiKey: process.env.ELEVEN_LABS_API_KEY || '',
});

// Initialize Ollama embeddings instead of OpenAI
const embeddings = new OllamaEmbeddings({
  baseUrl: process.env.OLLAMA_BASE_URL,
  model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
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

// Add this after the formatDocuments function
const systemMessage = `You are the City of Ottawa's official AI assistant. Your primary role is to help residents with municipal services information.

Follow these rules:
1. For service-related questions, ALWAYS use the provided context
2. Answer concisely using only verified information
3. Never add extra commentary or examples`;

// Create a chain that combines retrieval and generation
const chain = RunnableSequence.from([
  async (input: { query: string }) => {
    const docs = await retriever.getRelevantDocuments(input.query);
    console.log(`Retrieved ${docs.length} relevant documents`);
    return {
      context: formatDocuments(docs),
      question: input.query,
    };
  },
  PromptTemplate.fromTemplate(`SYSTEM: ${systemMessage}

CONTEXT: {context}

USER QUESTION: {question}

RESPONSE RULES:
- Use ONLY the provided context
- Answer in 1-2 sentences
- No markdown formatting
- If no context matches, say "I don't have that information"

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
    let audioBuffer = '';  // Buffer for audio generation
    
    // Stream text response
    const stream = await chain.stream({ query: message });
    
    for await (const chunk of stream) {
      if (chunk) {
        textBuffer += chunk;
        audioBuffer += chunk;
        res.write(JSON.stringify({ type: 'text', content: chunk }) + '\n');

        // Only generate audio when we have a substantial chunk (e.g., after punctuation)
        if (voiceEnabled && (chunk.includes('.') || chunk.includes('!') || chunk.includes('?'))) {
          try {
            const fileName = `chunk-${Date.now()}.mp3`;
            await voice.textToSpeech({
              textInput: audioBuffer,
              voiceId: process.env.ELEVEN_LABS_VOICE_ID || 'XrExE9yKIg1WjnnlVkGX',
              modelId: "eleven_flash_v2_5",
              fileName: fileName
            });

            // Read and send the audio file
            const audioData = fs.readFileSync(fileName);
            const base64Audio = audioData.toString('base64');
            fs.unlinkSync(fileName);  // Clean up the file

            res.write(JSON.stringify({
              type: 'audio',
              content: base64Audio,  // Send the audio data, not the text
              isFinal: false
            }) + '\n');

            audioBuffer = '';
          } catch (audioError) {
            console.error('Audio generation failed:', audioError);
          }
        }
      }
    }
    
    // Generate final audio for any remaining text
    if (voiceEnabled && audioBuffer) {
      try {
        const fileName = `chunk-${Date.now()}.mp3`;
        await voice.textToSpeech({
          textInput: audioBuffer,
          voiceId: process.env.ELEVEN_LABS_VOICE_ID || 'XrExE9yKIg1WjnnlVkGX',
          modelId: "eleven_flash_v2_5",
          fileName: fileName
        });

        res.write(JSON.stringify({ 
          type: 'audio', 
          content: audioBuffer,
          isFinal: true 
        }) + '\n');
      } catch (audioError) {
        console.error('Audio generation failed:', audioError);
      }
    }
    
    res.end();
  } catch (error) {
    console.error('Error:', error);
    res.write(JSON.stringify({ type: 'text', content: 'An error occurred while processing your request.' }) + '\n');
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});