import { BaseRetriever } from "@langchain/core/retrievers";
import { Document } from 'langchain/document';
import { Collection, EmbeddingFunction } from 'chromadb';

export class ChromaRetriever extends BaseRetriever {
  private collection: Collection;
  private embeddings: EmbeddingFunction;

  constructor(collection: Collection, embeddings: EmbeddingFunction) {
    super();
    this.collection = collection;
    this.embeddings = embeddings;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const queryEmbedding = await this.embeddings.generate([query]);
    
    const results = await this.collection.query({
      queryEmbeddings: queryEmbedding,
      nResults: 3,
      include: ['metadatas', 'documents', 'distances'],
    });

    const documents: Document[] = [];
    
    if (results.metadatas && results.metadatas[0]) {
      for (const metadata of results.metadatas[0]) {
        if (metadata.text) {
          documents.push(new Document({
            pageContent: metadata.text,
            metadata
          }));
        }
      }
    }

    return documents.length > 0
      ? documents
      : [new Document({ 
          pageContent: "GENERAL_QUERY_FLAG", 
          metadata: { isGeneral: true } 
        })];
  }
}