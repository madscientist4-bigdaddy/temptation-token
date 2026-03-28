import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, system } = req.body;
  if (!messages) return res.status(400).json({ error: "No messages" });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: system || "",
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    const toolUse = response.content?.find(b => b.type === "tool_use");
    if (toolUse) {
      const response2 = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: system || "",
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [...messages, { role: "assistant", content: response.content }],
      });
      return res.json({ content: response2.content, searched: true });
    }

    return res.json({ content: response.content, searched: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
