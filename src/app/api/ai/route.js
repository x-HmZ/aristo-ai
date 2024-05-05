import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"]
});

export async function GET(req) {
  const question = req.nextUrl.searchParams.get("question") || "What is photosynthesis?";

  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an AI tasked with providing educational content. When asked a question about a topic, respond with structured JSON containing keys for 'definition', 'explanation', and 'example'. Ensure the format follows this structure."
        },
        {
          role: "user",
          content: question
        }
      ],
      model: "gpt-3.5-turbo", // Ensure this model is available to you in your OpenAI dashboard
      response_format: {
        type: "json_object",
      },
    });

    if (chatCompletion.choices && chatCompletion.choices.length > 0) {
      const responseContent = chatCompletion.choices[0].message.content;
      
      // Attempt to parse the responseContent, assuming it's already structured JSON
      let aiResponse;
      try {
        aiResponse = JSON.parse(responseContent);
      } catch (error) {
        // If parsing fails, log the error and prepare a default response
        console.error("Failed to parse AI response:", responseContent);
        aiResponse = {
          definition: "No valid definition provided.",
          explanation: "No valid explanation provided.",
          example: "No valid example provided."
        };
      }

      const structuredResponse = {
        definition: aiResponse.definition || "Definition not provided.",
        explanation: aiResponse.explanation || "Explanation not provided.",
        example: aiResponse.example || "Example not provided."
      };

      console.log(structuredResponse);
      return new Response(JSON.stringify(structuredResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else {
      throw new Error("No valid response in choices");
    }
  } catch (error) {
    console.error("Error during API call or data handling:", error);
    return new Response(JSON.stringify({ error: "Failed to process your request", details: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
