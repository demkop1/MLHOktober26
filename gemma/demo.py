from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOllama(
    model="medgemma1.5:4b",
    base_url="http://localhost:11434",
    temperature=0
)

prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a medical research assistant. "
     "Explain clinical concepts accurately, "
     "and identify important uncertainties."),
    ("human", "{question}")
])

chain = prompt | llm

response = chain.invoke({
    "question": "What are the main biomarkers for diabetes?"
})

print(response.content)
