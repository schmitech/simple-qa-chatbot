"""
City of Ottawa Chatbot

This script runs a Streamlit Q/AChatbot, which provides information  using ChromaDB as the vector database and Ollama 
for embeddings and LLM inference.

Usage:
    streamlit run chatbot_app_chroma.py

Features:
    - Natural language Q&
    - Chat interface with message history
    - Optional text-to-speech responses using Eleven Labs
    - Local vector search using ChromaDB
    - Local LLM inference using Ollama

Dependencies:
    - Streamlit
    - ChromaDB
    - Langchain
    - Ollama
    - Eleven Labs (optional, for text-to-speech)

Required Configuration:

Create a .streamlit/secrets.toml file with the following variables:
    CHROMA_PERSIST_DIRECTORY = "./chroma_db"  # Path to ChromaDB storage
    OLLAMA_BASE_URL = "http://localhost:11434"  # URL to Ollama server
    OLLAMA_TEMPERATURE = 0.7  # LLM temperature setting
    OLLAMA_MODEL = "your-model-name"  # Name of your Ollama model

Optional Configuration (for text-to-speech):
Add these to secrets.toml if using voice features:
    ELEVEN_LABS_API_KEY = "your-api-key"
    ELEVEN_LABS_VOICE_ID = "your-voice-id"

Setup:
1. Install dependencies: pip install -r requirements.txt
2. Start Ollama server locally
3. Ensure ChromaDB is populated with your Q&A data
4. Configure secrets.toml as described above
5. Run the application: streamlit run chatbot_app_chroma.py
"""

import streamlit as st
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.llms import Ollama
from langchain.chains import RetrievalQA
import chromadb
from elevenlabs import ElevenLabs
import base64
import time
from langchain.schema import BaseRetriever, Document
from typing import List
from pydantic import Field
from langchain.callbacks.manager import CallbackManagerForRetrieverRun
from dataclasses import dataclass

# Check if voice is enabled via config
ENABLE_VOICE = st.secrets.get("ENABLE_VOICE", False)

class ChromaRetriever(BaseRetriever):
    collection: any = Field(description="ChromaDB collection")
    embeddings: any = Field(description="OllamaEmbeddings")

    class Config:
        arbitrary_types_allowed = True

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        query_embedding = self.embeddings.embed_query(query)
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=3,
            include=['metadatas', 'documents']
        )
        
        # Debug print
        print("ChromaDB Results:", results)
        
        documents = []
        if results and results['metadatas']:
            for metadata in results['metadatas'][0]:
                if metadata.get('question') and metadata.get('answer'):
                    # Construct content from question and answer
                    content = f"Question: {metadata['question']}\nAnswer: {metadata['answer']}"
                    documents.append(Document(
                        page_content=content,
                        metadata=metadata
                    ))
        
        # Debug print
        print(f"Created {len(documents)} documents")
        for doc in documents:
            print(f"Document content length: {len(doc.page_content)}")
            print(f"Document metadata: {doc.metadata}")
        
        return documents or [Document(page_content="I'm sorry, I couldn't find any relevant information.")]

def initialize_rag():
    # Initialize ChromaDB with path from secrets
    client = chromadb.PersistentClient(path=st.secrets["CHROMA_PERSIST_DIRECTORY"])
    
    # Initialize Ollama
    embeddings = OllamaEmbeddings(
        model="nomic-embed-text",
        base_url=st.secrets["OLLAMA_BASE_URL"]
    )
    
    llm = Ollama(
        model=st.secrets["OLLAMA_MODEL"],
        base_url=st.secrets["OLLAMA_BASE_URL"],
        temperature=st.secrets["OLLAMA_TEMPERATURE"]
    )
    
    # Get the collection
    collection = client.get_collection(name=st.secrets["CHROMA_COLLECTION"])
    
    # Create retriever instance with keyword arguments
    retriever = ChromaRetriever(collection=collection, embeddings=embeddings)
    
    # Create QA chain with custom retriever
    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever,
        return_source_documents=True
    )
    
    return qa_chain

# Page config
st.set_page_config(page_title=st.secrets["PAGE_TITLE"], page_icon="🏛️")
st.title(st.secrets["PAGE_TITLE"])

# Initialize session state for chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Initialize RAG system
@st.cache_resource
def get_qa_chain():
    return initialize_rag()

# Function to convert text to speech using Eleven Labs Python client
def text_to_speech(text):
    client = ElevenLabs(api_key=st.secrets["ELEVEN_LABS_API_KEY"])
    audio_stream = client.text_to_speech.convert(
        text=text,
        voice_id=st.secrets["ELEVEN_LABS_VOICE_ID"],
        model_id="eleven_flash_v2_5",
        output_format="mp3_44100_128"
    )
    # Convert the generator to bytes
    audio_bytes = b"".join(audio_stream)
    return audio_bytes

# Add this in the sidebar section
with st.sidebar:
    st.header("Settings")
    voice_enabled = st.toggle("Enable Voice Responses", value=False, key="voice_toggle")

try:
    qa_chain = get_qa_chain()
    
    # Display chat messages
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
    
    # Chat input
    if prompt := st.chat_input("Ask a question about municipal services..."):
        # Display user message
        with st.chat_message("user"):
            st.markdown(prompt)
        st.session_state.messages.append({"role": "user", "content": prompt})
        
        # Get response from RAG system
        with st.chat_message("assistant"):
            with st.spinner("Thinking 🤔..."):
                # Show the embedding process
                embeddings = OllamaEmbeddings(
                    model="nomic-embed-text",
                    base_url=st.secrets["OLLAMA_BASE_URL"]
                )
                
                # Get response from RAG system
                response_stream = qa_chain.stream({"query": prompt})
                
                # Stream text and audio simultaneously
                response_placeholder = st.empty()
                full_response = ""
                audio_buffer = ""
                
                # Create audio container
                audio_container = st.empty()
                
                for word in response_stream:
                    if 'result' in word:
                        token = word['result']
                        full_response += token + " "
                        response_placeholder.markdown(full_response + "▌")
                        
                        # Buffer words for audio generation
                        audio_buffer += token + " "
                        
                        # Generate audio for every 5 words or sentence end
                        if len(audio_buffer.split()) >= 3 or any(c in audio_buffer for c in '.!?'):
                            if voice_enabled:
                                audio_content = text_to_speech(audio_buffer)
                                audio_str = base64.b64encode(audio_content).decode('utf-8')
                                audio_html = f'''
                                    <audio autoplay>
                                        <source src="data:audio/mp3;base64,{audio_str}" type="audio/mp3">
                                    </audio>
                                '''
                                audio_container.markdown(audio_html, unsafe_allow_html=True)
                            audio_buffer = ""
                        
                        time.sleep(0.15)  # Match average speaking pace
                
                # Process remaining audio
                if voice_enabled and audio_buffer:
                    audio_content = text_to_speech(audio_buffer)
                    audio_str = base64.b64encode(audio_content).decode('utf-8')
                    audio_html = f'''
                        <audio autoplay>
                            <source src="data:audio/mp3;base64,{audio_str}" type="audio/mp3">
                        </audio>
                    '''
                    audio_container.markdown(audio_html, unsafe_allow_html=True)
                
                response_placeholder.markdown(full_response)
        
        st.session_state.messages.append({"role": "assistant", "content": full_response})

except Exception as e:
    st.error(f"An error occurred: {str(e)}")
    st.info("Please check your configuration and ensure all services are running.") 