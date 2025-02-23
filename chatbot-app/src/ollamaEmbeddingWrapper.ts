import type { EmbeddingFunction } from 'chromadb';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';

export class OllamaEmbeddingWrapper implements EmbeddingFunction {
  private embeddings: OllamaEmbeddings;

  constructor(embeddings: OllamaEmbeddings) {
    this.embeddings = embeddings;
  }

  async generate(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }
} 