import { useAITeacher } from "@/hooks/useAITeacher";
import { useEffect, useRef } from "react";

export const MessagesList = () => {
  const {
    messages,
    currentMessage,
    playMessage,
    stopMessage,
    classroom,
    topMessage,
    currentQuestion,
    Quiz,
  } = useAITeacher(state => ({
    messages: state.messages,
    currentMessage: state.currentMessage,
    playMessage: state.playMessage,
    stopMessage: state.stopMessage,
    classroom: state.classroom,
    topMessage: state.topMessage,
    currentQuestion: state.currentQuestion,
    Quiz: state.Quiz,
    
  }));

  const containerRef = useRef(null);

  // Adding the scroll Effect
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length]);


  const renderMessage = (message) => (
    <div>
      <div className="flex">
        <div className="flex-grow">
          <div className="flex items-center gap-3">
            <span className="text-white/90 text-2xl font-bold uppercase px-3 py-1 rounded-full bg-indigo-600" >Question: </span>
            <p className="text-4xl inline-block px-2 rounded-sm font-bold bg-clip-text text-transparent bg-gradient-to-br from-blue-300/90 to-white/90">
              {message.question}
            </p>
          </div>
        </div>
      </div>
      <div className="px-5 py-2 mt-5 bg-gradient-to-br from-pink-200/20 to-pink-500/20 rounded-xl">
        <div className="mb-3 mt-3">
          <span className="mb-2 pr-4 italic bg-clip-text text-transparent bg-gradient-to-b from-white/90 to-white/70 text-3xl font-bold uppercase inline-block">
            Definition:
          </span>
          <span className="p-2 flex flex-col justify-end items-center bg-black/30 rounded-md">
            <span className="text-2xl text-white/65">
              {message.answer.definition}
            </span>
          </span>
        </div>

        <div className="mb-3 mt-3">
          <span className="mb-2 pr-4 italic bg-clip-text text-transparent bg-gradient-to-b from-white/90 to-white/70 text-3xl font-bold uppercase inline-block">
            Explanation:
          </span>
          <span className="p-2 flex flex-col justify-end items-center bg-black/30 rounded-md">
            <span className="text-2xl text-white/65">
              {message.answer.explanation}
            </span>
          </span>
        </div>

        <div className="mb-3 mt-3">
          <span className="mb-2 pr-4 italic bg-clip-text text-transparent bg-gradient-to-b from-white/90 to-white/70 text-3xl font-bold uppercase inline-block">
            Example:
          </span>
          <span className="p-2 flex flex-col justify-end items-center bg-black/30 rounded-md">
            <span className="text-2xl text-white/65">
              {message.answer.example}
            </span>
          </span>
        </div>
      </div>


    </div>

  );


  return (
    <div
      className={`${classroom === "default" ? "w-[1288px] h-[676px]" : "w-[2528px] h-[856px]"} p-8 overflow-y-auto flex flex-col space-y-8 bg-transparent opacity-80`}
      ref={containerRef}
    >
      {/* Show this message when the board is empty */}
      {messages.length === 0 && (
        <div className="h-full w-full grid place-content-center text-center">
          <h2 className="text-8xl font-bold font-jp text-red-600/90 italic">
            Aristo
          </h2>
          <h2 className="text-8xl font-bold text-white/90 italic">
            Your Personal AI Teacher
          </h2>
        </div>
      )}

      {/* Show the Quiz message */}
      {Quiz ? (
        <div className="h-full w-full grid place-content-center text-center">
          <h2 className="text-8xl font-bold font-jp text-red-600/90 italic">
            Quiz Time
          </h2>
          <h2 className="text-8xl font-bold text-white/90 italic">
            Look at your Desk
          </h2>
        </div>
      ) : (
        <>
          {topMessage && (
            <div className="flex justify-between items-center">
              <div>{renderMessage(topMessage)}</div>
            </div>
          )}


          {messages.map((message, index) => (
            <div key={index} className="flex justify-between items-center">
              <div>{renderMessage(message)}</div>
              <button
                className="text-white/65"
                onClick={() => currentMessage === message ? stopMessage(message) : playMessage(message)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-16 h-16"
                >
                  {currentMessage === message ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 0 1 9 14.437V9.564Z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"
                    />
                  )}
                </svg>
              </button>
            </div>
          ))}
        </>
      )}


    </div>
  );
};
