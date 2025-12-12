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
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');

        // Initialize Gemini using @google/genai
        const client = new GoogleGenAI({ apiKey });

        console.log('Generating content with Gemini...');

        // Correct usage for @google/genai
        const result = await client.models.generateContent({
            model: 'gemini-flash-lite-latest',
            config: {
                temperature: 0.2,
            },
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'application/pdf',
                                data: base64Data,
                            },
                        },
                        {
                            text: 'Using the exam sample I provided, generate a new exam with entirely new questions while replicating the original format exactly—including fonts, spacing, layout, page breaks, headers, footers, and numbering. Produce the full Overleaf-ready LaTeX code that recreates the exact style, and output only the LaTeX code, with no additional explanation or commentary. Very heavy emphasis on keeping the same format, do not create your own',
                        },
                    ],
                },
            ],
        });

        // Handle response structure for @google/genai (v0.x vs v1.x)
        // Cast to any to avoid TS errors while handling multiple potential partial structures
        const r = result as any;
        const responseText =
            typeof r.text === 'function' ? r.text() :
                r.response?.text?.() ||
                r.candidates?.[0]?.content?.parts?.[0]?.text ||
                JSON.stringify(result);

        console.log('Gemini response received.');

        // Extract LaTeX content (simple heuristic)
        // Sometimes Gemini wraps code in ```latex ... ```
        let texContent = responseText;
        const codeBlockMatch = responseText.match(/```(?:latex|tex)?\n([\s\S]*?)\n```/i);
        if (codeBlockMatch) {
            texContent = codeBlockMatch[1];
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
            // Run pdflatex twice to resolve references if needed, but once is usually enough for simple docs
            // Use -interaction=nonstopmode to prevent hanging on errors
            // Ensure PATH includes the MacTeX/BasicTeX binary locations
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

        // Clean up temp files
        // try {
        //     await fs.promises.unlink(texFilePath);
        //     if (pdfBase64) await fs.promises.unlink(pdfFilePath);
        // } catch (e) { console.error('Cleanup failed', e); }

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