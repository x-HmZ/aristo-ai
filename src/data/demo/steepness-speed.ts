/**
 * FROZEN DEMO CONTENT: the V10 interactive-visual topic (Hmz, 2026-10-15): steepness is speed, the idea behind
 * differentiation framed for grade 8. Written by .claude/eval/2026-10-15-steepness/scripts/freeze.cjs from that run:
 * the lesson as generated, the curated spec (the lesson's worked example plus a curve for the tangent) and the widget
 * made from it with the edits in curate.cjs. The quiz keeps its true/false and multiple-choice questions: /demo grades
 * on the client by exact match. Served with zero API calls (public/demo/steepness-speed/). Do not hand-edit.
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

export const lesson: LessonPayload = {
  "concept_id": "steepness-speed",
  "concept_name": "Steepness is speed: reading a distance-time graph",
  "phases": {
    "activate": {
      "content": "We connect to the learner's existing knowledge of slope (rise over run) and the formula speed = distance/time, framing the graph's steepness as literally performing that division visually.",
      "segment_ids": [
        "seg_001",
        "seg_002"
      ],
      "prerequisites_referenced": [
        "slope as rise over run",
        "speed = distance / time"
      ]
    },
    "explain": {
      "analogy": "A hiking trail elevation chart: steep uphill = climbing fast per step, flat = resting, regardless of how high up the trail already is.",
      "formal_explanation": "On a distance-time graph, the slope (steepness) of the line at any point equals the speed at that moment. A straight line = constant slope = steady speed. A curve = changing slope = changing speed. A horizontal (flat) line = zero slope = stopped, independent of its height on the distance axis.",
      "key_insight": "Steepness, not height, is speed — and a curved line describes changing speed over time, not a curved path on the ground.",
      "segment_ids": [
        "seg_003",
        "seg_004",
        "seg_005",
        "seg_006"
      ]
    },
    "demonstrate": {
      "example_description": "A three-segment distance-time graph: steady climb, flat stop, then steep climb, computing speed as rise/run for each piece.",
      "step_by_step": [
        "Segment 1 (0-4s): rises 20m, slope = 20/4 = 5 m/s, steady speed.",
        "Segment 2 (4-7s): flat at 20m, slope = 0, runner stopped.",
        "Segment 3 (7-9s): rises 20m in 2s, slope = 20/2 = 10 m/s, double the first segment's speed, visibly steeper on the graph."
      ],
      "narration_pre_visual": "Let's work through an actual graph step by step and read off the speeds using only steepness — no formulas needed beyond rise over run.",
      "visual_walkthrough": "Look at the first segment highlighted on the graph — it rises 20 meters over 4 seconds, a slope of 5 m/s. Now compare it to the third segment, which climbs the same 20 meters but in only 2 seconds — see how visibly steeper that line looks? That steepness directly shows it's twice as fast.",
      "segment_ids": [
        "seg_007",
        "seg_008",
        "seg_009",
        "seg_010",
        "seg_011",
        "seg_012"
      ]
    },
    "challenge": {
      "question": "Two runners' graphs cross at the same point (same distance at that instant). One is a shallow straight line, the other a curve bending steeply upward right at the crossing. Which runner is faster at that exact moment, and why doesn't being at the same distance decide it?",
      "hint": "Speed is read from the tangent line's steepness at that instant, not from the height where the two lines meet.",
      "answer": "The runner on the curve is faster at that instant, because the tangent line touching the curve there is steeper than the other runner's straight line. Being at the same distance only means same position — steepness, not position, determines speed.",
      "segment_ids": [
        "seg_013",
        "seg_014"
      ]
    },
    "connect": {
      "content": "This idea — that steepness at a single instant captures a rate — is the foundation of calculus and the derivative, and it generalizes to reading any graph (growth, temperature, etc.) by asking whether height or steepness answers the real question.",
      "next_concept": "Tangent lines and the derivative as instantaneous rate of change",
      "segment_ids": [
        "seg_015"
      ]
    }
  },
  "segments": [
    {
      "id": "seg_001",
      "phase": "activate",
      "role": "hook",
      "text": "Imagine you're watching a runner on a track, and someone hands you a graph of how far they've gone over time. You already know speed is just distance divided by time — so how could a graph possibly show that without you doing any division?",
      "gesture": "explaining"
    },
    {
      "id": "seg_002",
      "phase": "activate",
      "role": "narrate",
      "text": "You already know slope as rise over run from plain graphs. On a distance-time graph, the 'rise' is distance covered and the 'run' is time passed — and dividing those two is exactly the speed formula you already know."
    },
    {
      "id": "seg_003",
      "phase": "explain",
      "role": "narrate",
      "text": "Here's the picture to hold in your head: imagine a hiking trail drawn on a map as a side-view elevation chart. A steep uphill section means you're climbing fast for each step forward; a flat section means you've stopped climbing entirely — you're just resting. Steepness is effort-per-step, not how high up you already are.",
      "gesture": "explaining"
    },
    {
      "id": "seg_004",
      "phase": "explain",
      "role": "narrate",
      "text": "Formally: on a distance-time graph, the steepness — the slope — of the line at any moment equals the speed at that moment. A straight line has the same steepness everywhere, meaning steady, unchanging speed. A curve means the steepness is changing from point to point, so the speed itself is changing. And a flat, horizontal stretch has zero steepness — that means stopped, no matter how high up on the distance axis it sits.",
      "visual": {
        "prompt": "Distance-time graph showing three labeled sections: a steep straight line labeled 'fast steady speed', a flat line labeled 'stopped', and a curve labeled 'changing speed'. Axes: Distance (m) vertical, Time (s) horizontal.",
        "style": "diagram",
        "callouts": [
          "Steep = fast",
          "Flat = stopped",
          "Curve = changing speed"
        ],
        "persists_to_next": true,
        "imageUrl": "/demo/steepness-speed/seg_004.png"
      },
      "pause_after": 1
    },
    {
      "id": "seg_005",
      "phase": "explain",
      "role": "callout",
      "text": "Look closely at that flat section in the diagram — notice it can be sitting way up high on the distance axis. That height just means the runner has already covered a lot of ground, not that they're moving fast right now. High up and standing still are completely different things from fast and still moving.",
      "gesture": "pointing"
    },
    {
      "id": "seg_006",
      "phase": "explain",
      "role": "narrate",
      "text": "And here's the key insight for curves: the line's shape on the graph does NOT mean the runner ran in a curved path on the ground. The graph's curve is about speed changing over time — the real runner could be going in a perfectly straight line down the track the whole time, just speeding up or slowing down."
    },
    {
      "id": "seg_007",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Let's work through an actual graph step by step and read off the speeds using only steepness — no formulas needed beyond rise over run.",
      "gesture": "explaining"
    },
    {
      "id": "seg_008",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "First segment: from 0 to 4 seconds, the line goes straight from 0 meters up to 20 meters. That's a rise of 20 meters over a run of 4 seconds — a steady slope of 5 meters per second. Straight line, same steepness throughout, so constant speed.",
      "visual": {
        "prompt": "Distance-time graph, first segment only highlighted: straight line from (0,0) to (4s, 20m), with rise=20m and run=4s marked as a right triangle on the line, slope calculation 20/4=5 m/s shown.",
        "style": "diagram",
        "callouts": [
          "Rise = 20 m",
          "Run = 4 s",
          "Speed = 5 m/s"
        ],
        "persists_to_next": false,
        "imageUrl": "/demo/steepness-speed/seg_008.png"
      },
      "pause_after": 1
    },
    {
      "id": "seg_009",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Second segment: from 4 to 7 seconds, the line is perfectly flat at 20 meters. No rise at all over that run — slope of zero. The runner stopped for 3 seconds.",
      "visual": {
        "prompt": "Distance-time graph, second segment only highlighted: flat horizontal line from (4s,20m) to (7s,20m), labeled 'zero rise, zero speed, runner resting'.",
        "style": "diagram",
        "callouts": [
          "Flat = 0 m/s",
          "Runner stopped"
        ],
        "persists_to_next": false,
        "imageUrl": "/demo/steepness-speed/seg_009.png"
      }
    },
    {
      "id": "seg_010",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Third segment: from 7 to 9 seconds, the line shoots up steeply from 20 meters to 40 meters. Rise of 20 meters over just 2 seconds gives a slope of 10 meters per second — twice as fast as the first segment, and you can see that just by how much steeper this part looks.",
      "visual": {
        "prompt": "Distance-time graph, third segment only highlighted: steep straight line from (7s,20m) to (9s,40m), rise=20m over run=2s marked, slope=10 m/s shown, compared faintly to the earlier gentler segment for contrast.",
        "style": "comparison",
        "callouts": [
          "Rise = 20 m",
          "Run = 2 s",
          "Speed = 10 m/s — steeper than segment 1"
        ],
        "imageUrl": "/demo/steepness-speed/seg_010.png"
      }
    },
    {
      "id": "seg_011",
      "phase": "demonstrate",
      "role": "explore",
      "text": "Now it's your turn to play with this directly. Try the 'Steepness of segment 2' slider on the board and watch how the speed readout reacts as you tilt the line."
    },
    {
      "id": "seg_012",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Notice you never needed to look at how high the line was sitting — only how tilted each piece was. That tilt, not the height, is the whole story of speed."
    },
    {
      "id": "seg_013",
      "phase": "challenge",
      "role": "challenge_setup",
      "text": "Here's a thinker: two runners' distance-time graphs cross at the exact same point, meaning at that instant they're at the same distance from the start. One line is a shallow straight line; the other is a curve that's bending steeply upward right at that crossing point. Which runner is faster at that exact moment, and why does 'being at the same distance' not decide the answer?",
      "gesture": "thinking"
    },
    {
      "id": "seg_014",
      "phase": "challenge",
      "role": "challenge_reveal",
      "text": "The curved runner is faster at that instant — because speed comes from the steepness of the tangent line touching the curve right there, not from the height where the lines meet. Even though both runners are side-by-side in distance at that moment, the curved line's tangent is tilted more steeply, meaning that runner's speed right then is greater. Being equal in distance only tells you they're neck-and-neck in position — it says nothing about who's accelerating past whom.",
      "visual": {
        "prompt": "Two distance-time curves crossing at one point. One is a shallow straight line, the other a curve with a steep tangent line drawn touching it exactly at the crossing point. Both at same height, tangent slope visibly steeper than the straight line.",
        "style": "comparison",
        "callouts": [
          "Same distance here",
          "Straight line: gentle slope",
          "Curve's tangent: steep slope = faster now"
        ],
        "imageUrl": "/demo/steepness-speed/seg_014.png"
      }
    },
    {
      "id": "seg_015",
      "phase": "connect",
      "role": "transition",
      "text": "This same idea — steepness at an instant as the true rate of change — is the seed of calculus, where 'slope of the tangent line' becomes something called the derivative. Next time you see any graph, whether it's speed, growth, or temperature, ask yourself: is it the height or the steepness that answers my question? Usually, it's the steepness."
    }
  ],
  "metadata": {
    "estimated_read_time_minutes": 6,
    "bloom_level_taught": "Understand/Apply",
    "depth_level": "moderate",
    "interactive": {
      "goal": "See that the steepness of the line at a moment, not its height, is the speed right then, even on a curve.",
      "brief": "A distance-time graph: Time 0 to 12 s across, Distance 0 to 120 m up. The trip follows the lesson's worked example: 0 to 4 s straight from 0 m to 20 m (5 m/s); segment 2 from 4 to 7 s, straight, its steepness set by the slider from 0 to 10 m/s (it starts at 0: flat at 20 m, the runner stopped); segment 3 from 7 to 9 s, straight at 10 m/s (20 m up). Then, from 9 to 12 s, a CURVED part where the runner speeds up smoothly from 10 m/s to 20 m/s. A marker dot sits on the path at the chosen time; the readout says the time, the distance and the speed there. With Show tangent line on, the line just touching the path at the marker is drawn, and its slope is the speed in the readout: on the curve it tilts more as the marker moves right.",
      "controls": [
        {
          "label": "Steepness of segment 2",
          "kind": "slider",
          "effect": "Tilts segment 2 (4 to 7 s) from flat to steep; the rest of the trip shifts up or down with it and the speed readout follows."
        },
        {
          "label": "Time position",
          "kind": "slider",
          "effect": "Moves the marker along the trip from 0 to 12 s; the readout shows the distance and the speed at that moment."
        },
        {
          "label": "Show tangent line",
          "kind": "toggle",
          "effect": "Draws the line touching the path at the marker; its steepness is the speed right then."
        }
      ],
      "try_this": [
        "Leave segment 2 flat and put the marker on it: high up, but 0 m/s.",
        "Turn on the tangent line and slide the marker through the curved part.",
        "Compare the tangent's tilt at 9.5 s and at 11.5 s."
      ]
    },
    "should_generate_model": false,
    "demo_interactive": {
      "title": "Steepness is speed",
      "markup": "<div class=\"split\">\n  <div class=\"stage\"><canvas id=\"plot\" role=\"img\" aria-label=\"Distance-time graph of a trip in four parts, a dot marks the current time\"></canvas></div>\n  <div class=\"stack\">\n    <div class=\"readout\" id=\"readout\" aria-live=\"polite\">t = 0 s, d = 0 m, speed = 5 m/s</div>\n    <div class=\"controls\">\n      <div class=\"control\"><label for=\"steep\">Steepness of segment 2 <span><span class=\"value\" id=\"steepv\">0</span> m/s</span></label>\n        <input id=\"steep\" type=\"range\" min=\"0\" max=\"10\" step=\"0.5\" value=\"0\"></div>\n      <div class=\"control\"><label for=\"tpos\">Time position <span><span class=\"value\" id=\"tposv\">0</span> s</span></label>\n        <input id=\"tpos\" type=\"range\" min=\"0\" max=\"12\" step=\"0.1\" value=\"0\"></div>\n    </div>\n    <div class=\"row\">\n      <button type=\"button\" id=\"tangent\" aria-pressed=\"false\">Show tangent line</button>\n    </div>\n    <p class=\"hint\">Height tells distance. Tilt tells speed.</p>\n  </div>\n</div>\n",
      "css": "\n#readout{text-align:center}\n\n#readout{font-size:17px}",
      "js": "\nvar C = ARISTO.colors;\nvar steepIn = document.getElementById('steep');\nvar tposIn = document.getElementById('tpos');\nvar tangentBtn = document.getElementById('tangent');\nvar showTangent = false;\n\n// trip geometry:\n// seg1: t in [0,4], d from 0 to 20 (5 m/s)\n// seg2: t in [4,7], slope = steep (m/s), d from 20 to 20+3*steep\n// seg3: t in [7,9], straight at 10 m/s, as in the lesson's worked example\n// seg4: t in [9,12], curve: speed goes from 10 to 20 m/s linearly, so\n//   v(t) = 10 + (10/3)*(t-9)\n//   d(t) = d3 + 10*(t-9) + (5/3)*(t-9)^2, with d3 = d1seg2 + 20\n\nfunction d0seg2() { return 20; }\nfunction d1seg2(steep) { return 20 + 3 * steep; }\n\nfunction distAt(t, steep) {\n  if (t <= 4) {\n    return 5 * t;\n  } else if (t <= 7) {\n    return 20 + steep * (t - 4);\n  } else if (t <= 9) {\n    return d1seg2(steep) + 10 * (t - 7);\n  } else {\n    var dt = t - 9;\n    return d1seg2(steep) + 20 + 10 * dt + (5 / 3) * dt * dt;\n  }\n}\n\nfunction speedAt(t, steep) {\n  if (t <= 4) {\n    return 5;\n  } else if (t <= 7) {\n    return steep;\n  } else if (t <= 9) {\n    return 10;\n  } else {\n    return 10 + (10 / 3) * (t - 9);\n  }\n}\n\nfunction fmt(n) {\n  return (Math.round(n * 10) / 10).toString();\n}\n\nvar plot = ARISTO.canvas(document.getElementById('plot'), function (ctx, w, h) {\n  var steep = +steepIn.value;\n  var tpos = +tposIn.value;\n  var padL = 36, padB = 26, padT = 10, padR = 10;\n  var gw = w - padL - padR, gh = h - padT - padB;\n  var tmax = 12, dmax = 120;\n  function X(t) { return padL + (t / tmax) * gw; }\n  function Y(d) { return padT + gh - (d / dmax) * gh; }\n\n  // grid\n  ctx.lineWidth = 1; ctx.strokeStyle = C.line;\n  for (var ti = 0; ti <= tmax; ti += 1) {\n    ctx.beginPath(); ctx.moveTo(X(ti), padT); ctx.lineTo(X(ti), padT + gh); ctx.stroke();\n  }\n  for (var di = 0; di <= dmax; di += 10) {\n    ctx.beginPath(); ctx.moveTo(padL, Y(di)); ctx.lineTo(padL + gw, Y(di)); ctx.stroke();\n  }\n\n  // axes\n  ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5;\n  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + gh); ctx.lineTo(padL + gw, padT + gh); ctx.stroke();\n\n  // axis labels\n  ctx.fillStyle = C.body; ctx.font = '12px system-ui, sans-serif';\n  ctx.textAlign = 'center';\n  ctx.fillText('Time (s)', padL + gw / 2, padT + gh + 20);\n  ctx.save();\n  ctx.translate(12, padT + gh / 2);\n  ctx.rotate(-Math.PI / 2);\n  ctx.fillText('Distance (m)', 0, 0);\n  ctx.restore();\n  ctx.textAlign = 'right';\n  ctx.fillText('0', padL - 4, padT + gh + 4);\n  ctx.fillText('120', padL - 4, padT + 4);\n  ctx.textAlign = 'center';\n  ctx.fillText('12', padL + gw, padT + gh + 16);\n\n  // path\n  ctx.strokeStyle = C.accentText; ctx.lineWidth = 3; ctx.lineCap = 'round';\n  ctx.beginPath();\n  var steps = 200;\n  for (var i = 0; i <= steps; i++) {\n    var t = (i / steps) * tmax;\n    var d = distAt(t, steep);\n    var x = X(t), y = Y(d);\n    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);\n  }\n  ctx.stroke();\n\n  // tangent line\n  if (showTangent) {\n    ctx.save();\n    ctx.beginPath(); ctx.rect(X(0), Y(dmax), X(tmax) - X(0), Y(0) - Y(dmax)); ctx.clip();\n    var speed = speedAt(tpos, steep);\n    var dAtT = distAt(tpos, steep);\n    ctx.setLineDash([6, 5]);\n    ctx.strokeStyle = C.info; ctx.lineWidth = 2;\n    ctx.beginPath();\n    var t1 = 0, t2 = tmax;\n    var d1 = dAtT + speed * (t1 - tpos);\n    var d2 = dAtT + speed * (t2 - tpos);\n    ctx.moveTo(X(t1), Y(d1));\n    ctx.lineTo(X(t2), Y(d2));\n    ctx.stroke();\n    ctx.setLineDash([]);\n    ctx.restore();\n  }\n\n  // marker dot\n  var dm = distAt(tpos, steep);\n  ctx.fillStyle = C.accentText;\n  ctx.beginPath(); ctx.arc(X(tpos), Y(dm), 6, 0, Math.PI * 2); ctx.fill();\n  ctx.strokeStyle = C.surface; ctx.lineWidth = 2; ctx.stroke();\n}, 0.7);\n\nfunction update() {\n  var steep = +steepIn.value;\n  var tpos = +tposIn.value;\n  document.getElementById('steepv').textContent = fmt(steep);\n  document.getElementById('tposv').textContent = fmt(tpos);\n  var d = distAt(tpos, steep);\n  var v = speedAt(tpos, steep);\n  document.getElementById('readout').textContent =\n    't = ' + fmt(tpos) + ' s, d = ' + fmt(d) + ' m, speed = ' + fmt(v) + ' m/s';\n  plot.redraw();\n}\n\nsteepIn.addEventListener('input', update);\ntposIn.addEventListener('input', update);\ntangentBtn.addEventListener('click', function () {\n  showTangent = !showTangent;\n  tangentBtn.setAttribute('aria-pressed', String(showTangent));\n  update();\n});\n\nupdate();\n"
    }
  }
};

export const quiz: QuizQuestion[] = [
  {
    "question_type": "true_false",
    "bloom_level": "remember",
    "question": "On a distance-time graph, a flat (horizontal) section of the line means the object is moving at a constant speed.",
    "options": [
      "True",
      "False"
    ],
    "correct_answer": "False",
    "explanation_correct": "A flat section has zero steepness, meaning distance isn't changing over time - the object is stopped, not moving at constant speed.",
    "explanation_wrong": {
      "True": "A flat line has zero slope, which means zero speed (stopped), not a constant non-zero speed. A straight diagonal line represents constant speed."
    },
    "difficulty": 0.25,
    "estimated_seconds": 30,
    "misconception_targeted": "Confusing 'flat' with 'steady/constant speed' rather than recognizing flat means stopped.",
    "id": "steepness-speed-q1",
    "concept_id": "steepness-speed"
  },
  {
    "question_type": "multiple_choice",
    "bloom_level": "apply",
    "question": "A distance-time graph shows a curve that gets steeper and steeper as time goes on. What does this indicate about the object's motion?",
    "options": [
      "The object is speeding up",
      "The object is slowing down",
      "The object is moving at a constant speed",
      "The object is stopped"
    ],
    "correct_answer": "The object is speeding up",
    "explanation_correct": "An increasingly steep curve means the slope (speed) is getting larger over time, so the object is accelerating/speeding up.",
    "explanation_wrong": {
      "The object is slowing down": "Slowing down would show a curve that becomes less steep over time, not more steep.",
      "The object is moving at a constant speed": "Constant speed would be shown by a straight line, not a curve with changing steepness.",
      "The object is stopped": "A stopped object would show a flat (horizontal) line with zero steepness, not an increasingly steep curve."
    },
    "difficulty": 0.45,
    "estimated_seconds": 40,
    "misconception_targeted": "Difficulty connecting changing curvature to changing speed rather than just presence of curve.",
    "id": "steepness-speed-q2",
    "concept_id": "steepness-speed"
  }
];
