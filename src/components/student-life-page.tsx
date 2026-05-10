'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, Send, Trash2, ArrowRight, BookOpen, Calculator, Clock,
  Lightbulb, GraduationCap, ExternalLink, Sparkles, Brain,
  Timer, PenTool, Headphones, X, Maximize2, Minimize2,
  Target, Trophy, Star, CalendarDays, Zap, Heart, Rocket,
  FileText, Globe, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface StudentLifePageProps {
  onBack: () => void;
}

interface ChatMessage {
  id: string;
  from: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

const subjects = [
  { name: 'الرياضيات', icon: '📐', color: 'from-blue-500 to-blue-600' },
  { name: 'العلوم', icon: '🔬', color: 'from-green-500 to-green-600' },
  { name: 'اللغة العربية', icon: '📝', color: 'from-amber-500 to-amber-600' },
  { name: 'اللغة الإنجليزية', icon: '🇬🇧', color: 'from-purple-500 to-purple-600' },
  { name: 'التاريخ', icon: '📜', color: 'from-orange-500 to-orange-600' },
  { name: 'الجغرافيا', icon: '🌍', color: 'from-teal-500 to-teal-600' },
  { name: 'الكمبيوتر', icon: '💻', color: 'from-cyan-500 to-cyan-600' },
  { name: 'عام', icon: '💡', color: 'from-rose-500 to-rose-600' },
];

const quickQuestions = [
  'اشرح لي الكسور في الرياضيات',
  'ما هي خصائص المادة؟',
  'كيف أكتب مقالاً بالعربية؟',
  'نصائح للمذاكرة الفعالة',
  'ما هو الفرق بين الفعل والاسم؟',
  'كيف أحسب مساحة الدائرة؟',
];

const studyTools = [
  {
    title: 'آلة حاسبة',
    description: 'آلة حاسبة علمية للعمليات الرياضية',
    icon: <Calculator className="w-8 h-8" />,
    color: 'from-blue-500 to-blue-600',
    action: 'calculator' as const,
  },
  {
    title: 'مؤقت المذاكرة',
    description: 'تقنية بومودورو للمذاكرة المركزة',
    icon: <Timer className="w-8 h-8" />,
    color: 'from-green-500 to-green-600',
    action: 'pomodoro' as const,
  },
  {
    title: 'نصائح دراسية',
    description: 'نصائح وطرق مذاكرة مجربة وفعالة',
    icon: <Lightbulb className="w-8 h-8" />,
    color: 'from-amber-500 to-amber-600',
    action: 'tips' as const,
  },
  {
    title: 'NotebookLM',
    description: 'المساعد الذكي من جوجل لدراسة الملفات',
    icon: <Brain className="w-8 h-8" />,
    color: 'from-purple-500 to-pink-500',
    action: 'notebooklm' as const,
  },
];

const dailyMotivations = [
  { text: 'النجاح ليس نهاية الطريق، والفشل ليس قاتلاً. إنما الشجاعة للاستمرار هي ما يهم.', author: 'ونستون تشرشل' },
  { text: 'التعليم هو أقوى سلاح يمكنك استخدامه لتغيير العالم.', author: 'نيلسون مانديلا' },
  { text: 'لا تنتظر الفرصة، بل اصنعها بنفسك.', author: 'جورج برنارد شو' },
  { text: 'كل إنجاز عظيم كان يوماً مستحيلاً.', author: 'مثل إنجليزي' },
  { text: 'الطريقة الوحيدة لعمل عمل عظيم هي أن تحب ما تفعله.', author: 'ستيف جوبز' },
  { text: 'العلم نور والجهل ظلام.', author: 'مثل عربي' },
  { text: 'من جد وجد ومن زرع حصد.', author: 'مثل عربي' },
  { text: 'إذا أردت شيئاً بشدة، فالكون كله يتآمر لمساعدتك على تحقيقه.', author: 'باولو كويلو' },
  { text: 'لا يهم كم تسير ببطء ما دمت لا تتوقف.', author: 'كونفوشيوس' },
  { text: 'أنت لست ضحية ظروفك، بل أنت صانعها.', author: 'روبن شارما' },
];

const quickResources = [
  {
    title: 'NotebookLM',
    description: 'مساعد جوجل الذكي للدراسة ورفع الملفات',
    icon: <Brain className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
    url: 'https://notebooklm.google.com',
  },
  {
    title: 'أكاديمية خان',
    description: 'دروس مجانية في جميع المواد',
    icon: <BookOpen className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-500',
    url: 'https://www.khanacademy.org/',
  },
  {
    title: 'Quizlet',
    description: 'بطاقات تعليمية واختبارات تفاعلية',
    icon: <PenTool className="w-6 h-6" />,
    color: 'from-amber-500 to-orange-500',
    url: 'https://quizlet.com/',
  },
  {
    title: 'منصة عين التعليمية',
    description: 'محتوى تعليمي مصري رسمي',
    icon: <Globe className="w-6 h-6" />,
    color: 'from-red-500 to-rose-500',
    url: 'https://afnad.org/',
  },
  {
    title: 'بنك المعرفة المصري',
    description: 'موارد تعليمية ومنح دراسية',
    icon: <FileText className="w-6 h-6" />,
    color: 'from-teal-500 to-cyan-500',
    url: 'https://www.ekb.eg/',
  },
  {
    title: 'YouTube Education',
    description: 'قنوات تعليمية مجانية بالعربية',
    icon: <Headphones className="w-6 h-6" />,
    color: 'from-red-600 to-red-500',
    url: 'https://www.youtube.com/',
  },
];

export default function StudentLifePage({ onBack }: StudentLifePageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('عام');
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [activeTool, setActiveTool] = useState<'none' | 'calculator' | 'pomodoro' | 'tips'>('none');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  // Daily motivation
  const [dailyMotivation] = useState(() => {
    const today = new Date();
    const dayIndex = (today.getFullYear() * 366 + today.getMonth() * 31 + today.getDate()) % dailyMotivations.length;
    return dailyMotivations[dayIndex];
  });

  // Exam countdown
  const [examCountdown, setExamCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Pomodoro state
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'break'>('work');
  const [pomodoroSessions, setPomodoroSessions] = useState(0);

  // Calculator state
  const [calcDisplay, setCalcDisplay] = useState('0');

  // Study progress
  const [todayStudyMinutes, setTodayStudyMinutes] = useState(0);
  const [studyGoal] = useState(120); // 2 hours daily goal

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Exam countdown - targets mid-June as typical exam period
  useEffect(() => {
    const getExamDate = () => {
      const now = new Date();
      const year = now.getFullYear();
      // exams typically start mid-June
      let examDate = new Date(year, 5, 15); // June 15
      if (now > examDate) {
        examDate = new Date(year + 1, 5, 15);
      }
      return examDate;
    };

    const updateCountdown = () => {
      const now = new Date();
      const examDate = getExamDate();
      const diff = examDate.getTime() - now.getTime();

      if (diff > 0) {
        setExamCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Pomodoro timer
  useEffect(() => {
    if (!pomodoroRunning) return;
    const interval = setInterval(() => {
      setPomodoroTime((prev) => {
        if (prev <= 1) {
          setPomodoroRunning(false);
          if (pomodoroMode === 'work') {
            setPomodoroMode('break');
            setPomodoroSessions((s) => s + 1);
            setTodayStudyMinutes((m) => m + 25);
            return 5 * 60;
          } else {
            setPomodoroMode('work');
            return 25 * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomodoroRunning, pomodoroMode]);

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text || inputMessage;
    if (!messageText.trim() || isLoading || sendingRef.current) return;

    sendingRef.current = true;

    const userMsg: ChatMessage = {
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 7),
      from: 'user',
      text: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Build history from current messages (stateless API)
      const chatHistory = messages.map((msg) => ({
        role: msg.from === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[المادة: ${selectedSubject}] ${messageText}`,
          history: chatHistory,
        }),
      });

      const data = await res.json();

      if (data.success && data.response) {
        const botMsg: ChatMessage = {
          id: Date.now().toString() + '-bot-' + Math.random().toString(36).slice(2, 7),
          from: 'bot',
          text: data.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: Date.now().toString() + '-err-' + Math.random().toString(36).slice(2, 7),
          from: 'bot',
          text: data.error || 'عذراً، حدث خطأ. حاول مرة أخرى.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: Date.now().toString() + '-catch-' + Math.random().toString(36).slice(2, 7),
        from: 'bot',
        text: 'عذراً، لم أتمكن من الاتصال بالخادم. تأكد من اتصالك بالإنترنت.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      sendingRef.current = false;
    }
  }, [inputMessage, isLoading, selectedSubject, messages]);

  const clearChat = () => {
    setMessages([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCalcButton = (val: string) => {
    if (val === 'C') {
      setCalcDisplay('0');
    } else if (val === '=') {
      try {
        const sanitized = calcDisplay.replace(/[^0-9+\-*/.()%]/g, '');
        const result = new Function(`return ${sanitized}`)();
        setCalcDisplay(String(result));
      } catch {
        setCalcDisplay('خطأ');
      }
    } else if (val === '⌫') {
      setCalcDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else {
      setCalcDisplay((prev) => (prev === '0' && val !== '.' ? val : prev + val));
    }
  };

  const formatPomodoroTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const studyTips = [
    { title: 'تقنية بومودورو', tip: 'ذاكر لمدة 25 دقيقة ثم استرح 5 دقائق. بعد 4 جولات خذ استراحة 15-30 دقيقة.', emoji: '🍅' },
    { title: 'التلخيص الذكي', tip: 'لا تنسخ النص بل اكتبه بكلماتك الخاصة. هذا يقوي الذاكرة والفهم.', emoji: '📝' },
    { title: 'التعليم النشط', tip: 'اشرح الدرس لنفسك أو لزميلك بصوت عالٍ. إذا لم تستطع شرحه فأنت لم تفهمه بعد.', emoji: '🗣️' },
    { title: 'المراجعة المتباعدة', tip: 'راجع المادة بعد يوم، ثم بعد 3 أيام، ثم بعد أسبوع، ثم بعد شهر.', emoji: '📅' },
    { title: 'الربط بالواقع', tip: 'اربط المعلومات بأمثلة من حياتك اليومية. هذا يجعلها أسهل في التذكر.', emoji: '🔗' },
    { title: 'النوم الكافي', tip: 'النوم 7-8 ساعات ضروري لتثبيت المعلومات في الذاكرة طويلة المدى.', emoji: '😴' },
    { title: 'الخرائط الذهنية', tip: 'ارسم خريطة ذهنية تربط المفاهيم ببعضها. الألوان والرسومات تساعد الذاكرة.', emoji: '🗺️' },
    { title: 'حل المسائل', tip: 'لا تكتفي بقراءة الحل. جرب حل المسائل بنفسك أولاً ثم قارن إجابتك.', emoji: '✏️' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-[#2A374E] text-white shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white hover:text-blue-300 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="font-medium">العودة للرئيسية</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">الحياة المدرسية</h1>
                <p className="text-blue-200 text-xs">أدوات ومساعدات دراسية ذكية</p>
              </div>
            </div>
            <div className="w-28" />
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        {/* Daily Motivation Card */}
        <div className="mb-6 animate-fade-in-up">
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-1">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-lg">
                    <Star className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400">تحفيز اليوم</span>
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 text-base md:text-lg font-medium leading-relaxed">
                      &ldquo;{dailyMotivation.text}&rdquo;
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">— {dailyMotivation.author}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exam Countdown & Study Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Exam Countdown */}
          <Card className="border-0 shadow-lg animate-fade-in-up">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold text-[#2A374E] dark:text-white">العد التنازلي للامتحانات</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                  <div className="text-2xl md:text-3xl font-bold text-red-600 dark:text-red-400">{examCountdown.days}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">يوم</div>
                </div>
                <div className="text-center bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
                  <div className="text-2xl md:text-3xl font-bold text-orange-600 dark:text-orange-400">{examCountdown.hours}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">ساعة</div>
                </div>
                <div className="text-center bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <div className="text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400">{examCountdown.minutes}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">دقيقة</div>
                </div>
                <div className="text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3">
                  <div className="text-2xl md:text-3xl font-bold text-yellow-600 dark:text-yellow-400">{examCountdown.seconds}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">ثانية</div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
                استعد جيداً... النجاح يبدأ من الآن! 🎯
              </p>
            </CardContent>
          </Card>

          {/* Study Progress */}
          <Card className="border-0 shadow-lg animate-fade-in-up">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-bold text-[#2A374E] dark:text-white">هدف المذاكرة اليومي</h3>
                </div>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {pomodoroSessions} جلسة
                </Badge>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">{todayStudyMinutes} دقيقة</span>
                  <span className="text-gray-600 dark:text-gray-400">{studyGoal} دقيقة (هدف)</span>
                </div>
                <Progress value={Math.min((todayStudyMinutes / studyGoal) * 100, 100)} className="h-3" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Trophy className="w-5 h-5 text-amber-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {todayStudyMinutes >= studyGoal
                    ? 'أحسنت! حققت هدفك اليومي 🏆'
                    : `بقي ${studyGoal - todayStudyMinutes} دقيقة لتحقيق هدفك`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{pomodoroSessions}</div>
                  <div className="text-xs text-gray-500">جلسات مكتملة</div>
                </div>
                <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">{todayStudyMinutes}</div>
                  <div className="text-xs text-gray-500">دقيقة مذاكرة</div>
                </div>
                <div className="text-center bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{Math.min(Math.round((todayStudyMinutes / studyGoal) * 100), 100)}%</div>
                  <div className="text-xs text-gray-500">من الهدف</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* NotebookLM Banner */}
        <div className="mb-8 animate-fade-in-up">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-1 shadow-2xl">
            <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />
            <div className="relative bg-gray-900/80 backdrop-blur-md rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10">
              <div className="flex-1 text-center md:text-right">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-emerald-400 flex items-center justify-center shadow-lg animate-pulse">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-indigo-200 to-purple-200">
                    المساعد الذكي من Google
                  </h2>
                </div>
                <p className="text-gray-300 text-base md:text-lg leading-relaxed mb-4 max-w-2xl">
                  استمتع بتجربة تعلم فريدة مع NotebookLM. يمكنك رفع ملفاتك الدراسية ومناقشتها،
                  الحصول على ملخصات ذكية، وإجابات دقيقة لأسئلتك.
                </p>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <Badge className="bg-white/10 text-blue-200 border-white/20">
                    📚 شرح الدروس
                  </Badge>
                  <Badge className="bg-white/10 text-purple-200 border-white/20">
                    📝 تلخيص الملفات
                  </Badge>
                  <Badge className="bg-white/10 text-pink-200 border-white/20">
                    💡 أسئلة وأجوبة
                  </Badge>
                </div>
              </div>
              <div className="flex-shrink-0">
                <a
                  href="https://notebooklm.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative inline-flex group/btn"
                >
                  <div className="absolute transition-all duration-1000 opacity-70 -inset-px bg-gradient-to-r from-[#44BCFF] via-[#FF44EC] to-[#FF675E] rounded-xl blur-lg group-hover/btn:opacity-100 group-hover/btn:-inset-1 group-hover/btn:duration-200" />
                  <span className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-gray-900 rounded-xl gap-2">
                    <ExternalLink className="w-5 h-5" />
                    ابدأ التعلم الآن
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Study Tools Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#2A374E] dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-red-600" />
            أدوات دراسية
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {studyTools.map((tool) => (
              <Card
                key={tool.title}
                className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 overflow-hidden group"
                onClick={() => {
                  if (tool.action === 'notebooklm') {
                    window.open('https://notebooklm.google.com', '_blank');
                  } else {
                    setActiveTool(activeTool === tool.action ? 'none' : tool.action);
                  }
                }}
              >
                <CardContent className="p-4 text-center">
                  <div className={`w-14 h-14 mx-auto rounded-xl bg-gradient-to-r ${tool.color} flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}>
                    {tool.icon}
                  </div>
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white mb-1">{tool.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Active Tool Panel */}
        {activeTool === 'calculator' && (
          <Card className="mb-8 border-0 shadow-lg animate-fade-in-up">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-600" />
                  آلة حاسبة علمية
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setActiveTool('none')}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="max-w-xs mx-auto">
                <div className="bg-gray-900 text-white text-right p-4 rounded-xl mb-3 text-3xl font-mono overflow-hidden">
                  {calcDisplay}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {['C', '⌫', '%', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '(', ')', '='].map((btn) => (
                    <Button
                      key={btn}
                      variant={btn === '=' ? 'default' : 'outline'}
                      className={`h-12 text-lg font-bold ${btn === '=' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                      onClick={() => handleCalcButton(btn)}
                    >
                      {btn}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTool === 'pomodoro' && (
          <Card className="mb-8 border-0 shadow-lg animate-fade-in-up">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  مؤقت المذاكرة - بومودورو
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setActiveTool('none')}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-center">
                <Badge className={`mb-4 ${pomodoroMode === 'work' ? 'bg-red-500' : 'bg-green-500'} text-white`}>
                  {pomodoroMode === 'work' ? '🕐 وقت المذاكرة' : '☕ وقت الراحة'}
                </Badge>
                <div className="text-7xl font-mono font-bold text-[#2A374E] dark:text-white mb-4">
                  {formatPomodoroTime(pomodoroTime)}
                </div>
                <div className="flex items-center justify-center gap-2 mb-6">
                  {[1, 2, 3, 4].map((session) => (
                    <div
                      key={session}
                      className={`w-4 h-4 rounded-full transition-all ${
                        session <= pomodoroSessions ? 'bg-green-500 scale-110' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                  <span className="text-sm text-gray-500 mr-2">
                    الجلسة {pomodoroSessions + 1} من 4
                  </span>
                </div>
                <div className="flex justify-center gap-3">
                  <Button
                    onClick={() => setPomodoroRunning(!pomodoroRunning)}
                    className={`px-8 py-3 text-lg font-bold ${pomodoroRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                  >
                    {pomodoroRunning ? '⏸ إيقاف' : '▶️ بدء'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPomodoroRunning(false);
                      setPomodoroMode('work');
                      setPomodoroTime(25 * 60);
                    }}
                    className="px-6 py-3"
                  >
                    🔄 إعادة
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTool === 'tips' && (
          <Card className="mb-8 border-0 shadow-lg animate-fade-in-up">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  نصائح دراسية مجربة
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setActiveTool('none')}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studyTips.map((tip, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{tip.emoji}</span>
                      <div>
                        <h4 className="font-bold text-gray-800 dark:text-white mb-1">{tip.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{tip.tip}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Chat Assistant Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-[#2A374E] dark:text-white flex items-center gap-2">
              <Bot className="w-6 h-6 text-purple-600" />
              المساعد الذكي
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearChat}>
                <Trash2 className="w-4 h-4 ml-1" />
                مسح المحادثة
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsChatExpanded(!isChatExpanded)}
              >
                {isChatExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Subject Selection */}
          <div className="flex flex-wrap gap-2 mb-4">
            {subjects.map((subject) => (
              <button
                key={subject.name}
                onClick={() => setSelectedSubject(subject.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedSubject === subject.name
                    ? `bg-gradient-to-r ${subject.color} text-white shadow-md scale-105`
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:shadow-md border border-gray-200 dark:border-gray-600'
                }`}
              >
                <span>{subject.icon}</span>
                {subject.name}
              </button>
            ))}
          </div>

          {/* Chat Container */}
          <Card className={`border-0 shadow-lg ${isChatExpanded ? 'fixed inset-4 z-50' : ''}`}>
            <CardContent className={`p-0 flex flex-col ${isChatExpanded ? 'h-full' : 'max-h-[500px]'}`}>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50 custom-scrollbar">
                {messages.length === 0 && (
                  <div className="text-center py-8 animate-fade-in-up">
                    <div className="w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <Bot className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
                      مرحباً! أنا المساعد الذكي
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      يمكنني مساعدتك في شرح الدروس والإجابة على أسئلتك
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {quickQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(q)}
                          className="px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl ${
                        msg.from === 'user'
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      {msg.from === 'bot' && (
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-600">
                          <Bot className="w-4 h-4 text-purple-500" />
                          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">المساعد الذكي</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</div>
                      <div className={`text-xs mt-2 ${msg.from === 'user' ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
                        {msg.timestamp.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start animate-fade-in-up">
                    <div className="bg-white dark:bg-gray-700 p-4 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">المساعد يكتب...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="اكتب سؤالك هنا..."
                    className="flex-1 text-right"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!inputMessage.trim() || isLoading}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6"
                  >
                    <Send className="w-4 h-4 rotate-180" />
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  المادة المختارة: <span className="font-medium text-purple-600">{selectedSubject}</span> • اضغط Enter للإرسال
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Resources Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#2A374E] dark:text-white mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-red-600" />
            روابط تعليمية مفيدة
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickResources.map((resource) => (
              <a
                key={resource.title}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md hover:shadow-xl transition-all hover:-translate-y-1 flex items-center gap-4 group border border-gray-100 dark:border-gray-700"
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${resource.color} rounded-xl flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform`}>
                  {resource.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 dark:text-white">{resource.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{resource.description}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>

        {/* Student Tips Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#2A374E] dark:text-white mb-4 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-600" />
            نصائح مهمة للطالب الناجح
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="p-5">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white mb-3">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-white mb-2">لا تتردد في السؤال</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  الطالب الناجح هو من يسأل ولا يخجل. إذا لم تفهم شيئاً، اسأل معلمك أو زميلك أو استخدم المساعد الذكي.
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="p-5">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white mb-3">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-white mb-2">نظّم وقتك</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  ضع جدول مذاكرة واقعي والتزم به. خصص وقتاً لكل مادة ولا تنسَ وقت الراحة والترفيه.
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="p-5">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl flex items-center justify-center text-white mb-3">
                  <Trophy className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-white mb-2">ثق بنفسك</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  كل طالب لديه القدرة على التفوق. المهم أن تبدأ وتستمر ولا تستسلم أبداً. النجاح قادم!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#2A374E] text-white py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} مدرسة الاحايوه شرق الاعدادية - الحياة المدرسية
          </p>
        </div>
      </footer>
    </div>
  );
}
