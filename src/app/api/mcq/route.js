import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function GET(req) {
  const previousQA = req.nextUrl.searchParams.get("previousQA");
  try {
    let previousQAMessages = [];

    if (previousQA) {
      previousQAMessages = JSON.parse(previousQA).map((qa) => [
        { role: "user", content: qa.question },
        { role: "assistant", content: qa.definition }
      ]).flat();
    }

    const mcqPrompt = {
      role: "system",
      content: `You are an AI tasked with generating educational multiple-choice questions (MCQs) strictly based on the provided explanations, and examples. Provide a JSON object containing three keys: 'mcq_questions', 'options', and 'correct_answers'. Each key should contain an array, where each index corresponds to the same question. 'mcq_questions' will have the questions, 'options' will provide a list of choices for each question, and 'correct_answers' will state the correct option for each question. Here is an example format:
      {
        "mcq_questions": [
          "What type of programming language is Python?",
          "What is the capital of France?"
        ],
        "options": [
          ["Procedural", "Object-Oriented", "Functional", "All of the above"],
          ["Paris", "Lyon", "Marseille", "Nice"]
        ],
        "correct_answers": [
          "All of the above",
          "Paris"
        ]
      }
      Generate five MCQs strictly from the provided content. The questions should only be based on the definitions, explanations, and examples provided in the previous answers. Do not introduce any new information that is not explicitly provided.`
    };

    previousQAMessages.push(mcqPrompt);

    const chatCompletion = await openai.chat.completions.create({
      messages: previousQAMessages,
      model: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    if (chatCompletion.choices && chatCompletion.choices.length > 0) {
      const responseContent = chatCompletion.choices[0].message.content;
      let aiResponse = JSON.parse(responseContent);

      // Return the response as JSON with correct structure
      return new Response(JSON.stringify(aiResponse), {
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
