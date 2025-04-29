import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY_TITLE,
  // Remove placeholder headers for production
});

// Fast draft title from initial response (low latency)
export async function generateFastDraftTitle(userInput: string, assistantStart: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "mistralai/mistral-7b-instruct:free",
      messages: [{
        role: "user",
        content: `Generate a 3-5 word draft title based on:\nUser: ${userInput.substring(0, 200)}\nAssistant: ${assistantStart.substring(0, 200)}`
      }],
      max_tokens: 24,
      temperature: 0.9
    });
    return completion.choices[0]?.message?.content?.replace(/["']/g, '') || 'New Chat';
  } catch (err) {
    return 'New Chat';
  }
}

// Utility to check if title is too similar to input or output
function isTitleEcho(title: string, userInput: string, output: string): boolean {
  const t = title.trim().toLowerCase();
  const u = userInput.trim().toLowerCase();
  const o = output.trim().toLowerCase();
  // If title is a substring of input or output, or vice versa, or too short
  return (
    t.length < 4 ||
    t === u ||
    t === o ||
    u.includes(t) ||
    o.includes(t)
  );
}

// Utility to build a clear title prompt using both user input and output
export function buildTitlePrompt(userInput: string, output: string): string {
  // Limit input/output length for the prompt to avoid excessive token usage
  const maxLen = 1000;
  const truncatedInput = userInput.length > maxLen ? userInput.substring(0, maxLen) + "..." : userInput;
  const truncatedOutput = output.length > maxLen ? output.substring(0, maxLen) + "..." : output;

  return `Generate a concise and meaningful title (4-6 words) for the following exchange. The title should summarize the core topic based on both the user's input and the AI's output. Avoid generic phrases. Return ONLY the title text, without quotes or explanations.

User Input: ${truncatedInput}
AI Output: ${truncatedOutput}

Title:`;
}

// Final optimized title from full conversation
export async function generateTitleWithOpenRouter(prompt: string, userInput?: string, output?: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      // Consider using a model known for good summarization/titling
      model: "mistralai/mixtral-8x7b-instruct", // Example: Mixtral might be good
      messages: [
        {
          role: "user",
          // Use the structured prompt from buildTitlePrompt
          content: prompt,
        },
      ],
      max_tokens: 20, // Increased slightly for potentially better titles
      temperature: 0.6, // Slightly lower temp for more focused titles
    });

    let title = completion.choices?.[0]?.message?.content?.trim() || '';
    title = title.replace(/^["']|["']$/g, '').substring(0, 100);

    // Basic echo check (can be enhanced)
    if (userInput && output && isTitleEcho(title, userInput, output)) {
       console.warn(`OpenRouter generated title "${title}" deemed an echo.`);
       return ""; // Return empty to signal fallback in the caller
    }
    // Return empty if too short, let caller handle fallback
    return title.length > 3 ? title : "";
  } catch (err) {
    console.error("Error generating title with OpenRouter:", err);
    return ""; // Return empty on error, let caller handle fallback
  }
}
