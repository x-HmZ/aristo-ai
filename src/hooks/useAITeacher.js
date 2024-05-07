const { create } = require("zustand");

export const teachers = ["Sonia", "Ryan"];

export const useAITeacher = create((set, get) => ({
  messages: [],
  currentMessage: null,
  teacher: teachers[0],
  loading: false,
  classroom: "default",

  numberOfQuestion: 2,
  answerOfQuestion: [],
  previousQuestion: [],
  Quiz: false,

  // Add state variables for the quiz
  quizQuestions: [],
  quizAnswers: [],
  quizCorrectAnswer: null,
  

  setTeacher: (teacher) => {
    set(() => ({
      teacher,
      messages: get().messages.map((message) => {
        message.audioPlayer = null; // New teacher, new voice
        return message;
      }),
    }));
  },

  setClassroom: (classroom) => {
    set(() => ({
      classroom,
    }));
  },

  askAI: async (question) => {
    if (!question) return;

    const message = {
      question,
      id: get().messages.length,
      answer: null, // Initialize answer
    };

    set({ loading: true });
    try {
      const res = await fetch(`/api/ai?question=${question}`);
      const data = await res.json();
      message.answer = data;
      set(() => ({
        currentMessage: message,
        messages: [...get().messages, message],
        loading: false,
      }));

      set({ numberOfQuestion: get().numberOfQuestion + 1 })
      const messageInParagraph = `${message.answer.definition}, ${message.answer.explanation}, ${message.answer.example}`
      set({ previousQuestion: [...get().previousQuestion, message.question] })
      set({ answerOfQuestion: [...get().answerOfQuestion, messageInParagraph] })

      get().playMessage(message);
    } catch (error) {
      console.error("Error asking AI:", error);
      set({ loading: false });
    }
  },

  getQuizQuestions: async () => {
    if (!get().Quiz) return;

    const previousQA = get().previousQuestion.map((question, index) => ({
      question,
      definition: get().answerOfQuestion[index],
    }));

    try {
      // Make the API call to fetch the quiz questions
      const res = await fetch(`/api/mcq?previousQA=${encodeURIComponent(JSON.stringify(previousQA))}`);
      const data = await res.json();

      // Ensure the response data is properly structured
      if (data.mcq_question && Array.isArray(data.options) && data.correct_answer) {
        set({
          quizQuestions: data.mcq_question,
          quizAnswers: data.options,
          quizCorrectAnswer: data.correct_answer,
        });
      } else {
        console.error("Invalid data format from quiz API");
      }
    } catch (error) {
      console.error("Error retrieving quiz questions:", error);
    }
  },

  playMessage: async (message) => {
    set(() => ({
      currentMessage: message,
    }));

    if (!message.audioPlayer) {
      set(() => ({
        loading: true,
      }));
      // Define the text to be converted to audio
      const textToSpeak = `${message.answer.definition} ${message.answer.explanation} ${message.answer.example}`;

      // Get TTS
      const audioRes = await fetch(`/api/tts?teacher=${get().teacher}&text=${encodeURIComponent(textToSpeak)}`);
      const audio = await audioRes.blob();
      const visemes = JSON.parse(await audioRes.headers.get("visemes"));
      const audioUrl = URL.createObjectURL(audio);
      const audioPlayer = new Audio(audioUrl);

      message.visemes = visemes;
      message.audioPlayer = audioPlayer;
      message.audioPlayer.onended = () => {
        set(() => ({
          currentMessage: null,
        }));


        // Checking if it's 3 then quiz time
        if (get().numberOfQuestion === 3) {
          set({ Quiz: true })
          get().playMessageForQuiz();
        }
        
      };

      set(() => ({
        loading: false,
        messages: get().messages.map((m) => {
          if (m.id === message.id) {
            return message;
          }
          return m;
        }),
      }));
    }

    message.audioPlayer.currentTime = 0;
    message.audioPlayer.play();
  },

  playMessageForQuiz: async ()=> {
      // Define the text to be converted to audio
      const message = {
        question: null,
        id: 69,
        answer: "Now let's have a short quiz based on the topics we learned recently.", // Initialize answer
      };

      // Get TTS
      const audioRes = await fetch(`/api/tts?teacher=${get().teacher}&text=${encodeURIComponent(message.answer)}`);
      const audio = await audioRes.blob();
      const visemes = JSON.parse(await audioRes.headers.get("visemes"));
      const audioUrl = URL.createObjectURL(audio);
      const audioPlayer = new Audio(audioUrl);

      message.visemes = visemes;
      message.audioPlayer = audioPlayer;
      message.audioPlayer.onended = () => {
        set(() => ({
          currentMessage: null,
        }));
      };

      set(() => ({
        loading: false,
        messages: get().messages.map((m) => {
          if (m.id === message.id) {
            return message;
          }
          return m;
        }),
      }));
    

    message.audioPlayer.currentTime = 0;
    message.audioPlayer.play();
  },

  stopMessage: (message) => {
    message.audioPlayer.pause();
    set(() => ({
      currentMessage: null,
    }));
    if (get().numberOfQuestion === 3) {
      set({ Quiz: true })
      get().playMessageForQuiz();
    }
  },
}));
