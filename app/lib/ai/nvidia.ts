import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: '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',
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

const DEFAULT_MODEL = "deepseek-ai/deepseek-r1-distill-llama-8b";

export async function generateTitle(prompt: string, model: string = DEFAULT_MODEL): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [{
        role: "user",
        content: `Generate a short, descriptive chat title (4-6 words) for this message: "${prompt.substring(0, 500)}". Return ONLY the title, no quotes or explanations.`,
      }],
      temperature: 0.6,
      top_p: 0.7,
      max_tokens: 16,
      stream: false,
    });

    const title = completion.choices[0]?.message?.content?.trim() || '';
    return title.length > 1 ? title.replace(/^["']|["']$/g, '').substring(0, 100) : "New Chat";
  } catch (err) {
    return "New Chat";
  }
}

// Example usage (remove or comment out in production)
/*
async function main() {
  const title = await generateTitle("Generate a catchy blog post title about AI in healthcare.");
  console.log("Generated Title:", title);
}
main();
*/