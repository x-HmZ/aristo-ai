const { create } = require("zustand");

export const teachers = ["Sonia", "Ryan"];

export const useAITeacher = create((set, get) => ({
  messages: [],
  currentMessage: null,
  teacher: teachers[0],
  loading: false,
  classroom: "default",

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
      get().playMessage(message);
    } catch (error) {
      console.error("Error asking AI:", error);
      set({ loading: false });
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

  stopMessage: (message) => {
    message.audioPlayer.pause();
    set(() => ({
      currentMessage: null,
    }));
  },
}));
