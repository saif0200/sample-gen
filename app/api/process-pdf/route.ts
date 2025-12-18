import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('file') as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
        }

        // Convert all files to base64 and create inline data parts
        const pdfParts = await Promise.all(
            files.map(async (file) => {
                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                return {
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: buffer.toString('base64'),
                    },
                };
            })
        );

        // Initialize Gemini using @google/genai
        const client = new GoogleGenAI({ apiKey });

        console.log(`Generating content with Gemini from ${files.length} PDF(s)...`);

        // Correct usage for @google/genai
        const result = await client.models.generateContent({
            model: 'gemini-3-flash-preview',
            config: {
                temperature: 0.4,
                thinkingConfig: {
                    // @ts-expect-error: Library types do not yet support MINIMAL
                    thinkingLevel: 'MINIMAL'
                },
            },
            contents: [
                {
                    role: 'user',
                    parts: [
                        ...pdfParts,
                        {
                            text: `You are an elite Professor creating a rigorous practice exam.

### CONTEXT
The student has ALREADY SOLVED all questions in the provided PDF(s). They are running out of practice material and strictly need NEW challenges.
Your job is to generate a fresh exam that tests the same concepts to verify true mastery, not just memorization of the old questions.

### MISSION
Create ONE SINGLE, UNIFIED practice exam that synthesizes concepts from ALL provided PDF(s).
The resulting exam must be a seamless integration of topics, appearing as if it were the "next year's" or "final" version of the provided exams.

### CRITICAL RULES
1. **Single Unified Exam**: Regardless of the number of input files, generate exactly ONE exam document. Do NOT separate the exam into "File 1" and "File 2" sections. The questions should flow logically by topic, not by source file.
2. **Deep Synthesis**:
   - Analyze ALL files to build a holistic understanding of the subject matter.
   - If files have overlapping content, merge them into deeper, more complex questions rather than repeating simple concepts.
   - Ensure NO overlapping or redundant questions. Each problem must test a distinct aspect of the combined, comprehensive syllabus.
3. **Novelty & Rigor**:
   - **Anti-Repetition**: Since the student has seen the original questions, any similarity will be spotted immediately. AVOID superficial rephrasing.
   - Create BRAND NEW questions. Change contexts, function types (e.g., trig → exp), and variables.
   - **Increase Complexity**: NEVER make a question easier. If in doubt, increase complexity slightly.
   - **Master Logic**: Focus on testing the underlying principles.
4. **Formatting mimicry**:
   - **Maintain Format**: Detect and COPY the exact formatting style, layout, and structure of the input PDF(s). Do NOT add new headers, title pages, or sections unless they exist in the source.
   - **No MCQ Splits**: Wrap EACH MCQ block and its options in a \\begin{minipage}{\\linewidth} ... \\end{minipage} to prevent page breaks.
   - No hints, specific advice, or conversational filler. ONLY the exam content.

### OUTPUT REQUIREMENTS
- Return **ONLY** valid, standalone LaTeX code.
- Start strictly with \\documentclass and end with \\end{document}.
- Do NOT include markdown code blocks (like \`\`\`latex) or introductory text.`
                        },
                    ],
                },
            ],
        });

        // Handle response logic
        const r = result as any;
        let responseText =
            typeof r.text === 'function' ? r.text() :
                r.response?.text?.() ||
                r.candidates?.[0]?.content?.parts?.[0]?.text ||
                '';

        console.log('Gemini response received. Length:', responseText.length);

        // Robust LaTeX Extraction
        let texContent = responseText.trim();

        // Strategy 1: Look for markdown code blocks
        const codeBlockMatch = responseText.match(/```(?:latex|tex)?\n?([\s\S]*?)```/i);
        if (codeBlockMatch) {
            texContent = codeBlockMatch[1].trim();
        } else {
            // Strategy 2: Find the main LaTeX document structure
            const docMatch = responseText.match(/(\\documentclass[\s\S]*?\\end\{document\})/i);
            if (docMatch) {
                texContent = docMatch[1].trim();
            }
        }

        // Final cleanup of extra chatter that might be outside backticks or doc
        if (!texContent.startsWith('\\documentclass')) {
            const startIdx = texContent.indexOf('\\documentclass');
            if (startIdx !== -1) {
                texContent = texContent.substring(startIdx);
            }
        }
        if (!texContent.endsWith('\\end{document}')) {
            const endIdx = texContent.lastIndexOf('\\end{document}');
            if (endIdx !== -1) {
                texContent = texContent.substring(0, endIdx + 14);
            }
        }

        // Save to temp file
        const tempDir = os.tmpdir();
        const runId = Math.random().toString(36).substring(7);
        const texFilePath = path.join(tempDir, `exam_${runId}.tex`);
        const pdfFilePath = path.join(tempDir, `exam_${runId}.pdf`);

        await fs.promises.writeFile(texFilePath, texContent);

        let pdfBase64: string | null = null;
        let pdfError = null;

        // Attempt to compile with pdflatex
        try {
            console.log(`Compiling TeX at ${texFilePath}...`);
            await execAsync(`pdflatex -interaction=nonstopmode -output-directory="${tempDir}" "${texFilePath}"`, {
                env: {
                    ...process.env,
                    PATH: `${process.env.PATH}:/Library/TeX/texbin:/usr/texbin:/usr/local/bin:/opt/homebrew/bin`
                }
            });

            if (fs.existsSync(pdfFilePath)) {
                const pdfBuffer = await fs.promises.readFile(pdfFilePath);
                pdfBase64 = pdfBuffer.toString('base64');
            } else {
                throw new Error('PDF file not created');
            }
        } catch (compileError: any) {
            console.error('PDF Compilation failed:', compileError);
            pdfError = 'PDF compilation failed: ' + (compileError.message || 'Unknown error');
        }

        return NextResponse.json({
            tex: texContent,
            pdfBase64: pdfBase64,
            error: pdfError
        });

    } catch (error: any) {
        console.error('Error processing request:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}