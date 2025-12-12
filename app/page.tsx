'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Loader2, AlertCircle, Download, CheckCircle, File, X, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Animated Background Component
const AnimatedBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
    <div className="absolute top-[-10%] left-[-10%] h-[50rem] w-[50rem] rounded-full bg-purple-200/30 blur-3xl mix-blend-multiply dark:bg-purple-900/10 animate-blob" />
    <div className="absolute top-[-10%] right-[-10%] h-[50rem] w-[50rem] rounded-full bg-blue-200/30 blur-3xl mix-blend-multiply dark:bg-blue-900/10 animate-blob animation-delay-2000" />
    <div className="absolute bottom-[-20%] left-[20%] h-[50rem] w-[50rem] rounded-full bg-pink-200/30 blur-3xl mix-blend-multiply dark:bg-pink-900/10 animate-blob animation-delay-4000" />
  </div>
);

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [downloads, setDownloads] = useState<{ tex: string | null; pdf: string | null }>({ tex: null, pdf: null });
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Loading text cycler
  const [loadingText, setLoadingText] = useState('Initializing AI...');
  useEffect(() => {
    if (status !== 'processing') return;
    const texts = [
      'Analyzing PDF structure...',
      'Extracting questions...',
      'Generating new problems...',
      'Formatting LaTeX code...',
      'Compiling PDF document...',
      'Polishing final output...'
    ];
    let i = 0;
    const interval = setInterval(() => {
      setLoadingText(texts[i % texts.length]);
      i++;
    }, 2500);
    return () => clearInterval(interval);
  }, [status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setStatus('idle');
      setMessage('');
      setDownloads({ tex: null, pdf: null });
    } else {
      setMessage('Please upload a PDF file.');
      setStatus('error');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setStatus('uploading');
    setMessage('Uploading PDF...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      setStatus('processing');
      // setMessage is handled by the effect now

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // TeX download
      const texBlob = new Blob([data.tex], { type: 'text/plain' });
      const texUrl = window.URL.createObjectURL(texBlob);

      // PDF download
      let pdfUrl = null;
      if (data.pdfBase64) {
        const pdfBlob = await (await fetch(`data:application/pdf;base64,${data.pdfBase64}`)).blob();
        pdfUrl = window.URL.createObjectURL(pdfBlob);
      }

      setDownloads({ tex: texUrl, pdf: pdfUrl });

      if (pdfUrl) {
        setStatus('success');
        setMessage('Exam generated successfully!');
      } else {
        setStatus('success'); // Treat as success for UI flow, but show warning
        const errorMsg = data.error;
        if (errorMsg) {
          setMessage(`Note: PDF generation failed (${errorMsg}), but TeX is ready.`);
        } else {
          setMessage('Exam generated successfully (TeX format)!');
        }
      }

    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setMessage(error.message || 'Something went wrong.');
    }
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setMessage('');
    setDownloads({ tex: null, pdf: null });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 font-sans text-zinc-900 dark:text-zinc-100">
      <AnimatedBackground />

      <main className={cn(
        "w-full relative z-10 transition-all duration-500 ease-in-out",
        status === 'success' ? "max-w-5xl" : "max-w-2xl"
      )}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center space-y-4"
        >
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-white/50 dark:bg-black/50 backdrop-blur-md shadow-sm ring-1 ring-zinc-900/5 dark:ring-zinc-100/10">
            <Sparkles className="h-6 w-6 text-indigo-500 mr-2" />
            <span className="font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">AI Exam Generator</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
            Transform your exams in seconds.
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
            Upload a past exam PDF. Our AI will analyze the structure and generate a fresh, unique version instantly.
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-2xl ring-1 ring-zinc-900/5 dark:ring-zinc-100/10"
        >
          <div className="p-8 md:p-10">
            <AnimatePresence mode="wait">
              {/* IDLE / UPLOAD STATE */}
              {status === 'idle' && !file && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <div
                    className={cn(
                      "relative group cursor-pointer flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-12 transition-all duration-200 ease-in-out hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10",
                      dragActive && "border-indigo-500 bg-indigo-50/50 scale-[1.02]"
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="mb-4 rounded-full bg-indigo-50 p-4 dark:bg-indigo-900/30 group-hover:scale-110 transition-transform duration-200">
                      <Upload className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      Click to upload or drag and drop
                    </h3>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      PDF file (max 10MB)
                    </p>
                  </div>
                </motion.div>
              )}

              {/* FILE SELECTED STATE */}
              {status === 'idle' && file && (
                <motion.div
                  key="file-selected"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center space-y-6"
                >
                  <div className="relative flex items-center gap-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-6 w-full ring-1 ring-zinc-200 dark:ring-zinc-700">
                    <div className="rounded-xl bg-red-100 p-3 dark:bg-red-900/20">
                      <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{file.name}</p>
                      <p className="text-sm text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      onClick={reset}
                      className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <X className="h-5 w-5 text-zinc-500" />
                    </button>
                  </div>

                  <button
                    onClick={handleProcess}
                    className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
                  >
                    Generate New Exam
                  </button>
                </motion.div>
              )}

              {/* PROCESSING STATE */}
              {(status === 'uploading' || status === 'processing') && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-8 space-y-6"
                >
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full blur-xl bg-indigo-500/30 animate-pulse" />
                    <Loader2 className="h-16 w-16 animate-spin text-indigo-600 relative z-10" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">
                      {status === 'uploading' ? 'Uploading...' : loadingText}
                    </h3>
                    <p className="text-zinc-500 text-sm">Do not close this window</p>
                  </div>
                </motion.div>
              )}

              {/* SUCCESS STATE */}
              {status === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col items-center text-center space-y-4 mb-8">
                    <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30 mb-2 ring-8 ring-green-50 dark:ring-green-900/10">
                      <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Exam Ready!</h3>
                    <p className="text-zinc-600 dark:text-zinc-400 max-w-sm">
                      {message}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {downloads.pdf && (
                      <a
                        href={downloads.pdf}
                        download="generated_exam.pdf"
                        className="flex items-center justify-center gap-3 rounded-xl bg-zinc-900 px-6 py-4 font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 hover:-translate-y-1 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        <Download className="h-5 w-5" />
                        Download PDF
                      </a>
                    )}
                    {downloads.tex && (
                      <a
                        href={downloads.tex}
                        download="generated_exam.tex"
                        className="flex items-center justify-center gap-3 rounded-xl border-2 border-zinc-200 px-6 py-4 font-semibold text-zinc-900 transition-all hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <File className="h-5 w-5" />
                        Download TeX
                      </a>
                    )}
                  </div>

                  {downloads.pdf && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-8 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-xl bg-zinc-50 dark:bg-zinc-900 ring-1 ring-zinc-900/5"
                    >
                      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-indigo-500" /> Exam Preview
                        </h4>
                      </div>
                      <iframe
                        src={`${downloads.pdf}#toolbar=0&view=FitH`}
                        className="w-full h-[800px] bg-white"
                        title="Exam Preview"
                      />
                    </motion.div>
                  )}

                  <button
                    onClick={reset}
                    className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors py-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Generate Another
                  </button>
                </motion.div>
              )}

              {/* ERROR STATE */}
              {status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8 space-y-6"
                >
                  <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/30 mx-auto w-fit ring-8 ring-red-50 dark:ring-red-900/10">
                    <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Something went wrong</h3>
                    <p className="text-zinc-600 dark:text-zinc-400">{message}</p>
                  </div>
                  <button
                    onClick={reset}
                    className="rounded-xl bg-zinc-900 px-8 py-3 font-semibold text-white transition-transform hover:scale-105 dark:bg-white dark:text-zinc-900"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12 text-sm text-zinc-400 dark:text-zinc-600"
        >
          Powered by Gemini Flash Lite & LaTeX
        </motion.p>

      </main>
    </div>
  );
}
