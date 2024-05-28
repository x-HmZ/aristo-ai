import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY
});

export async function GET(req) {
  const question = req.nextUrl.searchParams.get("question") || "What is photosynthesis?";
  const teachingType = req.nextUrl.searchParams.get("teachingType") || "in technical terms";
  const course = req.nextUrl.searchParams.get("course") || "Science 4th Grade"

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",  // Specify the GPT-4 Omni model
      messages: [
        {
          role: "system",
          content: `
            You are Aristo, an advanced AI with enhanced capabilities, dedicated to providing educational content. When asked a question about a topic, respond with structured JSON containing keys for 'definition', 'explanation', 'example', and 'imageDescription'. 
            Ensure the format follows this exact structure:
            {
              "definition": "A brief definition of the topic.",
              "explanation": "A detailed explanation that includes key concepts and context.",
              "example": "A specific example that helps explain the topic in practice.",
              "imageDescription": "A detailed description or suggestion for an image or diagram that could visually represent the topic."
            }
            The explanation and example should be provided ${teachingType}. Be concise and clear in your responses and keep in mind that the answer is according to the grade specified in course name which is ${course}, and include detailed descriptions for any suggested images or diagrams about the inquired topic. it is very important that There should be exactly none or very minimum text in the image, which means no labels should be and no formulas.
          `
        },
        {
          role: "user",
          content: question
        }
      ],
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
          example: "No valid example provided.",
          imageDescription: "No valid image description provided."
        };
      }

      const structuredResponse = {
        definition: aiResponse.definition || "Definition not provided.",
        explanation: aiResponse.explanation || "Explanation not provided.",
        example: aiResponse.example || "Example not provided.",
        imageDescription: aiResponse.imageDescription || "Image description not provided."
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
