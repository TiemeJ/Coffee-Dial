const {onRequest} = require("firebase-functions/v2/https");
const {GoogleGenerativeAI} = require("@google/generative-ai");

const geminiApiKey = process.env.GEMINI_API_KEY || "";

if (!geminiApiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

const genAI = new GoogleGenerativeAI(geminiApiKey);

exports.analyzeCoffeeBag = onRequest({cors: true}, async (req, res) => {
  try {
    const {base64Image} = req.body || {};
    if (!base64Image) return res.status(400).send("No image provided");

    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash"});
    const prompt = [
      "You are a coffee expert.",
      "Look at this image of a coffee bag and extract the following",
      "information.",
      "Return ONLY a JSON object with these keys: roaster, farmer, origin,",
      "variety, processing, roastType.",
      "For roastType, choose only from: 'Light', 'Medium',",
      "'Medium-Dark', 'Dark'. If a field is not found, use an empty string.",
    ].join(" ");

    const result = await model.generateContent([
      prompt,
      {inlineData: {data: base64Image, mimeType: "image/jpeg"}},
    ]);
    const response = await result.response;
    const text = response.text();
    const jsonString = text.replace(/```json|```/g, "").trim();
    res.status(200).send(JSON.parse(jsonString));
  } catch (error) {
    res.status(500).send({error: error.message});
  }
});

exports.analyzeBrewProfile = onRequest({cors: true}, async (req, res) => {
  try {
    const {brewData, userName} = req.body || {};
    if (!brewData) return res.status(400).send("No brew data provided");

    const model = genAI.getGenerativeModel({model: "gemini-2.0-flash"});
    const prompt = [
      `You are a world-class coffee sommelier for ${userName}.`,
      "Analyze the following coffee brew history.",
      "",
      "The data includes Roaster, Origin, Farmer, Processing method,",
      "Roast level, Brewing Method, Drink type, Rating, and Tasting Notes.",
      "",
      "Write a brief personality profile about their coffee habits.",
      "1. Identify their 'vibe' based on preferred methods, drinks,",
      "and roast levels.",
      "2. Mention specific flavor patterns from high-rated brews.",
      "3. Mention one or two top rated coffees with interesting details,",
      "such as processing and how they experienced it in notes.",
      "",
      "Keep the tone encouraging, professional, and concise.",
      "",
      "DATA:",
      brewData,
    ].join("\n");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.status(200).send({profile: response.text()});
  } catch (error) {
    res.status(500).send({error: error.message});
  }
});
