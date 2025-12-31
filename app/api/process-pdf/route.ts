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

        console.log('\n┌──────────────────────────────────────────────────┐');
        console.log('│ [API] NEW REQUEST: /api/process-pdf               │');
        console.log('└──────────────────────────────────────────────────┘');
        console.log(`│ Files Received: ${files.length} PDF(s)`);

        const isRegenerate = formData.get('regenerate') === 'true';
        const hasContext = !!formData.get('previousContext');
        const hasQuestions = !!formData.get('questions');

        console.log(`│ Regeneration: ${isRegenerate ? 'YES' : 'NO'}`);
        if (isRegenerate) {
            console.log(`│    ├─ Context Provided: ${hasContext ? 'YES' : 'NO'}`);
            console.log(`│    └─ Questions List: ${hasQuestions ? 'YES' : 'NO'}`);
        }

        console.log('│ Sending to Gemini...');
        const startTime = Date.now();

        // Correct usage for @google/genai
        const result = await client.models.generateContent({
            model: 'gemini-3-flash-preview',
            config: {
                temperature: 0.4,
                thinkingConfig: {
                    includeThoughts: true,
                    // @ts-expect-error: thinkingLevel is the new parameter for Gemini 3
                    thinkingLevel: 'low'
                }
            },
            contents: [
                {
                    role: 'user',
                    parts: [
                        ...pdfParts,
                        {
                            text: `ROLE: Elite Professor.
GOAL: Create ONE unified, novel practice exam based on provided material.

SOURCE PROTOCOL:
- Content: User has solved source PDF questions. Generate NEW variants testing identical logic.
- Total Synthesis: Analyze ALL source files. Select mix of ~15-20 questions (standard exam length).
- Selection: Prioritize high-impact/distinct concepts over simple repetition.

${isRegenerate ? `
REGEN PROTOCOL (ACTIVE):
- History: User solved a previous attempt. DO NOT reuse values, wording, or structure.
- Variance: Change order, mix concepts, vary part counts.
- Previous Attempt:
\`\`\`latex
${(formData.get('previousContext') as string).substring(0, 15000)}
\`\`\`
` : ''}

${formData.get('questions') ? `
SOURCE BLUEPRINT (MANDATORY):
- Target these specific types: [${JSON.parse(formData.get('questions') as string).join(', ')}]
- Strategy: Create fresh instances for each type. Change context/functions/values.
` : ''}

STRICT CONSTRAINTS:
1. NO DUPLICATES: Question content must diverge significantly from ALL sources.
2. COMPLEXITY: Never easier. Maintain or slightly increase mathematical/logical rigor.
3. SINGLE DOCUMENT: One unified LaTeX outcome. Flow by topic, not by source file.
4. DOCUMENT FORMAT: Exact mimicry of source LaTeX style, layout, and packages.
5. NO CHATTER: Zero conversational text, zero markdown blocks. Return LaTeX only.
6. STABILITY: Wrap MCQs in \`minipage{\\linewidth}\` to prevent page breaks.

OUTPUT FORMAT:
- Start: \\documentclass
- End: \\end{document}
- FOOTER (MANDATORY): After \\end{document}, list EVERY source question type found:
[[QUESTION_TYPES: Type 1, Type 2, ...]]`
                        },
                    ],
                },
            ],
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`│ Gemini Response Received (${duration}s)`);

        // Handle response logic
        const r = result as any;

        // Extract Thoughts if present
        const candidate = r.candidates?.[0];
        if (candidate?.content?.parts?.some((p: any) => p.thought)) {
            console.log('│ Thoughts Generated: YES');
            // We could log them, but they might be long. Let's log the first 200 chars to confirm.
            const thoughtPart = candidate.content.parts.find((p: any) => p.thought);
            if (thoughtPart) {
                console.log(`│    preview: "${thoughtPart.text?.substring(0, 100)}..."`);
            }
        }

        let responseText =
            typeof r.text === 'function' ? r.text() :
                r.response?.text?.() ||
                candidate?.content?.parts?.find((p: any) => !p.thought)?.text ||
                '';

        console.log(`│ Raw Length: ${responseText.length} chars`);

        // Parsing Question Types
        let detectedQuestions: string[] = [];
        const questionsMatch = responseText.match(/\[\[QUESTION_TYPES:([\s\S]*?)\]\]/);
        if (questionsMatch) {
            detectedQuestions = questionsMatch[1].split(',').map((t: string) => t.trim()).filter(Boolean);
            // Remove the block from the text to keep LaTeX clean
            responseText = responseText.replace(questionsMatch[0], '');
            console.log(`│ Detected Questions: [${detectedQuestions.length} Items]`);
            // detectedQuestions.forEach(q => console.log(`│    - ${q}`)); // Uncommon if list is long
        } else {
            console.log('│ No QUESTION_TYPES block found.');
        }

        // Robust LaTeX Extraction
        let texContent = responseText.trim();

        // Strategy 1: Look for markdown code blocks
        const codeBlockMatch = responseText.match(/```(?:latex|tex)?\n?([\s\S]*?)```/i);
        if (codeBlockMatch) {
            console.log('│ Strategy: Markdown Block Extraction');
            texContent = codeBlockMatch[1].trim();
        } else {
            // Strategy 2: Find the main LaTeX document structure
            const docMatch = responseText.match(/(\\documentclass[\s\S]*?\\end\{document\})/i);
            if (docMatch) {
                console.log('│ Strategy: Document Structure Match');
                texContent = docMatch[1].trim();
            } else {
                console.log('│ Strategy: Raw Text Fallback (Risk of formatting issues)');
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
        console.log(`│ TeX Saved: ${texFilePath}`);

        let pdfBase64: string | null = null;
        let pdfError = null;

        // Attempt to compile with pdflatex
        try {
            console.log('│ Compiling PDF...');
            await execAsync(`pdflatex -interaction=nonstopmode -output-directory="${tempDir}" "${texFilePath}"`, {
                env: {
                    ...process.env,
                    PATH: `${process.env.PATH}:/Library/TeX/texbin:/usr/texbin:/usr/local/bin:/opt/homebrew/bin`
                }
            });

            if (fs.existsSync(pdfFilePath)) {
                const pdfBuffer = await fs.promises.readFile(pdfFilePath);
                pdfBase64 = pdfBuffer.toString('base64');
                console.log('│ PDF Created Successfully');
            } else {
                throw new Error('PDF file not created');
            }
        } catch (compileError: any) {
            console.error('│ PDF Compilation Failed');
            // console.error(compileError); // Keep clean logs, maybe verify if needed
            pdfError = 'PDF compilation failed: ' + (compileError.message || 'Unknown error');
        }

        console.log('└──────────────────────────────────────────────────┘\n');

        return NextResponse.json({
            tex: texContent,
            pdfBase64: pdfBase64,
            questions: detectedQuestions,
            error: pdfError
        });

    } catch (error: any) {
        console.error('│ CRITICAL ERROR:', error);
        console.log('└──────────────────────────────────────────────────┘\n');
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}