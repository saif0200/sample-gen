# AI Exam Generator

A powerful, AI-driven platform capable of transforming past exam PDFs into fresh, rigorous practice papers. Built with Next.js 16, React 19, and Google's cutting-edge Gemini experimental models, this tool mimics the "Elite Professor" workflow: analyzing source material, understanding underlying logic, and synthesizing entirely new problems that test the same concepts.

![Project Banner](https://img.shields.io/badge/Status-Active_Development-success?style=for-the-badge) ![Tech](https://img.shields.io/badge/Built_With-Next.js_16_&_Gemini_AI-blue?style=for-the-badge&logo=next.js)

## 🎯 Project Overview

This is not a simple question shuffler. The AI Exam Generator solves the problem of "running out of practice material." By uploading one or multiple past exams (PDFs), the system:
1.  **Extracts & Analyzes**: Understands the structure, difficulty, and specific problem types from source documents.
2.  **Synthesizes**: Generates *new* questions with identical logic but different values, functions, or contexts.
3.  **Compiles**: Produces a fully formatted LaTeX document and a ready-to-print PDF.

It is designed for high-fidelity academic usage, ensuring that the output looks and feels exactly like a real exam.

## ✨ Key Features

-   **Multi-PDF Context**: Upload multiple years of past exams to create a comprehensive "Final Exam" that blends topics from all sources.
-   **Intelligent Regeneration**: The "Regenerate" feature is context-aware. It knows what it generated previously and forces the AI to create *novel* variants, preventing repetition.
-   **Native LaTeX Generation**: The AI outputs raw LaTeX code, preserving complex mathematical notation, diagrams, and formatting styles.
-   **Server-Side Compilation**: Automatically attempts to compile LaTeX to PDF on the fly using a local TeX installation (`pdflatex`).
-   **Modern, Fluid UI**: Built with **Framer Motion** for complex state transitions (Idle → Uploading → Processing → Success) and a premium, glassmorphism-inspired aesthetic.
-   **Experimental AI Models**: Leverages `gemini-3-flash-preview` with "Thinking" capabilities for deeper logical reasoning during question formulation.

## 🛠 Tech Stack

-   **Framework**: Next.js 16 (App Router)
-   **Language**: TypeScript
-   **AI Engine**: Google Gemini (via `@google/genai` SDK)
-   **Styling**: TailwindCSS v4, `clsx`, `tailwind-merge`
-   **Animation**: Framer Motion
-   **Icons**: Lucide React
-   **Build Tools**: `eslint`, `postcss`

## 🚀 Getting Started

### Prerequisites

1.  **Node.js**: v18+ recommended.
2.  **TeX Distribution**: The server needs `pdflatex` to compile PDFs.
    -   **macOS**: Install [MacTeX](https://www.tug.org/mactex/) (`brew install --cask mactex`).
    -   **Linux**: `sudo apt-get install texlive-full`.
    -   **Windows**: Install [MiKTeX](https://miktex.org/) or TeX Live.
3.  **Google AI API Key**: Get a key from [Google AI Studio](https://aistudio.google.com/).

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/sample-gen.git
    cd sample-gen
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Create a `.env` file in the root directory:
    ```bash
    GOOGLE_GENAI_API_KEY=your_api_key_here
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🏗 Architecture & Design

### API Pipeline (`/api/process-pdf`)
The backend logic is streamlined for high-throughput AI processing:
1.  **Input Handling**: Receives robust `FormData` containing distinct PDF binaries.
2.  **Prompt Engineering**: Uses a "Persona-based" prompt (`ROLE: Elite Professor`) to enforce strict constraints:
    -   *No duplicates*: Questions must be functionally novel.
    -   *Complexity enforcement*: difficulty must match or exceed the source.
    -   *Format mimicry*: Output detailed LaTeX packages and layout.
3.  **Thinking Config**: effectively uses the `thinkingConfig` feature of Gemini to allow the model a "scratchpad" for deriving mathematical solutions before generating the final question, ensuring correctness.
4.  **Resilience**: Implements regex-based fallback strategies to extract LaTeX code even if the model "chatters" or wraps code in markdown blocks.

### Frontend Experience
The UI in `page.tsx` is designed to feel "alive":
-   **State Machines**: A clear state flow (`idle`, `uploading`, `processing`, `success`, `error`) guides the user.
-   **Visual Feedback**: A cyclical loading text system ("Analyzing structure...", "Generating problems...") keeps users engaged during the 10-30s generation window.
-   **Blob Background**: An animated, multi-color blob background provides a modern, dynamic feel without distracting from the content.

## ⚠️ Challenges & Trade-offs

-   **PDF Compilation Latency**: Compiling LaTeX to PDF is a CPU-intensive task. We handle this via `child_process.exec`, but in a serverless environment (like Vercel), this approach would require a dedicated microservice or a containerized environment (Docker) with TeX pre-installed.
-   **Token Limits**: High-resolution PDFs consume significant context window tokens. We mitigate this by using Gemini's highly efficient Flash models, but extremely large inputs (textbooks) may still be truncated.
-   **Hallucinations**: While rare with "Thinking" models, the AI can occasionally generate invalid LaTeX syntax. The system includes basic error compilation handling, but complex diagram generation remains an "at your own risk" feature.

## 🔮 Future Roadmap

-   **User Accounts**: Save generated exams to a personal library.
-   **Answer Keys**: Toggle generation of a separate solution key PDF.
-   **Fine-tuned Models**: Move from prompt engineering to a fine-tuned model specifically for LaTeX academic formatting.
-   **Cloud Composition**: Replace local `pdflatex` with a cloud compilation API to enable fully serverless deployment.

---
