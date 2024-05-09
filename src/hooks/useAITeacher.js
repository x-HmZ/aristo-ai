const { create } = require("zustand");

export const teachers = ["Sonia", "Ryan"];

export const useAITeacher = create((set, get) => ({
  messages: [],
  currentMessage: null,
  teacher: teachers[0],
  loading: false,
  index : 0 ,
  classroom: "default",
  quizFailedTimes: 0,
  learningTypes : ["in technical terms", "using metaphors", "as if you are explaining to a ten year old"],
  
  numberOfQuestion: 0,
  maxQuestions: 1,
  quizOngoing: false,
  

  // Answers and Questions stored before mcq
  answerOfQuestion: [],
  previousQuestion: [],

  // Start quiz and sructure the response  
  Quiz: false,
  quizQuestions: [],
  quizAnswers: [],
  quizCorrectAnswer: [],
  score: 0,
  quizPassed: false,

  getTeachingType: () => {
    return get().learningTypes[get().quizFailedTimes]; // Ensures the index is always valid
  },

  setQuizPassedTrue: () => {
    set({ quizPassed: true })
  },
  setQuizPassedFalse: () => {
    set({ quizPassed: false })
  },

  updateScore: () => {
    set((state) => ({
      score: state.score + 1,
    }));
  },

  quizFailed: async () => {
    // Reset quiz state
    
    set({ quizFailedTimes : get().quizFailedTimes + 1});
    if(get().quizFailedTimes > 2){set({quizFailedTimes: 0})};
    set({ numberOfQuestion: 0 });
    set({ Quiz: false });
    set({ quizOngoing: true })

    for (get().index; get().index < get().maxQuestions; set({index : get().index + 1})) {
      await get().askAI(get().previousQuestion[get().index]);
      set({ numberOfQuestion: get().numberOfQuestion + 1 })
      // console.log(i)
    }
    set({index: 0});
    set({ score: 0 });
    set({ Quiz: true });
    console.log("All previous questions have been asked.");
  },

  quizFinished: () => {
    set({
      score: 0,
      numberOfQuestion: 0,
      answerOfQuestion: [],
      previousQuestion: [],
      Quiz: false,
      quizQuestions: [],
      quizAnswers: [],
      quizCorrectAnswer: [],
      quizOngoing: false,
    })
  },


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
    const teachingType = get().getTeachingType()
    if (!question) return;

    const message = {
      question,
      id: get().messages.length,
      answer: null, // Initialize answer
    };

    set({ loading: true });
    try {
      const res = await fetch(`/api/ai?question=${question}&teachingType=${teachingType}`);
      const data = await res.json();
      message.answer = data;
      set(() => ({
        currentMessage: message,
        messages: [...get().messages, message],
        loading: false,
      }));

      if (!get().quizOngoing) {
        set({ numberOfQuestion: get().numberOfQuestion + 1 })
        const messageInParagraph = `${message.answer.definition}, ${message.answer.explanation}, ${message.answer.example}`
        set({ previousQuestion: [...get().previousQuestion, message.question] })
        set({ answerOfQuestion: [...get().answerOfQuestion, messageInParagraph] })
      }else {
        // Replace existing question and answer pairs during a quiz
        const index = get().index;
        const updatedQuestions = [...get().previousQuestion];
        const updatedAnswers = [...get().answerOfQuestion];
        const messageInParagraph = `${message.answer.definition}, ${message.answer.explanation}, ${message.answer.example}`

        if (index < updatedQuestions.length) {
          updatedQuestions[index] = question;
          updatedAnswers[index] = messageInParagraph;
        }
        set({
          previousQuestion: updatedQuestions,
          answerOfQuestion: updatedAnswers,
        })
      
      }
        

      await get().playMessage(message);
    } catch (error) {
      console.error("Error asking AI:", error);
      set({ loading: false });
    }
  },

  getQuizQuestions: async () => {
    if (!get().Quiz) return;

    // To handle uncertaniy
    get().setQuizPassedFalse()

    const previousQA = get().previousQuestion.map((question, index) => ({
      question,
      definition: get().answerOfQuestion[index],
    }));

    try {
      // Make the API call to fetch the quiz questions
      const res = await fetch(`/api/mcq?previousQA=${encodeURIComponent(JSON.stringify(previousQA))}`);
      const data = await res.json();
      console.log(data)

      // Setting up the response
      set({
        quizQuestions: data.mcq_questions.map(item => item),
        quizAnswers: data.options.map(item => item),
        quizCorrectAnswer: data.correct_answers.map(item => item),
      });
    } catch (error) {
      console.error("Error retrieving quiz questions:", error);
    }
  },

  playMessage: async (message) => {
    set(() => ({
      currentMessage: message,
    }));

    if (!message.audioPlayer) {
      set(() => ({ loading: true }));
      const textToSpeak = `${message.answer.definition} ${message.answer.explanation} ${message.answer.example}`;
      const audioRes = await fetch(`/api/tts?teacher=${get().teacher}&text=${encodeURIComponent(textToSpeak)}`);
      const audio = await audioRes.blob();
      const visemes = JSON.parse(await audioRes.headers.get("visemes"));
      const audioUrl = URL.createObjectURL(audio);
      const audioPlayer = new Audio(audioUrl);

      message.visemes = visemes;
      message.audioPlayer = audioPlayer;

      const resolver = {
        resolve: null
      };

      const promise = new Promise((resolve) => {
        resolver.resolve = resolve;
        message.audioPlayer.onended = () => {
          set(() => ({ currentMessage: null }));
          if (get().numberOfQuestion === get().maxQuestions) {
            set({ Quiz: true });
            get().playMessageForQuiz();
          }
          resolve();
        };
      });

      set(() => ({
        loading: false,
        messages: get().messages.map((m) => (m.id === message.id ? message : m)),
        currentResolver: resolver,
      }));

      message.audioPlayer.currentTime = 0;
      message.audioPlayer.play();
      return promise;
    }
  },



  playMessageForQuiz: async () => {
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
    if (message.audioPlayer) {
      message.audioPlayer.pause();
    }
    const resolver = get().currentResolver;
    if (resolver && resolver.resolve) {
      resolver.resolve();  // Resolve the promise when the audio is stopped
    }
    set(() => ({
      currentMessage: null,
      currentResolver: null, // Clear the resolver after stopping
    }));
    if (get().numberOfQuestion === get().maxQuestions) {
      set({ Quiz: true });
      get().playMessageForQuiz();
    }
  },

}));