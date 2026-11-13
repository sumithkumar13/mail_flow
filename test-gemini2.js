import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyAmVuV3csC-R2qKduiprF60WQBmKWNgd0A";
const genAI = new GoogleGenerativeAI(API_KEY);

async function testAPI() {
  try {
    console.log("Testing Google AI API...");
    console.log("API Key:", API_KEY);
    
    // Try the official Gemini 2.0 Flash model (newest free model)
    const modelNames = [
      "gemini-2.0-flash-exp",
      "gemini-exp-1206", 
      "gemini-1.5-flash-8b"
    ];
    
    for (const modelName of modelNames) {
      try {
        console.log(`\nTrying: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        const response = await result.response;
        console.log(`✅ SUCCESS with ${modelName}`);
        console.log(`Response: ${response.text()}`);
        break;
      } catch (error) {
        console.log(`❌ Failed: ${error.message.substring(0, 150)}...`);
      }
    }
  } catch (error) {
    console.error("Fatal error:", error.message);
  }
}

testAPI();
