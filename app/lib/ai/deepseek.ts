// Please install OpenAI SDK first: `npm install openai`

import OpenAI from "openai";
import { ChatCompletionChunk } from "openai/resources/index.mjs";
import { Stream } from "openai/streaming.mjs";

const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY || '<DeepSeek API Key>' // Use environment variable or replace placeholder
});

async function main() {
  // Round 1
  let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "user", content: "9.11 and 9.8, which is greater?" }];
  let responseStream: Stream<ChatCompletionChunk>;

  try {
    responseStream = await openai.chat.completions.create({
      model: "deepseek-reasoner",
      messages: messages,
      stream: true,
      // @ts-expect-error deepseek specific parameter
      stream_options: { include_reasoning_content: true } // Request reasoning content
    });
  } catch (error) {
    console.error("Error calling DeepSeek API (Round 1):", error);
    return;
  }


  let reasoning_content_r1 = "";
  let content_r1 = "";

  console.log("\n--- Round 1 ---");
  try {
    for await (const chunk of responseStream) {
      // @ts-expect-error deepseek specific property
      if (chunk.choices[0]?.delta?.reasoning_content) {
        // @ts-expect-error deepseek specific property
        reasoning_content_r1 += chunk.choices[0].delta.reasoning_content;
      } else if (chunk.choices[0]?.delta?.content) {
        content_r1 += chunk.choices[0].delta.content;
      }
    }
  } catch (error) {
      console.error("Error processing stream (Round 1):", error);
      return;
  }

  console.log("Reasoning (R1):", reasoning_content_r1);
  console.log("Content (R1):", content_r1);


  // Round 2
  messages.push({ role: "assistant", content: content_r1 });
  messages.push({ role: 'user', content: "How many Rs are there in the word 'strawberry'?" });

  try {
      responseStream = await openai.chat.completions.create({
          model: "deepseek-reasoner",
          messages: messages,
          stream: true,
          // @ts-expect-error deepseek specific parameter
          stream_options: { include_reasoning_content: true } // Request reasoning content
      });
  } catch (error) {
      console.error("Error calling DeepSeek API (Round 2):", error);
      return;
  }

  let reasoning_content_r2 = "";
  let content_r2 = "";

  console.log("\n--- Round 2 ---");
  try {
      for await (const chunk of responseStream) {
          // @ts-expect-error deepseek specific property
          if (chunk.choices[0]?.delta?.reasoning_content) {
              // @ts-expect-error deepseek specific property
              reasoning_content_r2 += chunk.choices[0].delta.reasoning_content;
          } else if (chunk.choices[0]?.delta?.content) {
              content_r2 += chunk.choices[0].delta.content;
          }
      }
  } catch (error) {
      console.error("Error processing stream (Round 2):", error);
      return;
  }

  console.log("Reasoning (R2):", reasoning_content_r2);
  console.log("Content (R2):", content_r2);

}

main().catch(console.error);