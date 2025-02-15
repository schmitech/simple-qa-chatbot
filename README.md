# Simple Q/A  AI Assistant

This project creates an AI-powered assistant using Ollama and Chroma.

## Architecture Overview

The RAG pipeline uses:

- Pinecone for vector storage
- Ollama's Llama3.2 model for generation
- Nomic embeddings for retrieval

## Features

- Fine-tuned model for specific domain questions
- Professional response formatting

## Benefits of the Chatbot

Here are the key advantages of the chatbot compared to traditional search methods:

### Immediate Advantages:
1. **Natural Language Understanding**
   - Users can ask questions in their own words
   - No need to know exact menu paths or keywords
   - Handles variations in how questions are asked

2. **Direct Answers**
   - Provides specific information instantly
   - No need to scan through long pages
   - Eliminates the need to navigate multiple links

3. **Consistency and Accuracy**
   - Always pulls from official city data
   - Provides up-to-date information
   - Standardized responses for common questions

4. **24/7 Accessibility**
   - Available anytime
   - No wait times for basic information
   - Reduces load on phone lines and staff


### Future Potential:
1. **Integration with More Services**
   - Appointment scheduling
   - Form submissions
   - Service status updates

2. **Enhanced Personalization**
   - Remember user preferences
   - Provide location-specific information
   - Customized alerts and reminders

3. **Data-Driven Improvements**
   - Identify common citizen needs
   - Highlight areas needing better documentation
   - Guide service improvements based on usage patterns

4. **Expanded Capabilities**
   - Real-time service updates
   - Interactive forms
   - Payment processing
   - Multi-channel support (voice, SMS)

## Prerequisites

- Python 3.11 or higher
- Ollama installed ([Ollama Installation Guide](https://github.com/ollama/ollama))
- 16GB RAM minimum

## Installation

1. Clone the repository:
```bash
git clone https://github.com/schmitech/simple-qa-chatbot.git
cd city-ottawa-rag-assistant
```

2. Install required packages:
```bash
pip install langchain-core
pip install langchain-community
pip install langchain-ollama
```

3. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

4. Install required packages:
```bash
pip install -r requirements.txt
```

## Deploy Ollama Model

```bash
./deploy-model.sh
```

## Data Ingestion

1. Ingest data into Pinecone (requires .env configuration):
```bash
python chroma-data-ingestion.py
```

## Running the Chat Interface

1. Start a conversation:
```bash
streamlit run chatbot_app_chroma.py
```

## Configuration

1. Create a `.streamlit/secrets.toml` file with:
```toml
[secrets]
PINECONE_API_KEY = "your_pinecone_key"
OLLAMA_BASE_URL = "http://your-ollama-host:11434"
PINECONE_INDEX = "municipal-qa"
```

2. Create a `.env` file for ingestion scripts:
```env
PINECONE_API_KEY=your_pinecone_key
OLLAMA_HOST=http://your-ollama-host:11434
PINECONE_HOST=controller.us-east1-gcp.pinecone.io
```

## Query Execution Flow
1. User question is embedded using Nomic-embed-text
2. Pinecone performs vector similarity search
3. Top 3 relevant context chunks are retrieved
4. phi4 model generates answer using context
5. Response includes source references

## Key Components
- `chroma-data-ingestion.py`: Handles vector embedding and storage
- `chatbot_app_chroma.py`: Web interface for citizen interactions
- `qa_pairs.json`: Sample dataset of Q/A pairs
```

## Limitations

- Limited to trained topics
- Requires Ollama to be installed
- Response time varies based on hardware

## Troubleshooting

Common RAG issues:
1. Missing Pinecone credentials:
   - Verify secrets.toml configuration
   - Check environment variables
   - Ensure proper Pinecone index configuration

2. Conversion issues:
   - Ensure all dependencies are installed
   - Check available disk space
   - Verify model files are complete

3. Ollama integration:
   - Verify Ollama is running
   - Check Modelfile syntax
   - Ensure base model is downloaded

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Ollama](https://github.com/ollama/ollama) for the model serving infrastructure
- Mistral AI for the base model

## Support

For support, please open an issue in the GitHub repository.