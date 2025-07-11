import { SUMMARY_SYSTEM_PROMPT } from "@/utils/prompts";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 seconds timeout
});

export async function generateSummaryFromOpenAI(pdfText: string) {
  try {
    // Truncate text if it's too long (OpenAI has token limits)
    const maxLength = 50000; // Adjust based on your needs
    const truncatedText = pdfText.length > maxLength 
      ? pdfText.substring(0, maxLength) + "\n\n[Document truncated due to length...]"
      : pdfText;

    console.log(`📝 Sending ${truncatedText.length} characters to OpenAI...`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        {
          role: "user", 
          content: `Transform this document into an engaging, easy-to-read summary with contextually relevant emojis and proper markdown formatting:\n\n${truncatedText}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const result = completion.choices[0].message.content;
    console.log(`✅ OpenAI response received: ${result?.substring(0, 100)}...`);
    
    return result;
  }
  catch (error: any) {
    console.error('OpenAI Error Details:', {
      status: error?.status,
      message: error?.message,
      code: error?.code
    });

    if (error?.status === 429) {
      throw new Error('RATE_LIMIT_EXCEEDED')
    }
    if (error?.code === 'timeout' || error?.message?.includes('timeout')) {
      throw new Error('OPENAI_TIMEOUT')
    }
    throw error;
  }
}