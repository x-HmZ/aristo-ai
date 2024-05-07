import OpenAI from "openai";

// Initialize the OpenAI client with the API key
const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

export async function GET(req) {
  // Retrieve the `previousQA` parameter from the request
  const previousQA = req.nextUrl.searchParams.get("previousQA");

  try {
    // Prepare an empty array to store parsed question-answer pairs
    let previousQAMessages = [];

    if (previousQA) {
      // Parse the `previousQA` parameter from JSON and flatten it for chat completion
      previousQAMessages = JSON.parse(previousQA).map((qa) => [
        { role: "user", content: qa.question },
        { role: "assistant", content: qa.definition } // or other structured fields like explanation or example
      ]).flat();
    }

    // Add the instruction to generate a structured MCQ based on the provided Q&A pairs
    const mcqPrompt = {
      role: "system",
      content: "You are an AI tasked with generating educational multiple-choice questions (MCQs) based on provided Q&A pairs. Provide a well-structured JSON object containing keys for 'mcq_question', 'options', and 'correct_answer'. Ensure all provided data is relevant to the previous answers.",
    };

    // Add the prompt to the chat conversation messages
    previousQAMessages.push(mcqPrompt);

    // Make the OpenAI API call to generate MCQs
    const chatCompletion = await openai.chat.completions.create({
      messages: previousQAMessages,
      model: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    // Extract and structure the AI response
    if (chatCompletion.choices && chatCompletion.choices.length > 0) {
      const responseContent = chatCompletion.choices[0].message.content;
      let aiResponse;
      try {
        aiResponse = JSON.parse(responseContent);
      } catch (error) {
        console.error("Failed to parse AI response:", responseContent);
        aiResponse = {
          mcq_question: "No valid question provided.",
          options: ["Option A", "Option B", "Option C"],
          correct_answer: "No correct answer provided.",
        };
      }

      // Ensure the response is properly structured
      const structuredResponse = {
        mcq_question: aiResponse.mcq_question || "No valid question provided.",
        options: aiResponse.options && Array.isArray(aiResponse.options) ? aiResponse.options : ["Option A", "Option B", "Option C"],
        correct_answer: aiResponse.correct_answer || "No correct answer provided.",
      };

      // Return the response as JSON
      return new Response(JSON.stringify(structuredResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error("No valid response returned from OpenAI API");
    }
  } catch (error) {
    console.error("Error during MCQ generation:", error);
    return new Response(JSON.stringify({ error: "Failed to generate MCQs", details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
