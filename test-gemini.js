import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyAmVuV3csC-R2qKduiprF60WQBmKWNgd0A";
const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
  try {
    console.log("Listing available models...");
    
    // Try different model names
    const modelNames = [
      "gemini-pro",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "models/gemini-pro",
      "models/gemini-1.5-pro",
      "models/gemini-1.5-flash"
    ];
    
    for (const modelName of modelNames) {
      try {
        console.log(`\nTrying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say hello");
        const response = await result.response;
        console.log(`✅ ${modelName} WORKS!`);
        console.log(`Response: ${response.text()}`);
        break; // Stop after first successful model
      } catch (error) {
        console.log(`❌ ${modelName} failed: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
