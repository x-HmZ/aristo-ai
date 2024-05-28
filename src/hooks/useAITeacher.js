const { create } = require("zustand");
import { createJSONStorage, persist } from 'zustand/middleware'
import { db } from '@/app/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

export const teachers = ["Sonia", "Ryan"];

export const useAITeacher = create(persist((set, get) => ({
  primaryMode: false,
  setPrimaryMode: (mode) => set({ primaryMode: mode }),
  messages: [],
  currentMessage: null,
  teacher: teachers[0],
  loading: false,
  index: 0,
  classroom: "default",
  quizFailedTimes: 0,
  learningTypes: ["in technical terms", "using metaphors", "as if you are explaining to a ten year old", "as if explaining with a visual example"],

  // Image
  image: null,
  imageFlag: false,
  imageLoader: false,
  setImageFlag: (flag) => set({ imageFlag: flag, imageLoader: true }),

  // Answers and Questions stored before mcq
  quizOngoing: false,
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
  courseMode: false,
  speaking: false,
  role: null,
  id: "",
  userName: "",
  email: "",
  learningStyle: "",
  currentTopic: 0,
  numberOfQuestionAsked: 0,
  selectedCourse: null,
  courses: [],
  topicList: [],
  courseCompleted: false,
  topicsFetched: false,

  // Run when User loged in
  updateUser: (name, email, learningStyle, currenTopic, userId, numberOfQuestionAsked, role, selectedCourse) => {
    console.log("Updating User in Zustand: ", userId, name, email, learningStyle, currenTopic, numberOfQuestionAsked, role, selectedCourse);
    set({
      id: userId,
      userName: name,
      email: email,
      learningStyle: learningStyle,
      currentTopic: currenTopic,
      numberOfQuestionAsked: numberOfQuestionAsked,
      selectedCourse: selectedCourse,
      role: role
    });
  },


  updateNumberOfQuestionAsked: async () => {
    const userId = get().id;
    if (!userId) {
      console.error("User ID is undefined or invalid");
      return;
    }
    const userDocRef = doc(db, "users", userId);
    const newNumberOfQuestionAsked = get().numberOfQuestionAsked + 1;
    try {
      await updateDoc(userDocRef, {
        number_of_question_asked: newNumberOfQuestionAsked
      });
      set({ numberOfQuestionAsked: newNumberOfQuestionAsked });
    } catch (error) {
      console.error("Failed to update number of questions asked in Firestore:", error);
    }
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

  shouldContinue: false,  // State to control the prompt for continuing
  setShouldContinue: (value) => set({ shouldContinue: value }),

  handleContinueAfterFailure: async () => {
    if (get().index < get().maxQuestions) {
      set({ shouldContinue: false });
      await get().askAI(get().previousQuestion[get().index]);
      set({ index: get().index + 1, numberOfQuestion: get().numberOfQuestion + 1, shouldContinue: true });
    } else {
      set({ index: 0, Quiz: true, score: 0 });  // Reset index and start quiz
      console.log("All previous questions have been re-asked.");
    }
  },

  quizFailed: async () => {
    // Reset quiz state
    get().updateTeachingType();
    set({
      quizFailedTimes: get().quizFailedTimes + 1,
      numberOfQuestion: 0,
      Quiz: false,
      quizOngoing: true,
      index: 0,
      score: 0,
      shouldContinue: true  // Enable the continue prompt
    });

    if (get().quizFailedTimes > 2) {
      set({ quizFailedTimes: 0 });
    }
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

      await updateDoc(userDocRef, {
        previous_quiz_score: previousQuizScores
      });

      console.log("Quiz score updated successfully.");
    } catch (error) {
      console.error("Failed to update quiz scores:", error);
    }
  },

  // Course Mode
  setCourseMode: (mode) => {
    set({ courseMode: mode })
  },

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

  // Fetching Names of each course Present in the Database
  fetchAllCourses: async () => {
    const coursesRef = collection(db, "courses");
    try {
      const querySnapshot = await getDocs(coursesRef);
      const courseNames = [];

      querySnapshot.forEach(doc => {
        const courseData = doc.data();
        console.log("Course Data: ", courseData);
        if (typeof courseData.course_name === 'string') {
          courseNames.push(courseData.course_name);
        } else {
          console.error('Invalid course name type:', courseData.course_name);
        }
      });
      console.log("Course Names: ", courseNames);
      if (courseNames.length > 0) {
        set({ courses: courseNames });
        console.log("Fetched course names:", courseNames);
      } else {
        console.log("No courses found!");
        set({ courses: [] });
      }
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    }
  },


  // Fetching the topic list of the selected course
  fetchCourseData: async (param) => {
    set({ topicsFetched: false })
    let courseName = param;

    //No Param then?
    if (!param) {
      courseName = get().selectedCourse;
    } else {
      const userDocRef = doc(db, "users", get().id);
      try {
        set({ selectedCourse: param })
        await updateDoc(userDocRef, {
          selected_course: get().selectedCourse
        });
        console.log("selected_course updated successfully in Firestore.");
      } catch (error) {
        console.error("Failed to update selected_course", error);
      }
    }

    if (!courseName) {
      console.error("No course selected");
      return;
    }

    console.log("Fetching course data for course:", courseName);
    const coursesRef = collection(db, "courses");
    const q = query(coursesRef, where("course_name", "==", courseName));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const courseData = querySnapshot.docs[0].data();
      set({ topicList: courseData.topic_list });
    } else {
      console.log("No such course!");
      set({ topicList: [] });
    }
    console.log("Fetched topic list:", get().topicList);
    set({ topicsFetched: true });

  },

  courseAI: async () => {
    if (get().currentTopic >= get().topicList.length) {
      await get().congratulation();
    } else {
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
    }


  },

  // Course Completed
  congratulation: async () => {
    const newCurrentTopic = 0;
    const userDocRef = doc(db, "users", get().id);
    try {
      set({ currentTopic: newCurrentTopic });
      await updateDoc(userDocRef, {
        current_topic: newCurrentTopic,
        selected_course: null
      });
      console.log("Current topic successfully updated in Firestore and local state.");
    } catch (error) {
      console.error("Failed to update current topic in Firestore:", error);
    }
    set({ courseCompleted: true, selectedCourse: null, numberOfQuestion:0 });
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
    const courseName = get().selectedCourse;
    get().setImageFlag(false);
    console.log("Teaching Type: ", teachingType);
    if (!question) return;


    const message = {
      question,
      id: get().messages.length,
      answer: null,
    };

    set({ loading: true });
    try {
      const res = await fetch(`/api/ai?question=${question}&teachingType=${teachingType}&course=${courseName}`);
      const data = await res.json();
      message.answer = data;
      set(() => ({
        currentMessage: message,
        messages: [...get().messages, message],
        loading: false,
      }));

      // Start playing the message audio
      if (get().quizOngoing) {
        if (get().learningStyle === "as if explaining with a visual example" && get().Quiz === false) {
          get().generateImage(message.answer.imageDescription);
        }
        await get().playMessage(message);
      } else {
        get().playMessage(message);
        if (get().learningStyle === "as if explaining with a visual example" && get().Quiz === false) {
          get().generateImage(message.answer.imageDescription);
        }
      }

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
      console.log("Ask AI ended")
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

          // if (get().currentTopic === get().topicList.length - 1 && get().courseMode) {
          //   get().congratulation();
          // }

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
    } else {
      message.audioPlayer.play();
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
      message.audioPlayer.currentTime = 0;
    }


    // if (get().currentTopic === get().topicList.length - 1) {
    //   get().congratulation();
    // }

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

}), {
  name: 'userStore',
  storage: createJSONStorage(() => sessionStorage),

}));