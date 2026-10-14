/**
 * FROZEN DEMO CONTENT: the 2026-10-14 V10 live test (.claude/eval/2026-10-14-v10-live/python-for-range).
 * Lesson, widget (metadata.demo_interactive) and quiz as generated; images by demo-assets.run.ts.
 * Served with zero API calls (public/demo/python-for-range/). Do not hand-edit.
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

export const lesson: LessonPayload = {
  "concept_id": "python-for-range",
  "concept_name": "Python for loops with range()",
  "phases": {
    "activate": {
      "content": "Connect for-loops to the learner's existing experience with manual repetition and counting, framing range() as an automated counter.",
      "prerequisites_referenced": [
        "counting numbers",
        "repetition"
      ],
      "segment_ids": [
        "seg_001",
        "seg_002"
      ]
    },
    "explain": {
      "analogy": "range(start, stop, step) is like a countdown timer at a race: start is the beginning, step is the tick size, and stop is a finish line the timer stops just before touching.",
      "formal_explanation": "range(start, stop, step) generates a sequence of numbers beginning at start, incrementing by step each time, and halting as soon as the next value would equal or exceed stop. The stop value is always excluded from the output.",
      "key_insight": "range() stops BEFORE reaching stop — stop is a boundary, not a value you'll ever see produced.",
      "segment_ids": [
        "seg_003",
        "seg_004",
        "seg_005"
      ]
    },
    "demonstrate": {
      "example_description": "Trace a for loop using range(1, 5) that accumulates a running total, showing how 'total' changes on each iteration.",
      "step_by_step": [
        "Initialize total = 0 before the loop starts.",
        "Loop iteration 1: i=1, total = 0+1 = 1",
        "Loop iteration 2: i=2, total = 1+2 = 3",
        "Loop iteration 3: i=3, total = 3+3 = 6",
        "Loop iteration 4: i=4, total = 6+4 = 10",
        "Loop ends because the next value, 5, equals stop and is excluded."
      ],
      "narration_pre_visual": "Let's trace a real loop step by step, including one that adds up numbers as it goes — that's called accumulating a total.",
      "visual_walkthrough": "Look at the code and table on screen: total starts at 0, and as i takes the values 1, 2, 3, 4 from range(1,5), total grows to 1, then 3, then 6, then 10. Notice the table never shows i=5 — that's the excluded stop value in action.",
      "code": "total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)",
      "output": "10",
      "segment_ids": [
        "seg_006",
        "seg_007",
        "seg_008",
        "seg_009",
        "seg_010",
        "seg_011"
      ]
    },
    "challenge": {
      "question": "Suppose you write for i in range(2, 10, 3): print(i). What values get printed, and why does the loop never print 11, even though 11 would logically be the 'next' value after the last one printed?",
      "hint": "Each time, range checks whether the NEXT value would reach or pass stop (10) before producing it — it doesn't just check if it's already past.",
      "answer": "It prints 2, 5, 8. Adding 3 repeatedly gives 2, 5, 8, then 11 — but since 11 is greater than or equal to stop (10), range never produces it. The loop stops right after printing 8.",
      "segment_ids": [
        "seg_012",
        "seg_013"
      ]
    },
    "connect": {
      "content": "For loops with range() give you controlled, predictable repetition — the same pattern powers totals, counters, and simulations throughout programming.",
      "next_concept": "Looping directly over items in a list (for item in list)",
      "segment_ids": [
        "seg_014"
      ]
    }
  },
  "segments": [
    {
      "id": "seg_001",
      "phase": "activate",
      "role": "hook",
      "text": "You already know how to repeat a word on a sticky note five times by writing it out five times by hand. A for loop is Python doing that repetition for you — automatically.",
      "gesture": "explaining"
    },
    {
      "id": "seg_002",
      "phase": "activate",
      "role": "narrate",
      "text": "You've also counted things before: '1, 2, 3, 4, 5, go!' That act of counting through a sequence of numbers is exactly what Python's range() does for a loop."
    },
    {
      "id": "seg_003",
      "phase": "explain",
      "role": "narrate",
      "text": "Think of range(start, stop, step) like a countdown timer at a race: start is where the timer begins, step is how much it ticks down (or up) each time, and stop is the finish line — but the timer stops the instant BEFORE it reaches that line, never touching it.",
      "gesture": "explaining"
    },
    {
      "id": "seg_004",
      "phase": "explain",
      "role": "narrate",
      "text": "Formally: range(start, stop, step) produces values beginning at start, adding step each time, and stopping as soon as the next value would reach or pass stop. The stop value itself is never included.",
      "visual": {
        "prompt": "Number line from 0 to 6, dots placed at 1, 2, 3, 4 highlighted in blue, number 5 shown with a red X and label 'stop - never included'. Caption: range(1, 5) produces 1,2,3,4",
        "style": "diagram",
        "callouts": [
          "start = 1",
          "stop = 5 (excluded)",
          "values: 1,2,3,4"
        ],
        "imageUrl": "/demo/python-for-range/seg_004.png"
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_005",
      "phase": "explain",
      "role": "callout",
      "text": "This trips up almost everyone at first: range(1, 5) feels like it should include 5, but it actually stops right before it, giving you 1, 2, 3, 4.",
      "gesture": "pointing"
    },
    {
      "id": "seg_006",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Let's trace a real loop step by step, including one that adds up numbers as it goes — that's called accumulating a total.",
      "gesture": "explaining"
    },
    {
      "id": "seg_007",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Here's our code: we set total to 0, then loop over range(1, 5), adding each number to total.",
      "visual": {
        "prompt": "Code block showing total=0, for i in range(1,5): total += i, with a table tracking i and total across 4 rows: i=1 total=1, i=2 total=3, i=3 total=6, i=4 total=10",
        "style": "process_flow",
        "callouts": [
          "i = 1,2,3,4",
          "total builds up: 1, 3, 6, 10"
        ],
        "imageUrl": "/demo/python-for-range/seg_007.png"
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_008",
      "phase": "demonstrate",
      "role": "explore",
      "text": "Before we trace it fully, play with the board on screen — try the Start slider and watch which dot appears first on the number line.",
      "gesture": "idle"
    },
    {
      "id": "seg_009",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "On the first pass, i is 1, so total becomes 0 + 1 = 1. On the second pass, i is 2, so total becomes 1 + 2 = 3.",
      "gesture": "explaining"
    },
    {
      "id": "seg_010",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Third pass: i is 3, total becomes 3 + 3 = 6. Fourth pass: i is 4, total becomes 6 + 4 = 10. Then the loop stops — there's no i equal to 5, because 5 is the excluded stop value.",
      "gesture": "pointing"
    },
    {
      "id": "seg_011",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "So after the loop finishes, total is 10 — the sum of 1, 2, 3, and 4, exactly as we traced."
    },
    {
      "id": "seg_012",
      "phase": "challenge",
      "role": "challenge_setup",
      "text": "Here's a thinking question: suppose you write for i in range(2, 10, 3): print(i). What values get printed, and why does the loop never print 11, even though 11 would be the 'next' step after the last printed value?",
      "gesture": "thinking"
    },
    {
      "id": "seg_013",
      "phase": "challenge",
      "role": "challenge_reveal",
      "text": "It prints 2, 5, 8. Starting at 2 and adding 3 each time gives 2, 5, 8, then 11 — but 11 is greater than or equal to stop (10), so range stops before producing it. The loop simply never gets that far; it checks before each step whether the next value would reach or pass stop.",
      "gesture": "explaining"
    },
    {
      "id": "seg_014",
      "phase": "connect",
      "role": "transition",
      "text": "For loops with range() are the backbone of repetition in Python — you'll use this exact pattern to process lists, build totals, and control games or simulations. Next, you'll learn how to loop directly over items in a list, not just numbers.",
      "gesture": "idle"
    }
  ],
  "metadata": {
    "estimated_read_time_minutes": 5,
    "bloom_level_taught": "Apply",
    "depth_level": "moderate",
    "should_generate_model": false,
    "interactive": {
      "goal": "See exactly which numbers range(start, stop, step) produces, and notice that stop is never included.",
      "brief": "A number line from 0 to 20 with dots appearing at each value range() produces, highlighted one at a time in order, plus a text output showing the list of values.",
      "controls": [
        {
          "label": "Start",
          "kind": "slider",
          "effect": "Moves the first dot that appears on the number line."
        },
        {
          "label": "Stop",
          "kind": "slider",
          "effect": "Moves the boundary line; the dot sequence always stops BEFORE this value."
        },
        {
          "label": "Step",
          "kind": "slider",
          "effect": "Changes the spacing between dots on the number line."
        }
      ],
      "try_this": [
        "Set Start=1, Stop=5, Step=1 and count the dots.",
        "Set Stop to a value and check it never gets its own dot.",
        "Make Step=2 and watch every other number get skipped."
      ]
    },
    "demo_interactive": {
      "title": "range() on a number line",
      "markup": "<div class=\"stack\">\n  <div class=\"readout\" id=\"code\" aria-live=\"polite\">range(1, 5, 1)</div>\n  <div class=\"stage\"><canvas id=\"plot\" role=\"img\" aria-label=\"Number line showing the values produced by range\"></canvas></div>\n  <div class=\"row\">\n    <p class=\"readout\" id=\"list\" aria-live=\"polite\">[1, 2, 3, 4]</p>\n  </div>\n  <div class=\"controls\">\n    <div class=\"control\"><label for=\"start\">Start <span class=\"value\" id=\"startv\">1</span></label>\n      <input id=\"start\" type=\"range\" min=\"0\" max=\"20\" step=\"1\" value=\"1\"></div>\n    <div class=\"control\"><label for=\"stop\">Stop <span class=\"value\" id=\"stopv\">5</span></label>\n      <input id=\"stop\" type=\"range\" min=\"0\" max=\"20\" step=\"1\" value=\"5\"></div>\n    <div class=\"control\"><label for=\"step\">Step <span class=\"value\" id=\"stepv\">1</span></label>\n      <input id=\"step\" type=\"range\" min=\"1\" max=\"5\" step=\"1\" value=\"1\"></div>\n  </div>\n  <div class=\"row\">\n    <button type=\"button\" id=\"play\">Play dots</button>\n    <span class=\"hint\">stop is a boundary, never a dot</span>\n  </div>\n</div>\n",
      "css": "\n#code{text-align:center;font:600 16px ui-monospace,Menlo,Consolas,monospace}\n#list{text-align:center;font-size:14px;min-height:1.6em}\n",
      "js": "\nvar C = ARISTO.colors;\nvar startIn = document.getElementById('start');\nvar stopIn = document.getElementById('stop');\nvar stepIn = document.getElementById('step');\nvar playBtn = document.getElementById('play');\n\nvar reduceMotion = (typeof matchMedia === 'function') && matchMedia('(prefers-reduced-motion: reduce)').matches;\n\nvar values = [];\nvar visibleCount = 0; // how many dots are currently shown (for animation)\nvar animId = null;\nvar playing = false;\n\nfunction computeValues() {\n  var start = +startIn.value;\n  var stop = +stopIn.value;\n  var step = +stepIn.value;\n  if (step < 1) step = 1;\n  var vals = [];\n  if (start < stop) {\n    for (var v = start; v < stop; v += step) {\n      vals.push(v);\n      if (vals.length > 200) break;\n    }\n  }\n  return vals;\n}\n\nvar MIN = 0, MAX = 20;\n\nvar plot = ARISTO.canvas(document.getElementById('plot'), function (ctx, w, h) {\n  var start = +startIn.value;\n  var stop = +stopIn.value;\n  var step = +stepIn.value;\n  var pad = 20;\n  var usableW = w - pad * 2;\n  var oy = h * 0.55;\n\n  function X(n) { return pad + (n - MIN) / (MAX - MIN) * usableW; }\n\n  // baseline\n  ctx.strokeStyle = C.muted;\n  ctx.lineWidth = 1.5;\n  ctx.beginPath();\n  ctx.moveTo(X(MIN), oy);\n  ctx.lineTo(X(MAX), oy);\n  ctx.stroke();\n\n  // tick marks every 2 units, labels every 4\n  ctx.fillStyle = C.muted;\n  ctx.font = '12px system-ui, sans-serif';\n  ctx.textAlign = 'center';\n  for (var n = MIN; n <= MAX; n += 2) {\n    var x = X(n);\n    ctx.beginPath();\n    ctx.moveTo(x, oy - 5);\n    ctx.lineTo(x, oy + 5);\n    ctx.stroke();\n    if (n % 4 === 0) {\n      ctx.fillText(String(n), x, oy + 20);\n    }\n  }\n\n  // stop boundary line\n  var stopX = X(stop);\n  ctx.strokeStyle = C.danger;\n  ctx.lineWidth = 2;\n  ctx.setLineDash([4, 4]);\n  ctx.beginPath();\n  ctx.moveTo(stopX, oy - 28);\n  ctx.lineTo(stopX, oy + 28);\n  ctx.stroke();\n  ctx.setLineDash([]);\n  ctx.fillStyle = C.danger;\n  ctx.font = '600 12px system-ui, sans-serif';\n  ctx.fillText('stop', stopX, oy - 34);\n\n  // dots for produced values\n  var shown = Math.min(visibleCount, values.length);\n  for (var i = 0; i < values.length; i++) {\n    var val = values[i];\n    var x2 = X(val);\n    var isShown = i < shown;\n    var isLast = i === shown - 1;\n    ctx.beginPath();\n    ctx.arc(x2, oy, isLast ? 8 : 6, 0, Math.PI * 2);\n    ctx.fillStyle = isShown ? (isLast ? C.accentText : C.accent) : C.sunk;\n    ctx.globalAlpha = isShown ? 1 : 0.3;\n    ctx.fill();\n    ctx.globalAlpha = 1;\n    if (isShown) {\n      ctx.fillStyle = C.ink;\n      ctx.font = '12px system-ui, sans-serif';\n      ctx.fillText(String(val), x2, oy - 14);\n    }\n  }\n}, 0.3);\n\nfunction fmt() {\n  var start = +startIn.value;\n  var stop = +stopIn.value;\n  var step = +stepIn.value;\n  document.getElementById('startv').textContent = String(start);\n  document.getElementById('stopv').textContent = String(stop);\n  document.getElementById('stepv').textContent = String(step);\n  document.getElementById('code').textContent = 'range(' + start + ', ' + stop + ', ' + step + ')';\n  var shown = Math.min(visibleCount, values.length);\n  var shownVals = values.slice(0, shown);\n  document.getElementById('list').textContent = '[' + shownVals.join(', ') + ']' +\n    (shown < values.length ? ' ...' : '');\n}\n\nfunction stopAnim() {\n  playing = false;\n  if (animId !== null) { cancelAnimationFrame(animId); animId = null; }\n  playBtn.textContent = 'Play dots';\n}\n\nfunction rebuild(startAnimated) {\n  stopAnim();\n  values = computeValues();\n  visibleCount = values.length; // default: show all immediately\n  fmt();\n  plot.redraw();\n}\n\nvar lastTime = 0;\nvar stepInterval = 450;\n\nfunction tick(ts) {\n  if (!lastTime) lastTime = ts;\n  if (ts - lastTime >= stepInterval) {\n    lastTime = ts;\n    visibleCount++;\n    fmt();\n    plot.redraw();\n    if (visibleCount >= values.length) {\n      stopAnim();\n      return;\n    }\n  }\n  animId = requestAnimationFrame(tick);\n}\n\nfunction startPlay() {\n  if (values.length === 0) return;\n  playing = true;\n  visibleCount = 0;\n  lastTime = 0;\n  playBtn.textContent = 'Pause';\n  fmt();\n  plot.redraw();\n  animId = requestAnimationFrame(tick);\n}\n\nplayBtn.addEventListener('click', function () {\n  if (playing) {\n    stopAnim();\n  } else {\n    startPlay();\n  }\n});\n\n[startIn, stopIn, stepIn].forEach(function (el) {\n  el.addEventListener('input', function () { rebuild(); });\n});\n\nrebuild();\nif (reduceMotion) {\n  // ensure fully visible, no autoplay\n  visibleCount = values.length;\n  fmt();\n  plot.redraw();\n}\n"
    }
  }
};

// The generated code_completion and code_debugging questions were left out: /demo grades on the client by exact match.
export const quiz: QuizQuestion[] = [
  {
    "question_type": "true_false",
    "bloom_level": "remember",
    "question": "In Python, the call range(1, 5) produces the sequence 1, 2, 3, 4, 5.",
    "correct_answer": "False",
    "explanation_correct": "range(start, stop) generates numbers from start up to but NOT including stop, so range(1, 5) produces 1, 2, 3, 4 only.",
    "explanation_wrong": {
      "True": "This is incorrect because range() stops BEFORE the stop value — 5 is excluded, so the sequence is only 1, 2, 3, 4."
    },
    "difficulty": 0.25,
    "estimated_seconds": 30,
    "misconception_targeted": "Believing range(start, stop) includes the stop value.",
    "id": "python-for-range-q1",
    "concept_id": "python-for-range"
  },
  {
    "question_type": "multiple_choice",
    "bloom_level": "understand",
    "question": "What will be printed by the following code?\n\nfor i in range(2, 10, 3):\n    print(i)",
    "options": [
      "2 5 8",
      "2 5 8 11",
      "2 3 4 5 6 7 8 9",
      "3 6 9"
    ],
    "correct_answer": "2 5 8",
    "explanation_correct": "range(2, 10, 3) starts at 2, adds 3 each step, and stops before reaching or passing 10. So it produces 2, 5, 8 (the next value, 11, would exceed 10, so it stops).",
    "explanation_wrong": {
      "2 5 8 11": "11 is not included because it is greater than or equal to the stop value, 10. range() always stops before reaching the stop value.",
      "2 3 4 5 6 7 8 9": "This would be the result if the step were 1, but the step here is 3, so numbers are skipped between values.",
      "3 6 9": "This ignores the start value of 2; the sequence must begin at the specified start, not at a multiple of the step."
    },
    "difficulty": 0.4,
    "estimated_seconds": 45,
    "misconception_targeted": "Confusing step behavior with start value, or thinking stop is inclusive.",
    "id": "python-for-range-q2",
    "concept_id": "python-for-range"
  }
];
