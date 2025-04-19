import { useAITeacher } from "@/hooks/useAITeacher";
import { useState, useRef, useEffect } from "react";

export const TypingBox = () => {
  const { courseAI, askAI, courseMode, speaking, quizOngoing, Quiz, updateNumberOfQuestionAsked, shouldContinue, handleContinueAfterFailure, topicsFetched } = useAITeacher();
  const loading = useAITeacher((state) => state.loading);
  const [question, setQuestion] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const lastTranscriptionRef = useRef("");

  const ask = () => {
    if (question.trim() && !isProcessing) {
      askAI(question);
      setQuestion("");
      if (!courseMode) {
        updateNumberOfQuestionAsked();
      }
    }
  };

  const processAudioChunk = async () => {
    if (audioChunksRef.current.length === 0) return;

    setIsProcessing(true);
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const response = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      if (data.text && data.text !== lastTranscriptionRef.current) {
        lastTranscriptionRef.current = data.text;
        setTranscription(data.text);
        setQuestion(data.text);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
    } finally {
      setIsProcessing(false);
      // Clear the chunks after processing
      audioChunksRef.current = [];
    }
  };

  const startRecording = async () => {
    if (isProcessing) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 16000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setTranscription("");
      lastTranscriptionRef.current = "";

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Process audio chunks every 3 seconds
      recordingIntervalRef.current = setInterval(processAudioChunk, 3000);

      mediaRecorder.onstop = async () => {
        clearInterval(recordingIntervalRef.current);
        await processAudioChunk();
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

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
                className="focus:outline focus:outline-white/80 flex-grow bg-slate-800/60 p-2 px-4 rounded-full text-white placeholder:text-white/50 shadow-inner shadow-slate-900/60 disabled:opacity-50"
                placeholder="Have you ever been to Japan?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    ask();
                  }
                }}
                disabled={isProcessing}
              />
              <button 
                className="bg-slate-100/20 p-2 px-4 rounded-full text-white hover:bg-slate-100/30 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={ask}
                disabled={isProcessing}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
                <span>Ask</span>
              </button>
              <button 
                className={`relative p-2 px-4 rounded-full text-white transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isRecording 
                    ? 'bg-red-500/75 animate-pulse' 
                    : 'bg-blue-500/75 hover:bg-blue-600/75'
                }`}
                onClick={toggleRecording}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="relative flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-white"></span>
                    </span>
                    <span>Processing...</span>
                  </>
                ) : isRecording ? (
                  <>
                    <span className="relative flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-white"></span>
                    </span>
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                    <span>Speak</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
