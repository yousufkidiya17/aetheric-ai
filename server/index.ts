import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Handle client-side routing - serve index.html for all routes
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));
  app.use(express.json());

  // API Routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      const messages = [
        { role: "system", content: "You are Aetheric, a highly advanced service request AI assistant. Respond warmly and concisely." },
        { role: "user", content: message }
      ];

      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.MISTRAL_API_KEY || 'flzFgPJCZ39V6SExEfwY72U7fAbOBH0V'}`
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (!response.ok) throw new Error(`Mistral API error: ${response.status}`);

      const data = await response.json();
      const finalReply = data.choices[0]?.message?.content || "No response generated.";
      
      res.json({ reply: finalReply, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error("Chat Error:", error.message);
      res.status(500).json({ error: "Failed to fetch response from AI", details: error.message });
    }
  });

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
