import Hero from "@/components/Hero";

export default function Home() {
  return (
    <main className="h-screen relative flex flex-col justify-center items-center bg-black text-white">
      <div className="w-full">
        {/* <Hero /> */}


        <h1 className="text-4xl font-bold mb-8">
          Currently Building...
        </h1>
        <div className="space-x-4">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            <a href="/sign-up">Sign Up</a>
          </button>
          <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
            <a href="/sign-in">Sign Ins</a>
          </button>
        </div>
      </div>
    </main>
  );
}
