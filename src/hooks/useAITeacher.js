const { create } = require("zustand");
import { db } from '@/app/firebase/config'; // Ensure this import points to your actual config file
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

export const teachers = ["Sonia", "Ryan"];

export const useAITeacher = create((set, get) => ({
  messages: [],
  currentMessage: null,
  teacher: teachers[0],
  loading: false,
  index: 0,
  classroom: "default",
  quizFailedTimes: 0,
  learningTypes: ["in technical terms", "using metaphors", "as if you are explaining to a ten year old", "as if explaining with a visual example"],
  image: null,
  imageFlag: false,
  setImageFlag: (flag) => set({ imageFlag: flag }),
  quizOngoing: false,

  // Answers and Questions stored before mcq
  maxQuestions: 3,
  numberOfQuestion: 0,
  answerOfQuestion: [],
  previousQuestion: [],
  // For change of Mode
  tempAnswerOfQuestion: [],
  tempPreviousQuestion: [],
  tempNumberOfQuestion: 0,


  // Start quiz and sructure the response  
  Quiz: false,
  quizQuestions: [],
  quizAnswers: [],
  quizCorrectAnswer: [],
  score: 0,
  quizPassed: false,

  // Database Variables
  courseMode: true,
  speaking: false,
  id: "",
  userName: "",
  email: "",
  learningStyle: "",
  currentTopic: 0,
  topicList: [],  // This will be from "Courses" collection

  updateUser: (name, email, learningStyle, currenTopic) => {
    console.log("Updating User in Zustand: ", name, email, learningStyle, currenTopic);
    set({
      userName: name,
      email: email,
      learningStyle: learningStyle,
      currentTopic: currenTopic,
    });
  },

  // Quize Part
  getTeachingType: async () => {
    return get().learningStyle;
  },

  updateTeachingType: async () => {
    const newLearningStyle = get().learningTypes[(get().learningTypes.indexOf(get().learningStyle) + 1) % get().learningTypes.length];
    set({ learningStyle: newLearningStyle });

    const userDocRef = doc(db, "users", get().id);
    try {
      await updateDoc(userDocRef, {
        learning_style: newLearningStyle
      });
      console.log("Learning style updated successfully in Firestore.");
    } catch (error) {
      console.error("Failed to update learning style in Firestore:", error);
    }
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
    get().updateTeachingType();
    set({ quizFailedTimes: get().quizFailedTimes + 1 });
    if (get().quizFailedTimes > 2) { set({ quizFailedTimes: 0 }) };
    set({ numberOfQuestion: 0 });
    set({ Quiz: false });
    set({ quizOngoing: true })

    for (get().index; get().index < get().maxQuestions; set({ index: get().index + 1 })) {
      await get().askAI(get().previousQuestion[get().index]);
      set({ numberOfQuestion: get().numberOfQuestion + 1 })
    }
    set({ index: 0 });
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

  appendStoredQuizScore: async () => {
    const userDocRef = doc(db, "users", get().id);
    const currentScore = get().score;

    try {
      const docSnap = await getDoc(userDocRef);
      let previousQuizScores = docSnap.exists() && docSnap.data().previous_quiz_score ? docSnap.data().previous_quiz_score : [];

      // Append the current score to the array
      previousQuizScores.push(currentScore);

      // Update the document with the new scores array
      await updateDoc(userDocRef, {
        previous_quiz_score: previousQuizScores
      });

      console.log("Quiz score updated successfully.");
    } catch (error) {
      console.error("Failed to update quiz scores:", error);
    }
  },

  // Course Mode
  setCourseMode: (mode) => set({ courseMode: mode }),

  checkingInNoramlMode: () => {
    const { answerOfQuestion, previousQuestion, numberOfQuestion } = get();

    console.log("Normal mode")
    if (answerOfQuestion.length !== 0) {
      set({ tempAnswerOfQuestion: [...answerOfQuestion] });
      console.log("Temp Answer of Question: ", get().tempAnswerOfQuestion)
      set({ answerOfQuestion: [] });
    }

    if (previousQuestion.length !== 0) {
      set({ tempPreviousQuestion: [...previousQuestion] });
      console.log("Temp Previous Question: ", get().tempPreviousQuestion)
      set({ previousQuestion: [] });
    }

    if (numberOfQuestion !== 0) {
      set({ tempNumberOfQuestion: numberOfQuestion });
      console.log("Temp Number of Question: ", get().tempNumberOfQuestion)
      set({ numberOfQuestion: 0 });
    }
  },

  checkingInCourseMode: () => {
    const { tempAnswerOfQuestion, tempPreviousQuestion, tempNumberOfQuestion } = get();
    if (tempAnswerOfQuestion.length !== 0) {
      set({ answerOfQuestion: [...tempAnswerOfQuestion] });
      console.log("Answer of Question: ", get().answerOfQuestion)
      set({ tempAnswerOfQuestion: [] });
    }
    console.log("course Mode")
    if (tempPreviousQuestion.length !== 0) {
      set({ previousQuestion: [...tempPreviousQuestion] });
      console.log("Previous Question: ", get().previousQuestion)
      set({ tempPreviousQuestion: [] });
    }

    if (tempNumberOfQuestion !== 0) {
      set({ numberOfQuestion: tempNumberOfQuestion });
      console.log("Number of Question: ", get().numberOfQuestion)
      set({ tempNumberOfQuestion: 0 });
    }
  },

  fetchCourseData: async (userId) => {
    set({ id: userId });
    const coursesRef = collection(db, "courses");
    const q = query(coursesRef, where("course_name", "==", "Science 4th"));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const courseData = querySnapshot.docs[0].data();
      set({ topicList: courseData.topic_list });
    } else {
      console.log("No such course!");
      set({ topicList: [] });
    }

  },

  courseAI: async () => {
    const whereAMI = get().topicList[get().currentTopic];
    const question = `What is ${whereAMI}?`;
    await get().askAI(question);

    // Update the current topic
    const newCurrentTopic = get().currentTopic + 1;

    const userDocRef = doc(db, "users", get().id);
    try {
      set({ currentTopic: newCurrentTopic });
      await updateDoc(userDocRef, {
        current_topic: newCurrentTopic
      });
      console.log("Current topic successfully updated in Firestore and local state.");
    } catch (error) {
      console.error("Failed to update current topic in Firestore:", error);
    }


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
    const teachingType = get().learningStyle;
    console.log("Teaching Type: ", teachingType);
    if (!question) return;
    if (get().learningStyle !== "as if explaining with a visual example") get().setImageFlag(false);
  
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
  
      // Start the image generation process in the background
      if (get().learningStyle === "as if explaining with a visual example") {
        get().generateImage(question);
      }

      // Start playing the message audio
      await get().playMessage(message);
  
      if (!get().quizOngoing) {
        set({ numberOfQuestion: get().numberOfQuestion + 1 });
        const messageInParagraph = `${message.answer.definition}, ${message.answer.explanation}, ${message.answer.example}`;
        set({ previousQuestion: [...get().previousQuestion, message.question] });
        set({ answerOfQuestion: [...get().answerOfQuestion, messageInParagraph] });
      } else {
        // Replace existing question and answer pairs during a quiz
        const index = get().index;
        const updatedQuestions = [...get().previousQuestion];
        const updatedAnswers = [...get().answerOfQuestion];
        const messageInParagraph = `${message.answer.definition}, ${message.answer.explanation}, ${message.answer.example}`;
  
        if (index < updatedQuestions.length) {
          updatedQuestions[index] = question;
          updatedAnswers[index] = messageInParagraph;
        }
        set({
          previousQuestion: updatedQuestions,
          answerOfQuestion: updatedAnswers,
        });
      }
    } catch (error) {
      console.error("Error asking AI:", error);
      set({ loading: false });
    }
  },
  
  generateImage: async (question) => {
    try {
      console.log("image started bsdk")
      const res = await fetch(`/api/image_generation?prompting=${question}`);
      const data = await res.json();
      set({ image: data.image });
      get().setImageFlag(true);
    } catch (e) {
      console.log("Image not generated :(", e);
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
      speaking: true,
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
          set(() => ({ currentMessage: null, speaking: false }));
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
      currentResolver: null,
      speaking: false,
    }));
    if (get().numberOfQuestion === get().maxQuestions) {
      set({ Quiz: true });
      get().playMessageForQuiz();
    }
  },

}));