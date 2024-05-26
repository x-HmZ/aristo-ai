import { useAITeacher } from "@/hooks/useAITeacher";
import { useState } from "react";
const sdk = require("microsoft-cognitiveservices-speech-sdk");

export const TypingBox = () => {
  const { courseAI, askAI, courseMode, speaking, quizOngoing, Quiz, updateNumberOfQuestionAsked, shouldContinue, handleContinueAfterFailure,topicsFetched } = useAITeacher();
  const loading = useAITeacher((state) => state.loading);
  const [question, setQuestion] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recognizer, setRecognizer] = useState(null); // Store the recognizer


  const ask = () => {
    if (question.trim()) {
      askAI(question);
      setQuestion("");
      if (!courseMode) {
        updateNumberOfQuestionAsked();
      }
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
  };

  const startSpeechRecognition = () => {
    setIsRecording(true);
    console.log("Starting speech recognition...");
    const speechConfig = sdk.SpeechConfig.fromSubscription("d91aedba587c4c2fa23bb0025be8a1fb", "eastasia");
    speechConfig.speechRecognitionLanguage = "en-US";
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const newRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    newRecognizer.recognized = (sender, event) => {
      if (event.result.reason === sdk.ResultReason.RecognizedSpeech) {
        setQuestion(event.result.text); // Set the question immediately when recognized
        console.log(event.result.text)
        stopSpeechRecognition(); // Stop recognition after the text is recognized
      }
    };

    newRecognizer.canceled = (sender, event) => {
      console.error(`CANCELED: Reason=${event.reason}`);
      stopSpeechRecognition(); // Ensure to stop on cancellation
    };

    newRecognizer.startContinuousRecognitionAsync();
    setRecognizer(newRecognizer); // Store the recognizer instance

  };

  const stopSpeechRecognition = () => {
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync(() => {
        recognizer.close(); // Properly close the recognizer
        setIsRecording(false); // Update recording state
        setRecognizer(null); // Clear the recognizer from state
      });
    }
  };


  if (quizOngoing && shouldContinue && !Quiz) {
    return (
      <>
        <div className="z-10 max-w-[600px] w-full flex space-y-6 flex-col bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-4 backdrop-blur-md rounded-xl border-slate-100/30 border">
          <div className=" text-center">
            <h2 className="text-white font-bold text-xl">
              You have Failed the Quiz :(
            </h2>
            <p className="text-white/65">
              Press continue to learn them with a different style
            </p>
          </div>
          {loading ? (
            <div className="flex justify-center items-center">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
              </span>
            </div>
          ) : (
            <div className="gap-3 flex justify-center">
              <button className="bg-blue-500/75 p-2 px-4 rounded-full text-white"
                onClick={() => {
                  handleContinueAfterFailure();
                }}
              >Continue</button>
            </div>
          )}
        </div>
      </>
    )
  }

  // ! Course Mode
  if (courseMode) {
    if (speaking || quizOngoing || Quiz || !topicsFetched) {
      return null
    } else {
      return (
        <>
          <div className="z-10 max-w-[600px] w-full flex space-y-6 flex-col bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-4 backdrop-blur-md rounded-xl border-slate-100/30 border">
            <div className=" text-center">
              <h2 className="text-white font-bold text-xl">
                Press Continue
              </h2>
              <p className="text-white/65">
                when you are ready to go to next Topic
              </p>
            </div>
            {loading ? (
              <div className="flex justify-center items-center">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
                </span>
              </div>
            ) : (
              <div className="gap-3 flex justify-center">
                <button className="bg-blue-500/75 p-2 px-4 rounded-full text-white"
                  onClick={() => courseAI()}
                  
                >Continue</button>
              </div>
            )}
          </div>
        </>
      )
    }
  }

  // ! Free Roam Mode
  return (
    <>
      {speaking || quizOngoing || Quiz ? null : (
        <div className="z-10 max-w-[600px] flex space-y-6 flex-col bg-gradient-to-tr from-slate-300/30 via-gray-400/30 to-slate-600-400/30 p-4 backdrop-blur-md rounded-xl border-slate-100/30 border">
          <div>
            <h2 className="text-white font-bold text-xl">
              Aristo Here :D
            </h2>
            <p className="text-white/65">
              Type or speak what you want to learn in a sentence and Aristo will teach you.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
              </span>
            </div>
          ) : (
            <div className="gap-3 flex">
              <input
                className="focus:outline focus:outline-white/80 flex-grow bg-slate-800/60 p-2 px-4 rounded-full text-white placeholder:text-white/50 shadow-inner shadow-slate-900/60"
                placeholder="Have you ever been to Japan?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    ask();

                  }
                }}
              />
              <button className="bg-slate-100/20 p-2 px-6 rounded-full text-white" onClick={ask}>Ask</button>
              <button className="bg-blue-500/75 p-2 px-4 rounded-full text-white" onClick={toggleRecording}>
                {isRecording ? 'Stop' : 'Speak'}
              </button>
            </div>
          )}
        </div>
      )}
    </>

  );
};
