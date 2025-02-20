import os
import sys
from langchain_ollama import OllamaEmbeddings
import chromadb
from dotenv import load_dotenv

def test_chroma_ingestion(ollama_base_url: str, test_query: str):
    # Print environment variables being used
    print("\nEnvironment Variables:")
    print(f"OLLAMA_BASE_URL: {ollama_base_url}")
    print(f"OLLAMA_EMBED_MODEL: {os.getenv('OLLAMA_EMBED_MODEL')}")
    print(f"CHROMA_COLLECTION: {os.getenv('CHROMA_COLLECTION')}")
    print(f"CHROMA_HOST: {os.getenv('CHROMA_HOST', 'localhost')}")
    print(f"CHROMA_PORT: {os.getenv('CHROMA_PORT', '8000')}\n")

    print(f"Using Ollama server at: {ollama_base_url}")
    
    # Get Chroma server details from environment
    chroma_host = os.getenv("CHROMA_HOST", "localhost")
    chroma_port = os.getenv("CHROMA_PORT", "8000")
    print(f"Using Chroma server at: {chroma_host}:{chroma_port}")
    
    # Initialize client with HTTP connection instead of persistent storage
    client = chromadb.HttpClient(host=chroma_host, port=int(chroma_port))
    
    # Get the collection
    collection_name = os.getenv("CHROMA_COLLECTION")
    if not collection_name:
        raise ValueError("CHROMA_COLLECTION environment variable is not set")
    collection = client.get_collection(name=collection_name)
    
    # Initialize the same embeddings model used in ingestion
    model = os.getenv("OLLAMA_EMBED_MODEL")
    if not model:
        raise ValueError("OLLAMA_EMBED_MODEL environment variable is not set")
    
    embeddings = OllamaEmbeddings(
        model=model,
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
    # Load environment variables from specific .env file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(current_dir, '.env')
    load_dotenv(dotenv_path=env_path, override=True)  # override=True forces it to override existing env vars
    
    ollama_base_url = os.getenv("OLLAMA_BASE_URL")
    if not ollama_base_url:
        raise ValueError("OLLAMA_BASE_URL environment variable is not set")
    
    # Get query from command line argument, or use default
    test_query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "What are the parking rules?"
    
    test_chroma_ingestion(ollama_base_url, test_query)