import os
import sys
from langchain_ollama import OllamaEmbeddings
import chromadb
from dotenv import load_dotenv

def test_chroma_ingestion(ollama_base_url: str, test_query: str):
    # Initialize client with HTTP connection instead of persistent storage
    client = chromadb.HttpClient(host="localhost", port=8000)
    
    # Get the collection
    collection_name = os.getenv("CHROMA_COLLECTION")
    if not collection_name:
        raise ValueError("CHROMA_COLLECTION environment variable is not set")
    collection = client.get_collection(name=collection_name)
    
    # Initialize the same embeddings model used in ingestion
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",
        base_url=ollama_base_url
    )
    
    # Get total count
    total_records = collection.count()
    print(f"\nTotal records in collection: {total_records}")
    
    # Perform the query
    query_embedding = embeddings.embed_query(test_query)
    
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=3,
        include=['metadatas', 'documents', 'distances']
    )
    
    # Print results
    print("\nTest Query Results:")
    print(f"Query: '{test_query}'\n")
    
    if results['metadatas'] and results['metadatas'][0]:
        # Only show the closest match
        closest_match = results['metadatas'][0][0]
        print("Answer:")
        print(closest_match['answer'])
        print(f"\nConfidence: {1 - results['distances'][0][0]:.2%}")
    else:
        print("No results found")

if __name__ == "__main__":
    # Load environment variables
    load_dotenv()
    
    ollama_base_url = os.getenv("OLLAMA_HOST")
    if not ollama_base_url:
        raise ValueError("OLLAMA_HOST environment variable is not set")
    
    # Get query from command line argument, or use default
    test_query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "What are the parking rules?"
    
    test_chroma_ingestion(ollama_base_url, test_query)