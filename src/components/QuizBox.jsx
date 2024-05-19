import { useAITeacher } from '@/hooks/useAITeacher';
import { useEffect, useState } from 'react';

export const QuizBox = () => {
    const { quizQuestions, quizAnswers, quizCorrectAnswer, getQuizQuestions, Quiz, score, updateScore, setQuizPassedTrue, setQuizPassedFalse, quizFinished, quizFailed, appendStoredQuizScore } = useAITeacher();

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);

    // Triggering to start the quiz
    useEffect(() => {
        if (Quiz) {
            getQuizQuestions();
        }
    }, [Quiz, getQuizQuestions]);


    // Handle Selected Option
    const handleOptionClick = (selectedOption) => {
        const correctAnswer = quizCorrectAnswer[currentQuestionIndex];
        // Check if the selected option is correct
        if (selectedOption === correctAnswer) {
            updateScore()
        }
        setSelectedOption(selectedOption);
    };

    // Function to handle moving to the next question
    const handleNextQuestion = () => {
        // Move to the next question
        if (currentQuestionIndex < quizQuestions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            // Clear the selected option for the next question
            setSelectedOption(null);
        } else {
            alert(`Quiz completed! Your score: ${score}/${quizQuestions.length}`);
            appendStoredQuizScore();
            if (score >= 3) {
                setQuizPassedTrue();
                quizFinished();

            } else {
                setQuizPassedFalse();
                quizFailed();
            }

        }
    };

    // Rendering logic
    if (!quizQuestions.length || !quizAnswers.length) {
        return <div>Loading quiz...</div>;
    }

    // Extract current question and options based on the current index
    const currentQuestion = quizQuestions[currentQuestionIndex];
    const currentOptions = quizAnswers[currentQuestionIndex];

    return (
        <div className="max-w-md mx-auto bg-white shadow-lg rounded-lg border border-gray-200 p-6 mt-8">
            <div className="text-center text-2xl font-semibold mb-4 text-black">
                Quiz Time
            </div>
            <div className="text-lg font-medium mb-4 text-black">
                {currentQuestion}
            </div>
            <div className="space-y-3 mb-4">
                {currentOptions.map((option, index) => (
                    <button
                        key={index}
                        onClick={() => handleOptionClick(option)}
                        className={`w-full text-left px-4 py-2 ${selectedOption === option
                            ? "bg-blue-200 hover:bg-blue-300"
                            : "bg-gray-100 hover:bg-gray-200"
                            } rounded-lg border border-gray-300 text-black`}
                    >
                        {option}
                    </button>
                ))}
            </div>
            <button
                onClick={handleNextQuestion}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
            >
                Next
            </button>
        </div>
    );
};
