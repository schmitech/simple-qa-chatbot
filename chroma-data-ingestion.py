import os
import json
from langchain_ollama import OllamaEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from tqdm import tqdm
import chromadb
from dotenv import load_dotenv
import argparse

def ingest_to_chroma(
    json_file_path: str,
    ollama_base_url: str,
    persist_directory: str = os.getenv("CHROMA_PERSIST_DIRECTORY"),
    batch_size: int = 50
):
    print(f"Function received ollama_base_url: {ollama_base_url}")
    
    # Initialize Chroma client with new configuration
    client = chromadb.PersistentClient(path=persist_directory)
    
    # Create or get collection
    collection_name = os.getenv("CHROMA_COLLECTION")
    if not collection_name:
        raise ValueError("CHROMA_COLLECTION environment variable is not set. Please check your .env file.")
    collection = client.get_or_create_collection(name=collection_name)
    
    # Initialize Ollama embeddings
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",
        base_url=ollama_base_url,
        client_kwargs={"timeout": 30.0}
    )
    
    # Verify Ollama connection
    try:
        # Test embedding with a simple string
        test_embedding = embeddings.embed_query("test connection")
        print("Successfully connected to Ollama server")
    except Exception as e:
        print(f"Failed to connect to Ollama server at {ollama_base_url}")
        print(f"Error: {str(e)}")
        return
    
    # Load Q&A pairs
    with open(json_file_path, 'r', encoding='utf-8') as f:
        qa_pairs = json.load(f)
    
    print(f"Loaded {len(qa_pairs)} Q&A pairs")
    
    # Text splitter for longer texts
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    
    # Process in batches
    for i in tqdm(range(0, len(qa_pairs), batch_size), desc="Processing Q&A pairs"):
        batch = qa_pairs[i:i + batch_size]
        
        batch_ids = []
        batch_embeddings = []
        batch_metadatas = []
        
        for idx, qa in enumerate(batch):
            combined_text = f"Question: {qa['question']}\nAnswer: {qa['answer']}"
            chunks = text_splitter.split_text(combined_text)
            
            for chunk_idx, chunk in enumerate(chunks):
                try:
                    embedding = embeddings.embed_query(chunk)
                    doc_id = f"qa_{i + idx}_{chunk_idx}"
                    
                    batch_ids.append(doc_id)
                    batch_embeddings.append(embedding)
                    batch_metadatas.append({
                        "text": chunk,
                        "question": qa["question"],
                        "answer": qa["answer"],
                        "chunk_index": str(chunk_idx),
                        "source": collection_name
                    })
                    
                except Exception as e:
                    print(f"Error processing Q&A pair {i + idx}: {str(e)}")
                    continue

        # Add batch to collection
        if batch_ids:
            try:
                collection.upsert(
                    ids=batch_ids,
                    embeddings=batch_embeddings,
                    metadatas=batch_metadatas
                )
                print(f"Uploaded batch of {len(batch_ids)} vectors")
            except Exception as e:
                print(f"Error uploading batch: {str(e)}")

    # Print stats
    print("\nIngestion complete!")
    print(f"Total vectors in collection: {collection.count()}")

if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Ingest Q&A pairs into Chroma database')
    parser.add_argument('json_file_path', help='Path to the JSON file containing Q&A pairs')
    args = parser.parse_args()

    # Debug: Print the .env file path and contents
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    print(f"Looking for .env file at: {env_path}")
    print(f"Does .env file exist? {os.path.exists(env_path)}")
    
    # Read and print the contents of .env file
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            print("Contents of .env file:")
            for line in f:
                if line.strip().startswith('OLLAMA_HOST'):
                    print(line.strip())
    
    # Load environment variables
    load_dotenv(env_path, override=True)  # Added override=True to force override existing env vars
    
    ollama_base_url = os.getenv("OLLAMA_HOST")
    print(f"Loaded OLLAMA_HOST from .env: {ollama_base_url}")
    
    # Also print all environment variables containing 'OLLAMA'
    print("\nAll OLLAMA-related environment variables:")
    for key, value in os.environ.items():
        if 'OLLAMA' in key:
            print(f"{key}: {value}")
    
    # Updated configuration
    CONFIG = {
        "ollama_base_url": ollama_base_url,
        "json_file_path": args.json_file_path,
        "batch_size": 50,
        "persist_directory": os.getenv("CHROMA_PERSIST_DIRECTORY")
    }
    
    if not ollama_base_url:
        print("Missing environment variables:")
        print(f"OLLAMA_HOST: {'set' if ollama_base_url else 'missing'}")
        raise ValueError("Missing required environment variables. Please check your .env file.")
    
    # Run ingestion with Chroma
    ingest_to_chroma(**CONFIG)