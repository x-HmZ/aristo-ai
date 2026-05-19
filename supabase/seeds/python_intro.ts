/**
 * Python Introductory Course — Knowledge Graph Seed
 *
 * Run from the project root:
 *   npx ts-node --project tsconfig.json supabase/seeds/python_intro.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Concept definitions ──────────────────────────────────────

const DOMAIN = "python_programming";

interface ConceptInput {
  id: string;
  domain: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  bloom_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  estimated_minutes: number;
  key_terms: string[];
  learning_objectives: string[];
  common_misconceptions: string[];
  tags: string[];
  prerequisites: string[];
}

const concepts: ConceptInput[] = [
  // ── Foundation (no prerequisites) ─────────────────────────
  {
    id: "python_what_is_programming",
    domain: DOMAIN,
    name: "What is Programming?",
    description: "Understanding what a program is, what a computer does, and why we write code.",
    difficulty: 1,
    bloom_level: "understand",
    estimated_minutes: 10,
    key_terms: ["program", "algorithm", "instruction", "computer"],
    learning_objectives: [
      "Explain what a program is in plain English",
      "Describe the relationship between code and computer execution",
    ],
    common_misconceptions: [
      "Programming is only for math people",
      "The computer understands English instructions",
    ],
    tags: ["fundamentals", "intro"],
    prerequisites: [],
  },
  {
    id: "python_installation",
    domain: DOMAIN,
    name: "Installing Python & Running Your First Script",
    description: "How to install Python, open a terminal, and run a .py file.",
    difficulty: 1,
    bloom_level: "apply",
    estimated_minutes: 15,
    key_terms: ["interpreter", "terminal", "REPL", ".py file"],
    learning_objectives: [
      "Run a Python script from the command line",
      "Use the Python REPL for quick experiments",
    ],
    common_misconceptions: [
      "You need an IDE to run Python",
      "Python 2 and Python 3 are interchangeable",
    ],
    tags: ["setup", "fundamentals"],
    prerequisites: ["python_what_is_programming"],
  },

  // ── Basics ─────────────────────────────────────────────────
  {
    id: "python_print",
    domain: DOMAIN,
    name: "Printing Output",
    description: "Using print() to display text and values in the terminal.",
    difficulty: 1,
    bloom_level: "apply",
    estimated_minutes: 10,
    key_terms: ["print()", "string", "output"],
    learning_objectives: [
      "Print text using print()",
      "Print multiple values with separators",
    ],
    common_misconceptions: [
      "print is a statement, not a function (Python 2 holdover)",
      "Forgetting parentheses",
    ],
    tags: ["fundamentals", "output"],
    prerequisites: ["python_installation"],
  },
  {
    id: "python_comments",
    domain: DOMAIN,
    name: "Comments",
    description: "Writing single-line and multi-line comments to document code.",
    difficulty: 1,
    bloom_level: "remember",
    estimated_minutes: 5,
    key_terms: ["#", "docstring", "inline comment"],
    learning_objectives: ["Write single-line comments with #", "Explain why comments matter"],
    common_misconceptions: [
      "Comments slow down the program",
      "Triple-quoted strings are always docstrings",
    ],
    tags: ["fundamentals", "style"],
    prerequisites: ["python_print"],
  },
  {
    id: "python_variables",
    domain: DOMAIN,
    name: "Variables and Assignment",
    description: "Creating variables, assigning values, and the rules for naming them.",
    difficulty: 1,
    bloom_level: "apply",
    estimated_minutes: 15,
    key_terms: ["variable", "assignment", "=", "identifier", "naming conventions"],
    learning_objectives: [
      "Create and assign variables",
      "Follow PEP8 naming conventions (snake_case)",
      "Reassign a variable to a new value",
    ],
    common_misconceptions: [
      "= means 'equals' like in math (it means assignment)",
      "Variable names can start with a number",
    ],
    tags: ["fundamentals", "variables"],
    prerequisites: ["python_print"],
  },

  // ── Data Types ─────────────────────────────────────────────
  {
    id: "python_types_int_float",
    domain: DOMAIN,
    name: "Integers and Floats",
    description: "Numeric types in Python: whole numbers (int) and decimal numbers (float).",
    difficulty: 1,
    bloom_level: "understand",
    estimated_minutes: 15,
    key_terms: ["int", "float", "integer division //", "modulo %", "type()"],
    learning_objectives: [
      "Distinguish int from float",
      "Use arithmetic operators: +, -, *, /, //, %, **",
      "Use type() to check a value's type",
    ],
    common_misconceptions: [
      "3/2 equals 1 (true in Python 2, not 3)",
      "Floating-point numbers are always exact",
    ],
    tags: ["data-types", "numbers"],
    prerequisites: ["python_variables"],
  },
  {
    id: "python_types_string",
    domain: DOMAIN,
    name: "Strings",
    description: "Working with text in Python: creation, slicing, and common methods.",
    difficulty: 1,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["str", "quotes", "index", "slice", "len()", "f-string"],
    learning_objectives: [
      "Create strings with single and double quotes",
      "Access characters by index",
      "Slice a string",
      "Use common methods: upper(), lower(), strip(), split()",
      "Format strings with f-strings",
    ],
    common_misconceptions: [
      "Strings are mutable (they're immutable)",
      "Confusing string index 0 with 1-based counting",
    ],
    tags: ["data-types", "strings"],
    prerequisites: ["python_variables"],
  },
  {
    id: "python_types_bool",
    domain: DOMAIN,
    name: "Booleans and Comparisons",
    description: "True/False values and comparison operators that produce them.",
    difficulty: 1,
    bloom_level: "understand",
    estimated_minutes: 15,
    key_terms: ["bool", "True", "False", "==", "!=", "<", ">", "<=", ">="],
    learning_objectives: [
      "Explain the difference between = and ==",
      "Evaluate comparison expressions",
      "Understand truthiness of non-boolean values",
    ],
    common_misconceptions: [
      "Using = instead of == in conditions",
      "0 is not False (it is truthy/falsy but not identical)",
    ],
    tags: ["data-types", "boolean"],
    prerequisites: ["python_types_int_float"],
  },
  {
    id: "python_types_none",
    domain: DOMAIN,
    name: "None",
    description: "Python's null value and when it appears.",
    difficulty: 1,
    bloom_level: "understand",
    estimated_minutes: 8,
    key_terms: ["None", "NoneType", "is None"],
    learning_objectives: [
      "Explain what None represents",
      "Check for None using 'is None' vs '== None'",
    ],
    common_misconceptions: [
      "None is the same as 0, False, or empty string",
      "Using == instead of 'is' to check for None",
    ],
    tags: ["data-types"],
    prerequisites: ["python_types_bool"],
  },

  // ── Control Flow ──────────────────────────────────────────
  {
    id: "python_if_else",
    domain: DOMAIN,
    name: "if / elif / else",
    description: "Making decisions in code with conditional statements.",
    difficulty: 2,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["if", "elif", "else", "condition", "indentation", "block"],
    learning_objectives: [
      "Write an if-else statement",
      "Chain multiple conditions with elif",
      "Understand Python's indentation-based block syntax",
    ],
    common_misconceptions: [
      "Forgetting the colon after the condition",
      "Mismatched indentation causing logic errors",
    ],
    tags: ["control-flow", "conditionals"],
    prerequisites: ["python_types_bool"],
  },
  {
    id: "python_logical_operators",
    domain: DOMAIN,
    name: "Logical Operators (and, or, not)",
    description: "Combining boolean conditions with and, or, and not.",
    difficulty: 2,
    bloom_level: "apply",
    estimated_minutes: 15,
    key_terms: ["and", "or", "not", "short-circuit evaluation"],
    learning_objectives: [
      "Combine conditions with and and or",
      "Negate conditions with not",
      "Explain short-circuit evaluation",
    ],
    common_misconceptions: [
      "Writing 'if x == 1 or 2' instead of 'if x == 1 or x == 2'",
      "Confusing 'and' and 'or' truth tables",
    ],
    tags: ["control-flow", "boolean"],
    prerequisites: ["python_if_else"],
  },
  {
    id: "python_while_loop",
    domain: DOMAIN,
    name: "while Loops",
    description: "Repeating code while a condition is true, and how to avoid infinite loops.",
    difficulty: 2,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["while", "loop", "break", "continue", "infinite loop"],
    learning_objectives: [
      "Write a while loop with a proper termination condition",
      "Use break to exit a loop early",
      "Use continue to skip an iteration",
    ],
    common_misconceptions: [
      "Forgetting to update the loop variable (infinite loop)",
      "Confusing when to use while vs for",
    ],
    tags: ["control-flow", "loops"],
    prerequisites: ["python_if_else"],
  },

  // ── Data Structures ───────────────────────────────────────
  {
    id: "python_list_basics",
    domain: DOMAIN,
    name: "Lists",
    description: "Ordered, mutable sequences: creating, indexing, slicing, and modifying lists.",
    difficulty: 2,
    bloom_level: "apply",
    estimated_minutes: 25,
    key_terms: ["list", "[]", "index", "append()", "len()", "slice"],
    learning_objectives: [
      "Create a list and access elements by index",
      "Add and remove items with append(), remove(), pop()",
      "Slice a list",
      "Check membership with 'in'",
    ],
    common_misconceptions: [
      "Lists are passed by reference, not value",
      "Confusing list = list2 (reference copy) with list.copy()",
    ],
    tags: ["data-structures", "lists"],
    prerequisites: ["python_types_int_float", "python_types_string"],
  },
  {
    id: "python_for_loop",
    domain: DOMAIN,
    name: "for Loops",
    description: "Iterating over sequences (lists, strings, ranges) with for loops.",
    difficulty: 2,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["for", "in", "range()", "enumerate()", "iteration"],
    learning_objectives: [
      "Iterate over a list with for x in list:",
      "Use range() to loop a specific number of times",
      "Use enumerate() to access both index and value",
    ],
    common_misconceptions: [
      "Modifying a list while iterating over it",
      "Off-by-one errors with range(n) vs range(1, n+1)",
    ],
    tags: ["control-flow", "loops"],
    prerequisites: ["python_list_basics"],
  },
  {
    id: "python_list_comprehension",
    domain: DOMAIN,
    name: "List Comprehensions",
    description: "Building lists concisely with a single expression.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["list comprehension", "[x for x in ...]", "filter in comprehension"],
    learning_objectives: [
      "Rewrite a for-loop that builds a list as a comprehension",
      "Add a condition (filter) to a comprehension",
    ],
    common_misconceptions: [
      "List comprehensions are always faster than for loops",
      "Nesting comprehensions beyond readability",
    ],
    tags: ["lists", "pythonic"],
    prerequisites: ["python_for_loop"],
  },
  {
    id: "python_tuple",
    domain: DOMAIN,
    name: "Tuples",
    description: "Immutable ordered sequences and when to prefer them over lists.",
    difficulty: 2,
    bloom_level: "understand",
    estimated_minutes: 15,
    key_terms: ["tuple", "()", "immutable", "packing", "unpacking"],
    learning_objectives: [
      "Create a tuple and access its elements",
      "Explain why tuples are immutable",
      "Unpack a tuple into variables",
    ],
    common_misconceptions: [
      "Tuples with one element need a trailing comma: (1,) not (1)",
      "Immutable means the values inside can't be objects that change",
    ],
    tags: ["data-structures", "tuples"],
    prerequisites: ["python_list_basics"],
  },
  {
    id: "python_dict",
    domain: DOMAIN,
    name: "Dictionaries",
    description: "Key-value mappings: creation, access, mutation, and iteration.",
    difficulty: 2,
    bloom_level: "apply",
    estimated_minutes: 25,
    key_terms: ["dict", "{}", "key", "value", ".get()", ".keys()", ".values()", ".items()"],
    learning_objectives: [
      "Create a dictionary and access values by key",
      "Add, update, and delete key-value pairs",
      "Iterate over keys, values, and items",
      "Use .get() to avoid KeyError",
    ],
    common_misconceptions: [
      "Dictionary keys must be strings",
      "Iterating a dict gives values (it gives keys by default)",
    ],
    tags: ["data-structures", "dictionaries"],
    prerequisites: ["python_list_basics"],
  },
  {
    id: "python_set",
    domain: DOMAIN,
    name: "Sets",
    description: "Unordered collections of unique elements and set operations.",
    difficulty: 2,
    bloom_level: "understand",
    estimated_minutes: 15,
    key_terms: ["set", "union", "intersection", "difference", "add()", "discard()"],
    learning_objectives: [
      "Create a set and check membership",
      "Perform union, intersection, and difference",
      "Explain when to use a set instead of a list",
    ],
    common_misconceptions: [
      "{} creates a dict, not a set — use set() for an empty set",
      "Sets guarantee insertion order (they don't until Python 3.7+ for dicts, but sets never do)",
    ],
    tags: ["data-structures", "sets"],
    prerequisites: ["python_list_basics"],
  },

  // ── Functions ─────────────────────────────────────────────
  {
    id: "python_functions_basics",
    domain: DOMAIN,
    name: "Defining and Calling Functions",
    description: "Writing reusable blocks of code with def, parameters, and return values.",
    difficulty: 2,
    bloom_level: "apply",
    estimated_minutes: 25,
    key_terms: ["def", "parameter", "argument", "return", "function call"],
    learning_objectives: [
      "Define a function with parameters",
      "Call a function and use its return value",
      "Understand the difference between parameters and arguments",
    ],
    common_misconceptions: [
      "A function without 'return' returns None implicitly",
      "Confusing the definition with the call",
    ],
    tags: ["functions", "fundamentals"],
    prerequisites: ["python_for_loop"],
  },
  {
    id: "python_default_args",
    domain: DOMAIN,
    name: "Default and Keyword Arguments",
    description: "Making function parameters optional with defaults and using keyword arguments.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 15,
    key_terms: ["default parameter", "keyword argument", "positional argument"],
    learning_objectives: [
      "Define a function with default parameter values",
      "Call a function using keyword arguments",
      "Explain why mutable defaults (like lists) are dangerous",
    ],
    common_misconceptions: [
      "Using a mutable default argument like def f(x, lst=[])",
      "Positional arguments must always come before keyword arguments",
    ],
    tags: ["functions"],
    prerequisites: ["python_functions_basics"],
  },
  {
    id: "python_scope",
    domain: DOMAIN,
    name: "Variable Scope (Local vs Global)",
    description: "Understanding where variables live and LEGB scope resolution.",
    difficulty: 3,
    bloom_level: "analyze",
    estimated_minutes: 20,
    key_terms: ["scope", "local", "global", "LEGB", "global keyword", "NameError"],
    learning_objectives: [
      "Explain why a variable inside a function isn't accessible outside",
      "Use the global keyword when necessary",
      "Trace LEGB scope resolution",
    ],
    common_misconceptions: [
      "Assigning to a global variable inside a function without 'global' modifies it",
      "All variables are global by default",
    ],
    tags: ["functions", "scope"],
    prerequisites: ["python_functions_basics"],
  },
  {
    id: "python_lambda",
    domain: DOMAIN,
    name: "Lambda Functions",
    description: "Anonymous single-expression functions and when to use them.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 15,
    key_terms: ["lambda", "anonymous function", "one-liner"],
    learning_objectives: [
      "Write a lambda function",
      "Use lambda with sorted(), map(), filter()",
      "Know when NOT to use lambda (readability)",
    ],
    common_misconceptions: [
      "Lambda can contain multiple statements",
      "Lambdas are faster than regular functions",
    ],
    tags: ["functions", "pythonic"],
    prerequisites: ["python_default_args"],
  },

  // ── Error Handling ────────────────────────────────────────
  {
    id: "python_errors_exceptions",
    domain: DOMAIN,
    name: "Errors and Exceptions",
    description: "Understanding Python's exception hierarchy and common error types.",
    difficulty: 2,
    bloom_level: "understand",
    estimated_minutes: 15,
    key_terms: ["exception", "SyntaxError", "TypeError", "ValueError", "NameError", "IndexError", "KeyError"],
    learning_objectives: [
      "Identify and explain 5 common exception types",
      "Read a traceback to find the source of an error",
    ],
    common_misconceptions: [
      "All errors are the same type",
      "An error on line N means the bug is on line N",
    ],
    tags: ["error-handling"],
    prerequisites: ["python_functions_basics"],
  },
  {
    id: "python_try_except",
    domain: DOMAIN,
    name: "try / except / finally",
    description: "Catching and handling exceptions gracefully.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["try", "except", "finally", "else", "raise", "exception handling"],
    learning_objectives: [
      "Wrap risky code in try/except",
      "Catch specific exception types",
      "Use finally for cleanup code",
      "Raise exceptions with raise",
    ],
    common_misconceptions: [
      "Catching Exception (bare except) silently hides all bugs",
      "finally only runs if there's an exception",
    ],
    tags: ["error-handling"],
    prerequisites: ["python_errors_exceptions"],
  },

  // ── File I/O ──────────────────────────────────────────────
  {
    id: "python_file_io",
    domain: DOMAIN,
    name: "Reading and Writing Files",
    description: "Opening, reading, writing, and closing files safely.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["open()", "read()", "write()", "with", "context manager", "file modes"],
    learning_objectives: [
      "Open and read a text file with 'with open()'",
      "Write to a file in write and append modes",
      "Explain why 'with' is preferred over open/close",
    ],
    common_misconceptions: [
      "open() reads the file immediately — you still need .read()",
      "Forgetting to close files without 'with'",
    ],
    tags: ["file-io"],
    prerequisites: ["python_try_except"],
  },

  // ── OOP ───────────────────────────────────────────────────
  {
    id: "python_classes_basics",
    domain: DOMAIN,
    name: "Classes and Objects",
    description: "Defining classes, creating instances, and writing __init__.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 30,
    key_terms: ["class", "object", "instance", "__init__", "self", "attribute", "method"],
    learning_objectives: [
      "Define a class with __init__ and instance attributes",
      "Create instances and call their methods",
      "Distinguish class attributes from instance attributes",
    ],
    common_misconceptions: [
      "Forgetting 'self' as the first parameter of every method",
      "Class body code runs when an instance is created, not when the class is defined",
    ],
    tags: ["oop"],
    prerequisites: ["python_functions_basics", "python_scope"],
  },
  {
    id: "python_inheritance",
    domain: DOMAIN,
    name: "Inheritance",
    description: "Extending classes with inheritance and overriding methods.",
    difficulty: 4,
    bloom_level: "apply",
    estimated_minutes: 25,
    key_terms: ["inheritance", "parent class", "child class", "super()", "override", "isinstance()"],
    learning_objectives: [
      "Create a subclass that inherits from a parent",
      "Override a method in the subclass",
      "Call the parent's method with super()",
      "Use isinstance() to check the class of an object",
    ],
    common_misconceptions: [
      "Inheritance is the only form of code reuse (composition is often better)",
      "super() always calls the direct parent (it follows MRO)",
    ],
    tags: ["oop"],
    prerequisites: ["python_classes_basics"],
  },
  {
    id: "python_dunder_methods",
    domain: DOMAIN,
    name: "Dunder (Magic) Methods",
    description: "Customizing class behavior with __str__, __len__, __eq__, and others.",
    difficulty: 4,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["dunder", "__str__", "__repr__", "__len__", "__eq__", "__add__"],
    learning_objectives: [
      "Implement __str__ for readable string representation",
      "Implement __eq__ for value equality",
      "Explain what happens when Python calls len() on your object",
    ],
    common_misconceptions: [
      "Dunder methods are called directly (they're invoked by Python operators and built-ins)",
      "Confusing __str__ and __repr__",
    ],
    tags: ["oop", "advanced"],
    prerequisites: ["python_classes_basics"],
  },

  // ── Modules & Packages ────────────────────────────────────
  {
    id: "python_modules_import",
    domain: DOMAIN,
    name: "Modules and import",
    description: "Importing standard library and third-party modules.",
    difficulty: 2,
    bloom_level: "apply",
    estimated_minutes: 15,
    key_terms: ["import", "from ... import", "as", "module", "standard library"],
    learning_objectives: [
      "Import a module and use its functions",
      "Use 'from x import y' to import specific names",
      "Use aliases with 'as'",
    ],
    common_misconceptions: [
      "import * is a good practice",
      "You can only import your own files",
    ],
    tags: ["modules"],
    prerequisites: ["python_functions_basics"],
  },
  {
    id: "python_common_stdlib",
    domain: DOMAIN,
    name: "Useful Standard Library Modules",
    description: "Tour of commonly used modules: math, random, datetime, os, sys.",
    difficulty: 2,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["math", "random", "datetime", "os", "sys", "json"],
    learning_objectives: [
      "Use math.sqrt(), math.floor()",
      "Generate random numbers with random.randint()",
      "Read today's date with datetime.date.today()",
      "Use json.loads() and json.dumps()",
    ],
    common_misconceptions: [
      "You need to install the standard library",
      "datetime.datetime and datetime.date are the same",
    ],
    tags: ["modules", "stdlib"],
    prerequisites: ["python_modules_import"],
  },

  // ── Iterators & Generators ────────────────────────────────
  {
    id: "python_iterators",
    domain: DOMAIN,
    name: "Iterators and Iterables",
    description: "Understanding what makes something iterable and how Python's for loop works internally.",
    difficulty: 4,
    bloom_level: "understand",
    estimated_minutes: 20,
    key_terms: ["iterable", "iterator", "__iter__", "__next__", "StopIteration"],
    learning_objectives: [
      "Explain the difference between an iterable and an iterator",
      "Use iter() and next() manually",
      "Explain how 'for x in y' maps to __iter__ and __next__",
    ],
    common_misconceptions: [
      "Lists and iterators are the same thing",
      "An iterator can be reused after it's exhausted",
    ],
    tags: ["advanced", "iterators"],
    prerequisites: ["python_for_loop", "python_dunder_methods"],
  },
  {
    id: "python_generators",
    domain: DOMAIN,
    name: "Generators and yield",
    description: "Writing memory-efficient iterators with generator functions.",
    difficulty: 4,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["generator", "yield", "generator expression", "lazy evaluation"],
    learning_objectives: [
      "Write a generator function using yield",
      "Use a generator expression with (x for x in ...)",
      "Explain why generators are memory-efficient",
    ],
    common_misconceptions: [
      "A generator function returns a list",
      "You can restart a generator after it's exhausted",
    ],
    tags: ["advanced", "generators"],
    prerequisites: ["python_iterators"],
  },

  // ── Decorators ────────────────────────────────────────────
  {
    id: "python_higher_order_functions",
    domain: DOMAIN,
    name: "Higher-Order Functions",
    description: "Functions that accept or return other functions: map, filter, sorted.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["higher-order function", "map()", "filter()", "sorted() with key=", "first-class function"],
    learning_objectives: [
      "Pass a function as an argument",
      "Use map() and filter() with lambda",
      "Sort a list of dicts by a key using sorted(key=)",
    ],
    common_misconceptions: [
      "map() and filter() return lists (they return iterators in Python 3)",
      "You must use lambda — you can pass any callable",
    ],
    tags: ["functions", "advanced"],
    prerequisites: ["python_lambda"],
  },
  {
    id: "python_decorators",
    domain: DOMAIN,
    name: "Decorators",
    description: "Using @decorator syntax to wrap and extend functions without modifying them.",
    difficulty: 4,
    bloom_level: "apply",
    estimated_minutes: 25,
    key_terms: ["decorator", "@", "wrapper function", "functools.wraps", "closure"],
    learning_objectives: [
      "Write a decorator that logs function calls",
      "Apply a decorator using @ syntax",
      "Preserve the original function's metadata with functools.wraps",
    ],
    common_misconceptions: [
      "Decorators modify the original function in place",
      "You need functools.wraps for the decorator to work at all",
    ],
    tags: ["functions", "advanced"],
    prerequisites: ["python_higher_order_functions", "python_scope"],
  },

  // ── Advanced Data ─────────────────────────────────────────
  {
    id: "python_comprehensions_dict_set",
    domain: DOMAIN,
    name: "Dict and Set Comprehensions",
    description: "Building dicts and sets with concise comprehension syntax.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 15,
    key_terms: ["dict comprehension", "set comprehension", "{k:v for ...}", "{x for ...}"],
    learning_objectives: [
      "Build a dict from a list using a dict comprehension",
      "Build a set with a set comprehension",
      "Add conditions to both",
    ],
    common_misconceptions: [
      "Dict comprehensions are just list comprehensions with different brackets",
      "Order is guaranteed in a set comprehension result",
    ],
    tags: ["data-structures", "pythonic"],
    prerequisites: ["python_list_comprehension", "python_dict"],
  },
  {
    id: "python_unpacking",
    domain: DOMAIN,
    name: "Unpacking and *args / **kwargs",
    description: "Destructuring sequences and passing variable numbers of arguments.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 20,
    key_terms: ["unpacking", "*args", "**kwargs", "starred expression", "destructuring"],
    learning_objectives: [
      "Unpack a list or tuple into variables",
      "Define a function accepting *args",
      "Define a function accepting **kwargs",
      "Use * to spread a list into function arguments",
    ],
    common_misconceptions: [
      "*args collects arguments into a list (it's a tuple)",
      "You must name them 'args' and 'kwargs'",
    ],
    tags: ["functions", "advanced"],
    prerequisites: ["python_tuple", "python_default_args"],
  },

  // ── Testing ───────────────────────────────────────────────
  {
    id: "python_testing_basics",
    domain: DOMAIN,
    name: "Writing Tests with pytest",
    description: "Test-driven thinking and writing basic unit tests.",
    difficulty: 3,
    bloom_level: "apply",
    estimated_minutes: 25,
    key_terms: ["pytest", "assert", "test function", "fixture", "test coverage"],
    learning_objectives: [
      "Write a simple test function that uses assert",
      "Run pytest from the command line",
      "Explain what a passing vs failing test means",
    ],
    common_misconceptions: [
      "Tests are only for big projects",
      "A test that runs is a test that passes",
    ],
    tags: ["testing"],
    prerequisites: ["python_functions_basics", "python_errors_exceptions"],
  },
];

// ── Seed function ────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${concepts.length} concepts for domain "${DOMAIN}"...`);

  // Separate concept rows from prerequisite edges
  const conceptRows = concepts.map(({ prerequisites: _prereqs, ...rest }) => rest);

  // Upsert concepts
  const { error: conceptError } = await supabase
    .from("concepts")
    .upsert(conceptRows, { onConflict: "id" });

  if (conceptError) {
    console.error("Failed to insert concepts:", conceptError.message);
    process.exit(1);
  }

  console.log(`✓ Inserted ${conceptRows.length} concept rows.`);

  // Build and upsert prerequisite edges
  const edges: Array<{ concept_id: string; prerequisite_id: string }> = [];
  for (const concept of concepts) {
    for (const prereqId of concept.prerequisites) {
      edges.push({ concept_id: concept.id, prerequisite_id: prereqId });
    }
  }

  if (edges.length > 0) {
    // Clean existing edges for this domain's concepts first
    const conceptIds = concepts.map((c) => c.id);
    await supabase.from("concept_prerequisites").delete().in("concept_id", conceptIds);

    const { error: edgeError } = await supabase
      .from("concept_prerequisites")
      .insert(edges);

    if (edgeError) {
      console.error("Failed to insert prerequisite edges:", edgeError.message);
      process.exit(1);
    }
  }

  console.log(`✓ Inserted ${edges.length} prerequisite edges.`);
  console.log("Seed complete.");
}

seed();
