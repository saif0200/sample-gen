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
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 font-sans text-zinc-900 dark:text-zinc-100 overflow-y-scroll">
      <AnimatedBackground />

      <motion.main
        className="w-full relative z-10 flex flex-col"
        initial={false}
        animate={{
          maxWidth: status === 'success' ? 768 : 576
        }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >

        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <AnimatePresence initial={false}>
            {status !== 'success' && (
              <motion.div
                key="header"
                initial={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto', marginBottom: 48 }}
                exit={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full text-center overflow-hidden"
              >
                <div className="pt-2 space-y-4">
                  <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-white/50 dark:bg-black/50 backdrop-blur-md shadow-sm ring-1 ring-zinc-900/5 dark:ring-zinc-100/10">
                    <Sparkles className="h-6 w-6 text-indigo-500 mr-2" />
                    <span className="font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">AI Exam Generator</span>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100 whitespace-nowrap">
                    Transform your exams in seconds.
                  </h1>
                  <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
                    Upload a past exam PDF. Our AI will analyze the structure and generate a fresh, unique version instantly.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Card (Form or Preview) */}
          <motion.div
            initial={false}
            animate={{ height: status === 'success' ? '75vh' : 500 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full overflow-hidden rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-2xl ring-1 ring-zinc-900/5 dark:ring-zinc-100/10"
          >
            <div
              className={cn(
                "h-full transition-[padding] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                status === 'success' ? "p-0" : "p-6 md:p-8 flex flex-col justify-center"
              )}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {/* IDLE / UPLOAD STATE */}
                {status === 'idle' && !file && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="w-full h-full"
                  >
                    <div
                      className={cn(
                        "relative group cursor-pointer flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 w-full h-full transition-all duration-200 ease-in-out hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10",
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
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="flex flex-col items-center space-y-8 w-full"
                  >
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
                        Ready to generate?
                      </h3>
                      <p className="text-zinc-500">Review your selection below</p>
                    </div>

                    <div className="relative flex items-center gap-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-6 w-full max-w-md ring-1 ring-zinc-200 dark:ring-zinc-700 shadow-sm">
                      <div className="rounded-xl bg-red-100 p-3 dark:bg-red-900/20">
                        <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{file.name}</p>
                        <p className="text-sm text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        onClick={reset}
                        className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors group"
                        title="Remove file"
                      >
                        <X className="h-5 w-5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200" />
                      </button>
                    </div>

                    <div className="flex gap-4 w-full max-w-md">
                      <button
                        onClick={reset}
                        className="flex-1 rounded-xl px-6 py-4 font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleProcess}
                        className="flex-[2] rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
                      >
                        Generate Exam
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* PROCESSING STATE */}
                {(status === 'uploading' || status === 'processing') && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="flex flex-col items-center justify-center space-y-8 w-full"
                  >
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full blur-2xl bg-indigo-500/20 animate-pulse" />
                      <div className="relative p-6 rounded-full bg-indigo-50 dark:bg-indigo-900/10 ring-1 ring-indigo-100 dark:ring-indigo-800">
                        <Loader2 className="h-12 w-12 animate-spin text-indigo-600 dark:text-indigo-400" />
                      </div>
                    </div>
                    <div className="text-center space-y-2 max-w-sm mx-auto">
                      <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">
                        {status === 'uploading' ? 'Uploading PDF...' : loadingText}
                      </h3>
                      <p className="text-zinc-500 text-sm">
                        This might take a minute or two. <br /> Please keep this window open.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* SUCCESS STATE - PREVIEW ONLY */}
                {status === 'success' && downloads.pdf && (
                  <motion.div
                    key="success-preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.3 } }}
                    transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                    className="w-full h-full"
                  >
                    <iframe
                      src={`${downloads.pdf}#toolbar=0&view=FitH`}
                      className="w-full h-[75vh] bg-white border-0"
                      title="Exam Preview"
                    />
                  </motion.div>
                )}

                {/* ERROR STATE */}
                {status === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="text-center py-8 space-y-6 w-full"
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

          {/* Action Buttons (Below Container) */}
          <AnimatePresence>
            {status === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: 20, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto', marginTop: 24 }}
                exit={{
                  opacity: 0,
                  y: 10,
                  height: 0,
                  marginTop: 0,
                  transition: {
                    opacity: { duration: 0.2 },
                    y: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                    height: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                    marginTop: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
                  }
                }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex flex-col items-center gap-6 overflow-hidden"
              >
                <div className="flex items-center gap-2 rounded-full bg-green-100/50 backdrop-blur-md px-4 py-2 text-sm font-medium text-green-700 ring-1 ring-green-700/10 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-400/20">
                  <CheckCircle className="h-4 w-4" />
                  Exam Generated Successfully
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  {downloads.pdf && (
                    <a
                      href={downloads.pdf}
                      download="generated_exam.pdf"
                      className="group flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 hover:scale-105 active:scale-95 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      <Download className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                      Download PDF
                    </a>
                  )}
                  {downloads.tex && (
                    <a
                      href={downloads.tex}
                      download="generated_exam.tex"
                      className="group flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/50 backdrop-blur-sm px-6 py-3 font-semibold text-zinc-900 shadow-sm transition-all hover:bg-white hover:border-zinc-300 hover:scale-105 active:scale-95 dark:border-zinc-700 dark:bg-black/50 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    >
                      <File className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                      Download TeX
                    </a>
                  )}
                  <button
                    onClick={reset}
                    className="flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                  >
                    <RefreshCw className="h-5 w-5" />
                    Reset
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <motion.p
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1 }
            }}
            className="text-center mt-12 text-sm text-zinc-400 dark:text-zinc-600"
          >
            Powered by Gemini Flash Lite & LaTeX
          </motion.p>

        </motion.div> {/* End stagger wrapper */}
      </motion.main>
    </div >
  );
}
