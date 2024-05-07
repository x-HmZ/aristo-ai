import { useAITeacher } from '@/hooks/useAITeacher';
import { useEffect } from 'react';

export const QuizBox = () => {
    // Accessing Zustand state
    const { quizQuestions, quizAnswers, quizCorrectAnswer, getQuizQuestions, Quiz } = useAITeacher();

    // Trigger to start the quiz
    useEffect(() => {
        if (Quiz) {
            getQuizQuestions();
        }
    }, [Quiz, getQuizQuestions]);

    console.log(quizQuestions, quizAnswers, quizCorrectAnswer);

    // Handle option selection
    const handleOptionClick = (option) => {
        alert(`You selected: ${option}, Correct answer: ${quizCorrectAnswer}`);
    };

    // Rendering logic
    if (!quizQuestions) {
        return <div>Loading quiz...</div>;
    }

    return (
        <div className="max-w-md mx-auto bg-white shadow-lg rounded-lg border border-gray-200 p-6 mt-8">
            <div className="text-center text-2xl font-semibold mb-4 text-black">
                Quiz Time
            </div>
            <div className="text-lg font-medium mb-4 text-black">
                {quizQuestions}
            </div>
            <div className="space-y-3 mb-4">
                {quizAnswers.map((option, index) => (
                    <button
                        key={index}
                        onClick={() => handleOptionClick(option)}
                        className="w-full text-left px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 text-black"
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
};
