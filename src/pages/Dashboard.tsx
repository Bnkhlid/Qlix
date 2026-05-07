import { useState, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import {
  Send,
  Settings,
  LogOut,
  Users,
  Clock,
  CheckCircle2,
  Ban,
  MessageSquare,
  Phone,
  Calendar,
  AlertCircle,
  Play,
  RotateCcw,
  Trash2,
  Search,
  Plus,
  Image as ImageIcon,
  X,
  Wifi,
  WifiOff,
  Download,
  Upload,
  Pencil,
  Eye,
  CheckSquare,
  Square,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("send");
  const [sendSubTab, setSendSubTab] = useState("individual");
  const [phone, setPhone] = useState("");
  const [phones, setPhones] = useState("");
  const [message, setMessage] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  
  // Auto-Responder States
  const [arKeyword, setArKeyword] = useState("");
  const [arResponse, setArResponse] = useState("");
  const [arMatchType, setArMatchType] = useState<"exact" | "contains">("exact");
  const [arImageFiles, setArImageFiles] = useState<File[]>([]);
  const [arImagePreviews, setArImagePreviews] = useState<string[]>([]);
  const arFileInputRef = useRef<HTMLInputElement>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState("general");
  const [autoSave, setAutoSave] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [maxDailyMessages, setMaxDailyMessages] = useState(1000);
  const [defaultDelay, setDefaultDelay] = useState(2000);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [autoDeleteOldMessages, setAutoDeleteOldMessages] = useState(false);
  const [deleteOldAfterDays, setDeleteOldAfterDays] = useState(30);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  // New states
  const [showPreview, setShowPreview] = useState(false);
  const [editingContact, setEditingContact] = useState<{ id: number; name: string; phone: string } | null>(null);
  const [blockedSearchQuery, setBlockedSearchQuery] = useState("");
  const [newBlockPhone, setNewBlockPhone] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

  const { data: stats, refetch: refetchStats } = trpc.stats.getDashboard.useQuery();
  const { data: contacts, refetch: refetchContacts } = trpc.contacts.list.useQuery();
  const { data: scheduledMessages, refetch: refetchScheduled } = trpc.messages.getScheduled.useQuery();
  const { data: historyMessages, refetch: refetchHistory } = trpc.messages.getHistory.useQuery();
  const { data: waSession, refetch: refetchSession } = trpc.whatsapp.getSession.useQuery(undefined, { refetchInterval: 3000 });
  const { data: qrData } = trpc.whatsapp.getQrCode.useQuery(undefined, {
    refetchInterval: waSession?.status === "connecting" ? 3000 : false,
    enabled: waSession?.status === "connecting"
  });
  const { data: blockedNumbers, refetch: refetchBlocked } = trpc.whatsapp.getBlockedNumbers.useQuery();
  const { data: autoResponders, refetch: refetchAutoResponders } = trpc.autoResponders.list.useQuery();
  const { data: analytics } = trpc.stats.getAnalytics.useQuery(undefined, { refetchInterval: 30000 });

  // تحميل الإعدادات عند البدء
  useEffect(() => {
    loadSettings();
    
    // تحديث الرسائل المجدولة كل 5 ثوان
    const interval = setInterval(() => {
      refetchScheduled();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [refetchScheduled]);

  const createMessage = trpc.messages.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الرسالة بنجاح");
      setPhone("");
      setPhones("");
      setMessage("");
      setScheduleEnabled(false);
      setScheduleDate("");
      setSelectedContacts([]);
      refetchStats();
      refetchScheduled();
    },
    onError: (e) => toast.error(e.message),
  });

  const createContact = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة جهة الاتصال");
      setContactName("");
      setContactPhone("");
      refetchContacts();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteContact = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("تم الحذف");
      refetchContacts();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateContact = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success("تم التعديل بنجاح");
      setEditingContact(null);
      refetchContacts();
    },
    onError: (e) => toast.error(e.message),
  });

  const importContacts = trpc.contacts.import.useMutation({
    onSuccess: (data) => {
      toast.success(`تم استيراد ${data.count} جهة اتصال بنجاح`);
      refetchContacts();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const blockNumber = trpc.whatsapp.blockNumber.useMutation({
    onSuccess: () => {
      toast.success("تم حظر الرقم");
      setNewBlockPhone("");
      setNewBlockReason("");
      refetchBlocked();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const unblockNumber = trpc.whatsapp.unblockNumber.useMutation({
    onSuccess: () => {
      toast.success("تم رفع الحظر");
      refetchBlocked();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMessage = trpc.messages.delete.useMutation({
    onSuccess: () => {
      toast.success("تم الحذف");
      refetchScheduled();
      refetchHistory();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const clearHistory = trpc.messages.clearHistory.useMutation({
    onSuccess: () => {
      toast.success("تم مسح السجل بنجاح");
      refetchHistory();
      refetchStats();
    },
    onError: (e) => toast.error(e.message),
  });

  const createAutoResponder = trpc.autoResponders.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الرد الآلي");
      setArKeyword("");
      setArResponse("");
      setArImageFiles([]);
      setArImagePreviews([]);
      refetchAutoResponders();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleAutoResponder = trpc.autoResponders.toggle.useMutation({
    onSuccess: () => refetchAutoResponders(),
  });

  const deleteAutoResponder = trpc.autoResponders.delete.useMutation({
    onSuccess: () => {
      toast.success("تم الحذف");
      refetchAutoResponders();
    },
  });

  const logoutWa = trpc.whatsapp.logout.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الخروج من واتساب");
      refetchSession();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("اكتب نص الرسالة");
      return;
    }

    // التحقق من الجدولة
    if (scheduleEnabled) {
      if (!scheduleDate) {
        toast.error("اختر وقت الإرسال");
        return;
      }
      const scheduledTime = new Date(scheduleDate);
      const now = new Date();
      if (scheduledTime <= now) {
        toast.error("اختر وقت مستقبلي لإرسال الرسالة");
        return;
      }
    }

    // التحقق من الحد الأقصى اليومي
    const dailyCount = sessionStorage.getItem("dailyMessageCount");
    const count = dailyCount ? parseInt(dailyCount) : 0;
    
    let recipients: { phone: string; name?: string; contactId?: number }[] = [];

    if (sendSubTab === "individual") {
      if (!phone.trim()) {
        toast.error("اكتب رقم الهاتف");
        return;
      }
      recipients = [{ phone: phone.trim() }];
    } else if (sendSubTab === "group") {
      const lines = phones.split(/\n|,/).map((p) => p.trim()).filter((p) => p);
      if (lines.length === 0) {
        toast.error("أضف أرقام الهواتف");
        return;
      }
      recipients = lines.map((phone) => ({ phone }));
    } else if (sendSubTab === "contacts") {
      if (selectedContacts.length === 0) {
        toast.error("اختر جهات الاتصال");
        return;
      }
      const selected = contacts?.filter((c) => selectedContacts.includes(c.id)) ?? [];
      recipients = selected.map((c) => ({ phone: c.phone, name: c.name ?? undefined, contactId: c.id }));
    }

    if (count + recipients.length > maxDailyMessages) {
      toast.error(`تجاوز الحد الأقصى اليومي (${maxDailyMessages} رسالة)`);
      return;
    }

    setSending(true);
    await createMessage.mutateAsync({
      content: message,
      type: sendSubTab as "individual" | "group" | "contacts",
      scheduledAt: scheduleEnabled ? scheduleDate : undefined,
      delayMs: defaultDelay,
      mediaUrls: imagePreviews.length > 0 ? imagePreviews : undefined,
      recipients,
    });
    
    sessionStorage.setItem("dailyMessageCount", String(count + recipients.length));
    setSending(false);
    
    if (enableNotifications) {
      if (scheduleEnabled) {
        toast.success(`تم جدولة ${recipients.length} رسالة بنجاح`);
      } else {
        toast.success(`تم إرسال ${recipients.length} رسالة بنجاح`);
      }
    }
  };

  const filteredContacts = contacts?.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let validFiles = files.filter(f => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024);
    if (validFiles.length < files.length) {
      toast.warning("تم تجاهل بعض الملفات (حجم كبير أو ليست صور)");
    }

    const newPreviews: string[] = [];
    const newFiles: File[] = [];

    const promises = validFiles.map((file) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newPreviews.push(e.target.result as string);
            newFiles.push(file);
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(() => {
      setImageFiles(prev => [...prev, ...newFiles]);
      setImagePreviews(prev => [...prev, ...newPreviews]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const handleArImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let validFiles = files.filter(f => f.type.startsWith("image/") && f.size <= 5 * 1024 * 1024);
    if (validFiles.length < files.length) {
      toast.warning("تم تجاهل بعض الملفات (حجم كبير أو ليست صور)");
    }

    const newPreviews: string[] = [];
    const newFiles: File[] = [];

    const promises = validFiles.map((file) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newPreviews.push(e.target.result as string);
            newFiles.push(file);
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(() => {
      setArImageFiles(prev => [...prev, ...newFiles]);
      setArImagePreviews(prev => [...prev, ...newPreviews]);
      if (arFileInputRef.current) arFileInputRef.current.value = "";
    });
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        
        const newContacts = rows.map(row => {
          const parts = row.split(',');
          return {
            name: parts.length > 1 ? parts[0].trim() : undefined,
            phone: parts.length > 1 ? parts[1].trim() : parts[0].trim()
          };
        }).filter(c => c.phone);

        if (newContacts.length > 0) {
          await importContacts.mutateAsync(newContacts);
          if (csvInputRef.current) csvInputRef.current.value = "";
        }
      } catch (error) {
        toast.error("حدث خطأ أثناء قراءة الملف");
      }
    };
    reader.readAsText(file);
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeArImage = (index: number) => {
    setArImageFiles(prev => prev.filter((_, i) => i !== index));
    setArImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const loadSettings = () => {
    const saved = localStorage.getItem("appSettings");
    if (saved) {
      const settings = JSON.parse(saved);
      setAutoSave(settings.autoSave ?? true);
      setDarkMode(settings.darkMode ?? false);
      setMaxDailyMessages(settings.maxDailyMessages ?? 1000);
      setDefaultDelay(settings.defaultDelay ?? 2000);
      setEnableNotifications(settings.enableNotifications ?? true);
      setAutoDeleteOldMessages(settings.autoDeleteOldMessages ?? false);
      setDeleteOldAfterDays(settings.deleteOldAfterDays ?? 30);
    }
  };

  const saveSettings = () => {
    const settings = {
      autoSave,
      darkMode,
      maxDailyMessages,
      defaultDelay,
      enableNotifications,
      autoDeleteOldMessages,
      deleteOldAfterDays,
    };
    localStorage.setItem("appSettings", JSON.stringify(settings));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    toast.success("تم حفظ الإعدادات بنجاح");
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8]" dir="rtl">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Qlix</h1>
              <p className="text-xs text-emerald-600 font-bold tracking-wide">Developed by bnkhlid</p>
            </div>
            
            {/* حالة واتساب */}
            <div className="mr-6 flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50">
              {waSession?.status === "connected" ? (
                <>
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </div>
                  <span className="text-sm font-medium text-emerald-700">واتساب متصل ({waSession?.phone})</span>
                </>
              ) : waSession?.status === "connecting" ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-amber-400 animate-pulse"></div>
                  <span className="text-sm font-medium text-amber-600">بانتظار مسح الكود...</span>
                </>
              ) : (
                <>
                  <div className="h-3 w-3 rounded-full bg-gray-400"></div>
                  <span className="text-sm font-medium text-gray-600">غير متصل</span>
                </>
              )}
            </div>
            
            {/* QR Code Modal */}
            <Dialog open={waSession?.status === "connecting"}>
              <DialogContent className="sm:max-w-md text-center [&>button]:hidden">
                <DialogHeader>
                  <DialogTitle className="text-center text-xl font-bold text-emerald-700">امسح الكود لربط واتساب</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-6">
                  {qrData?.qrUrl ? (
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                      <img src={qrData.qrUrl} alt="WhatsApp QR Code" className="w-64 h-64" />
                    </div>
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-2xl">
                      <span className="text-gray-500 animate-pulse font-medium">جاري إنشاء الكود...</span>
                    </div>
                  )}
                  <p className="mt-6 text-sm text-gray-600 font-medium">
                    1. افتح تطبيق واتساب على هاتفك<br/>
                    2. اذهب إلى الأجهزة المرتبطة (Linked Devices)<br/>
                    3. امسح الكود أعلاه
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                refetchStats();
                refetchContacts();
                refetchScheduled();
                refetchHistory();
                refetchSession();
                toast.success("تم تحديث البيانات");
              }}
              className="rounded-xl text-gray-500 hover:text-emerald-600"
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                if (confirm("هل أنت متأكد من تسجيل الخروج من واتساب؟")) {
                  toast.info("جاري تسجيل الخروج...");
                  logoutWa.mutate();
                }
              }}
              disabled={logoutWa.isPending}
              className="rounded-xl text-gray-500 hover:text-gray-700"
            >
              <LogOut className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                loadSettings();
                setShowSettings(true);
              }}
              className="rounded-xl text-gray-500 hover:text-gray-700"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Ban className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-sm text-gray-500 font-medium">محظور</span>
              <span className="text-2xl font-bold text-red-600">{stats?.blocked ?? 0}</span>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <span className="text-sm text-gray-500 font-medium">مجدول</span>
              <span className="text-2xl font-bold text-amber-600">{stats?.scheduled ?? 0}</span>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <Send className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-sm text-gray-500 font-medium">تم الإرسال</span>
              <span className="text-2xl font-bold text-emerald-600">{stats?.sent ?? 0}</span>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-sm text-gray-500 font-medium">جهات الاتصال</span>
              <span className="text-2xl font-bold text-blue-600">{stats?.contacts ?? 0}</span>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-white rounded-2xl p-1 h-auto gap-1 shadow-sm border-0">
            <TabsTrigger
              value="send"
              className="flex-1 rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <Send className="w-4 h-4 ml-2" />
              إرسال رسائل
            </TabsTrigger>
            <TabsTrigger
              value="contacts"
              className="flex-1 rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <Users className="w-4 h-4 ml-2" />
              جهات الاتصال
            </TabsTrigger>
            <TabsTrigger
              value="scheduled"
              className="flex-1 rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <Clock className="w-4 h-4 ml-2" />
              المنبهات
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="flex-1 rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <RotateCcw className="w-4 h-4 ml-2" />
              السجل
            </TabsTrigger>
            <TabsTrigger
              value="autoResponder"
              className="flex-1 rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <MessageSquare className="w-4 h-4 ml-2" />
              الرد الآلي
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex-1 rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <RotateCcw className="w-4 h-4 ml-2" />
              التحليلات
            </TabsTrigger>
            <TabsTrigger
              value="blocked"
              className="flex-1 rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <ShieldAlert className="w-4 h-4 ml-2" />
              المحظورين
            </TabsTrigger>
          </TabsList>

          {/* Send Messages Tab */}
          <TabsContent value="send" className="mt-4">
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <Tabs value={sendSubTab} onValueChange={setSendSubTab}>
                  <TabsList className="bg-transparent border-b border-gray-100 w-full rounded-none p-0 h-auto gap-6 mb-6">
                    <TabsTrigger
                      value="individual"
                      className="rounded-none border-b-2 border-transparent pb-3 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none bg-transparent"
                    >
                      إرسال فردي
                    </TabsTrigger>
                    <TabsTrigger
                      value="group"
                      className="rounded-none border-b-2 border-transparent pb-3 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none bg-transparent"
                    >
                      إرسال جماعي
                    </TabsTrigger>
                    <TabsTrigger
                      value="contacts"
                      className="rounded-none border-b-2 border-transparent pb-3 data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none bg-transparent"
                    >
                      من جهات الاتصال
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="individual" className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="01xxxxxxxx"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="pl-10 text-left rounded-xl border-gray-200"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="group" className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">أرقام الهواتف (كل رقم في سطر)</label>
                      <Textarea
                        placeholder="01xxxxxxxxx
01xxxxxxxxx"
                        value={phones}
                        onChange={(e) => setPhones(e.target.value)}
                        className="min-h-[120px] rounded-xl border-gray-200 text-left"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="contacts" className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">اختر جهات الاتصال</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (filteredContacts && selectedContacts.length === filteredContacts.length) {
                              setSelectedContacts([]);
                            } else if (filteredContacts) {
                              setSelectedContacts(filteredContacts.map(c => c.id));
                            }
                          }}
                          className="h-8 text-xs text-emerald-600"
                        >
                          {filteredContacts && selectedContacts.length === filteredContacts.length ? (
                            <><Square className="w-3 h-3 ml-1" /> إلغاء التحديد</>
                          ) : (
                            <><CheckSquare className="w-3 h-3 ml-1" /> تحديد الكل</>
                          )}
                        </Button>
                      </div>
                      <ScrollArea className="h-[200px] rounded-xl border border-gray-200 p-3">
                        {filteredContacts && filteredContacts.length > 0 ? (
                          <div className="space-y-2">
                            {filteredContacts.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                                onClick={() => {
                                  setSelectedContacts((prev) =>
                                    prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                  );
                                }}
                              >
                                <Checkbox checked={selectedContacts.includes(c.id)} />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{c.name || "بدون اسم"}</p>
                                  <p className="text-xs text-gray-500">{c.phone}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-gray-400 py-8">لا توجد جهات اتصال</p>
                        )}
                      </ScrollArea>
                      {selectedContacts.length > 0 && (
                        <p className="text-xs text-emerald-600 font-medium mt-2">تم تحديد {selectedContacts.length} جهة اتصال</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Schedule */}
                <div className="mt-4 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-800">جدولة الإرسال</p>
                      <p className="text-xs text-gray-500">اختر وقت لإرسال الرسالة في المستقبل</p>
                    </div>
                    <Checkbox
                      checked={scheduleEnabled}
                      onCheckedChange={(c) => setScheduleEnabled(c === true)}
                    />
                  </div>
                  {scheduleEnabled && (
                    <div className="space-y-3">
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          type="datetime-local"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="pl-10 rounded-xl border-gray-200"
                          min={new Date().toISOString().slice(0, 16)}
                        />
                      </div>
                      {scheduleDate && (
                        <div className="text-xs text-amber-700 bg-white p-2 rounded-lg border border-amber-200">
                          سيتم إرسال الرسالة في: {new Date(scheduleDate).toLocaleString("ar-EG")}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Message Text */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">نص الرسالة</label>
                    <div className="flex gap-2 items-center">
                      <span className={`text-xs ${message.length > 1000 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                        {message.length} حرف
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                        className="h-6 text-xs px-2 text-emerald-600"
                      >
                        {showPreview ? <Eye className="w-3 h-3 ml-1" /> : <Eye className="w-3 h-3 ml-1" />}
                        {showPreview ? "إخفاء المعاينة" : "معاينة الرسالة"}
                      </Button>
                    </div>
                  </div>
                  
                  {showPreview && message ? (
                    <div className="mb-3 p-4 rounded-xl bg-[#e1ffd4] border border-[#d2f4c3] text-gray-800 whitespace-pre-wrap relative shadow-sm">
                      <div className="absolute top-2 right-2 text-xs text-gray-400">معاينة واتساب</div>
                      <p className="mt-2 text-sm">{message}</p>
                      <div className="text-right text-[10px] text-gray-500 mt-1">{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ) : null}

                  <Textarea
                    placeholder="اكتب رسالتك هنا..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[150px] rounded-xl border-gray-200 resize-y"
                  />
                  <p className="text-xs text-gray-400 mt-2 flex justify-between">
                    <span>
                      يمكنك استخدام المتغيرات:{" "}
                      <span className="text-emerald-600 font-mono bg-emerald-50 px-1 rounded">{`{name}`}</span>{" "}
                      <span className="text-emerald-600 font-mono bg-emerald-50 px-1 rounded">{`{phone}`}</span>
                    </span>
                  </p>
                </div>

                {/* Image Upload */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">إضافة صور (اختياري)</label>
                  <div className="flex flex-col gap-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">اضغط لاختيار صور أو اسحب الصور هنا</p>
                      <p className="text-xs text-gray-400 mt-1">الحد الأقصى 5 MB لكل صورة</p>
                    </div>
                    
                    {imagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {imagePreviews.map((preview, idx) => (
                          <div key={idx} className="relative inline-block border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <img
                              src={preview}
                              alt={`معاينة ${idx + 1}`}
                              className="h-24 w-24 object-cover"
                            />
                            <button
                              onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                              className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1 hover:bg-red-600 transition-colors backdrop-blur-sm"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1 rounded backdrop-blur-sm">
                              {idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Delay Slider */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">تأخير بين كل رسالة:</label>
                    <span className="text-sm font-bold text-emerald-600">{defaultDelay}ms</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-xs text-blue-700">يمكنك تغيير التأخير الافتراضي من الإعدادات</p>
                  </div>
                </div>

                {/* Send Button */}
                <Button
                  onClick={handleSend}
                  disabled={sending || createMessage.isPending}
                  className="w-full mt-6 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg"
                >
                  <Play className="w-5 h-5 ml-2" />
                  {sending || createMessage.isPending ? "جاري الإرسال..." : "بدء عملية الإرسال"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto Responder Tab */}
          <TabsContent value="autoResponder" className="mt-4">
            <Card className="border-0 shadow-sm bg-white rounded-2xl mb-6">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <Plus className="w-5 h-5 ml-2 text-emerald-500" />
                  إضافة رد آلي جديد
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">الكلمة المفتاحية</label>
                    <Input 
                      placeholder="مثال: السعر, تفاصيل" 
                      value={arKeyword}
                      onChange={(e) => setArKeyword(e.target.value)}
                      className="rounded-xl border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">طريقة التطابق</label>
                    <select
                      value={arMatchType}
                      onChange={(e) => setArMatchType(e.target.value as "exact" | "contains")}
                      className="w-full h-10 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                    >
                      <option value="exact">تطابق تام (الكلمة فقط)</option>
                      <option value="contains">تحتوي على (ضمن الجملة)</option>
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">نص الرد</label>
                  <Textarea 
                    placeholder="اكتب الرد هنا..." 
                    value={arResponse}
                    onChange={(e) => setArResponse(e.target.value)}
                    className="min-h-[100px] rounded-xl border-gray-200"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">صور مرفقة (اختياري)</label>
                  <div className="flex flex-col gap-3">
                    <div
                      onClick={() => arFileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <input
                        ref={arFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleArImageUpload}
                        className="hidden"
                      />
                      <ImageIcon className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">اضغط لإضافة صور</p>
                    </div>
                    {arImagePreviews.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {arImagePreviews.map((preview, idx) => (
                          <div key={idx} className="relative inline-block border border-gray-200 rounded-lg overflow-hidden">
                            <img src={preview} alt="preview" className="h-16 w-16 object-cover" />
                            <button
                              onClick={(e) => { e.stopPropagation(); removeArImage(idx); }}
                              className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (!arKeyword.trim() || !arResponse.trim()) {
                      toast.error("الرجاء إدخال الكلمة المفتاحية والرد");
                      return;
                    }
                    createAutoResponder.mutate({
                      keyword: arKeyword.trim(),
                      matchType: arMatchType,
                      response: arResponse.trim(),
                      mediaUrls: arImagePreviews.length > 0 ? arImagePreviews : undefined,
                    });
                  }}
                  disabled={createAutoResponder.isPending}
                  className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                >
                  حفظ الرد الآلي
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-800 mb-4">قائمة الردود الآلية</h3>
                <div className="space-y-3">
                  {autoResponders?.map((ar) => (
                    <div key={ar.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="bg-white border-emerald-200 text-emerald-700">
                            {ar.keyword}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            ({ar.matchType === "exact" ? "تطابق تام" : "تحتوي على"})
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-1">{ar.response}</p>
                        {ar.mediaUrls && ar.mediaUrls.length > 0 && (
                          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> {ar.mediaUrls.length} صور مرفقة
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 mr-4 bg-white p-2 rounded-lg border border-gray-200">
                          <span className="text-xs font-medium text-gray-500">مفعل</span>
                          <Checkbox
                            checked={ar.isActive}
                            onCheckedChange={(checked) => toggleAutoResponder.mutate({ id: ar.id, isActive: checked === true })}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAutoResponder.mutate({ id: ar.id })}
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!autoResponders || autoResponders.length === 0) && (
                    <p className="text-center text-gray-400 py-8">لا يوجد ردود آلية</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4 space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl text-white">
                <CardContent className="p-5">
                  <p className="text-emerald-100 text-sm font-medium mb-1">إجمالي المرسلة</p>
                  <p className="text-4xl font-black">{analytics?.totals.sent ?? 0}</p>
                  <p className="text-emerald-100 text-xs mt-1">رسالة وصلت بنجاح</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl text-white">
                <CardContent className="p-5">
                  <p className="text-blue-100 text-sm font-medium mb-1">نسبة النجاح</p>
                  <p className="text-4xl font-black">{analytics?.totals.successRate ?? 0}%</p>
                  <p className="text-blue-100 text-xs mt-1">من إجمالي محاولات الإرسال</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-red-500 to-red-600 rounded-2xl text-white">
                <CardContent className="p-5">
                  <p className="text-red-100 text-sm font-medium mb-1">فشل الإرسال</p>
                  <p className="text-4xl font-black">{analytics?.totals.failed ?? 0}</p>
                  <p className="text-red-100 text-xs mt-1">رسائل لم تصل</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl text-white">
                <CardContent className="p-5">
                  <p className="text-purple-100 text-sm font-medium mb-1">ردود آلية نشطة</p>
                  <p className="text-4xl font-black">{analytics?.totals.activeAutoResponders ?? 0}</p>
                  <p className="text-purple-100 text-xs mt-1">كلمة مفتاحية مفعلة</p>
                </CardContent>
              </Card>
            </div>

            {/* Area Chart - Daily Trends */}
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-800 mb-6 text-lg">ترند الرسائل - آخر 14 يوم</h3>
                {analytics?.daily && analytics.daily.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={analytics.daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                        formatter={(val: number, name: string) => [val, name === "sent" ? "وصلت" : "فشلت"]}
                      />
                      <Legend formatter={(v) => v === "sent" ? "وصلت" : "فشلت"} />
                      <Area type="monotone" dataKey="sent" stroke="#10b981" strokeWidth={2} fill="url(#sentGrad)" />
                      <Area type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} fill="url(#failedGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">
                    لا توجد بيانات كافية بعد — ابدأ بإرسال رسائل لتظهر البيانات
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              {/* Pie Chart - Status Breakdown */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-800 mb-6">توزيع حالة الرسائل</h3>
                  {analytics?.statusBreakdown && analytics.statusBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={analytics.statusBreakdown}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ status, percent }) =>
                            `${status === "sent" ? "وصلت" : status === "failed" ? "فشلت" : status === "pending" ? "معلقة" : status} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={true}
                        >
                          {analytics.statusBreakdown.map((entry, index) => {
                            const colors: Record<string, string> = {
                              sent: "#10b981",
                              failed: "#ef4444",
                              pending: "#f59e0b",
                              blocked: "#6b7280",
                              queued: "#3b82f6",
                            };
                            return <Cell key={index} fill={colors[entry.status] ?? "#94a3b8"} />;
                          })}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                          formatter={(val: number, name: string) => [val, name === "sent" ? "وصلت" : name === "failed" ? "فشلت" : name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">لا توجد بيانات</div>
                  )}
                </CardContent>
              </Card>

              {/* Bar Chart - Hourly Distribution */}
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-800 mb-6">أفضل أوقات الإرسال</h3>
                  {analytics?.hourly && analytics.hourly.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.hourly} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}:00`} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                          labelFormatter={(h) => `الساعة ${h}:00`}
                          formatter={(val: number) => [val, "رسائل"]}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">لا توجد بيانات</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Contact Growth Bar Chart */}
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <h3 className="font-bold text-gray-800 mb-6">نمو جهات الاتصال - آخر 6 أشهر</h3>
                {analytics?.contactGrowth && analytics.contactGrowth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.contactGrowth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                        formatter={(val: number) => [val, "جهة اتصال"]}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">لا توجد بيانات</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="mt-4">
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="بحث في جهات الاتصال..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 rounded-xl border-gray-200"
                    />
                  </div>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    ref={csvInputRef}
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => csvInputRef.current?.click()}
                    className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Upload className="w-4 h-4 ml-2" />
                    استيراد CSV
                  </Button>
                </div>

                {editingContact ? (
                  <div className="flex gap-3 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <Input
                      placeholder="الاسم"
                      value={editingContact.name}
                      onChange={(e) => setEditingContact({...editingContact, name: e.target.value})}
                      className="rounded-xl border-gray-200 bg-white"
                    />
                    <Input
                      placeholder="رقم الهاتف"
                      value={editingContact.phone}
                      onChange={(e) => setEditingContact({...editingContact, phone: e.target.value})}
                      className="rounded-xl border-gray-200 text-left bg-white"
                    />
                    <Button
                      onClick={() => {
                        if (!editingContact.phone.trim()) return;
                        updateContact.mutate(editingContact);
                      }}
                      className="rounded-xl bg-emerald-500 hover:bg-emerald-600"
                    >
                      حفظ التعديل
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setEditingContact(null)}
                      className="rounded-xl text-gray-500"
                    >
                      إلغاء
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Input
                      placeholder="الاسم"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="rounded-xl border-gray-200"
                    />
                    <Input
                      placeholder="رقم الهاتف"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="rounded-xl border-gray-200 text-left"
                    />
                    <Button
                      onClick={() => {
                        if (!contactPhone.trim()) return;
                        createContact.mutate({ name: contactName, phone: contactPhone });
                      }}
                      className="rounded-xl bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  {filteredContacts && filteredContacts.length > 0 ? (
                    <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                      {filteredContacts.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium">{c.name || "بدون اسم"}</p>
                            <p className="text-xs text-gray-500">{c.phone}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingContact({ id: c.id, name: c.name || "", phone: c.phone })}
                              className="text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteContact.mutate({ id: c.id })}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-400">لا توجد جهات اتصال</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scheduled Tab */}
          <TabsContent value="scheduled" className="mt-4">
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">الرسائل المجدولة</h3>
                {scheduledMessages && scheduledMessages.length > 0 ? (
                  <div className="space-y-3">
                    {scheduledMessages.map((msg) => {
                      const scheduledTime = msg.scheduledAt ? new Date(msg.scheduledAt) : null;
                      const now = new Date();
                      const timeRemaining = scheduledTime ? Math.floor((scheduledTime.getTime() - now.getTime()) / 1000) : 0;
                      const hours = Math.floor(timeRemaining / 3600);
                      const minutes = Math.floor((timeRemaining % 3600) / 60);
                      const seconds = timeRemaining % 60;
                      
                      return (
                        <div key={msg.id} className="flex items-center justify-between p-4 rounded-xl border border-amber-100 hover:border-amber-300 bg-amber-50/30 transition-colors">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{msg.name || `رسالة #${msg.id}`}</p>
                            <p className="text-xs text-gray-600 mt-1">{msg.content.substring(0, 70)}...</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <Badge className="bg-amber-100 text-amber-800 border-0">
                                <Calendar className="w-3 h-3 ml-1" />
                                {scheduledTime?.toLocaleString("ar-EG")}
                              </Badge>
                              {timeRemaining > 0 ? (
                                <Badge className="bg-blue-100 text-blue-800 border-0">
                                  متبقي: {hours > 0 ? `${hours}س ` : ''}{minutes}د {seconds}ث
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800 border-0">
                                  جاهز للإرسال
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMessage.mutate({ id: msg.id })}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400">لا توجد رسائل مجدولة</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="mt-4">
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">سجل الرسائل</h3>
                  {historyMessages && historyMessages.length > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => {
                        if (confirm("هل أنت متأكد من مسح جميع سجلات الرسائل؟ لا يمكن التراجع عن هذا الإجراء.")) {
                          clearHistory.mutate();
                        }
                      }}
                      disabled={clearHistory.isPending}
                      className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-0 shadow-none"
                    >
                      <Trash2 className="w-4 h-4 ml-2" />
                      مسح السجل بالكامل
                    </Button>
                  )}
                </div>
                {historyMessages && historyMessages.length > 0 ? (
                  <div className="space-y-3">
                    {historyMessages.map((msg) => (
                      <div key={msg.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100">
                        <div>
                          <p className="text-sm font-medium">{msg.name || `رسالة #${msg.id}`}</p>
                          <p className="text-xs text-gray-500 mt-1">{msg.content.substring(0, 60)}...</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant="outline"
                              className={
                                msg.status === "completed"
                                  ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                                  : "text-red-600 border-red-200 bg-red-50"
                              }
                            >
                              {msg.status === "completed" ? (
                                <CheckCircle2 className="w-3 h-3 ml-1" />
                              ) : (
                                <AlertCircle className="w-3 h-3 ml-1" />
                              )}
                              {msg.status === "completed" ? "تم بنجاح" : "فشل"}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleString("ar-EG") : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400">لا يوجد سجل</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* Blocked Numbers Tab */}
          <TabsContent value="blocked" className="mt-4">
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">الأرقام المحظورة</h3>
                    <p className="text-xs text-gray-500">الأرقام التي لن يتم إرسال أي رسائل إليها</p>
                  </div>
                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                    <Ban className="w-3 h-3 ml-1" />
                    {blockedNumbers?.length || 0} أرقام
                  </Badge>
                </div>

                <div className="flex gap-3">
                  <Input
                    placeholder="رقم الهاتف للحظر"
                    value={newBlockPhone}
                    onChange={(e) => setNewBlockPhone(e.target.value)}
                    className="rounded-xl border-gray-200 text-left"
                  />
                  <Input
                    placeholder="السبب (اختياري)"
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                    className="rounded-xl border-gray-200"
                  />
                  <Button
                    onClick={() => {
                      if (!newBlockPhone.trim()) return;
                      blockNumber.mutate({ phone: newBlockPhone, reason: newBlockReason });
                    }}
                    className="rounded-xl bg-red-500 hover:bg-red-600"
                  >
                    <Ban className="w-4 h-4 ml-2" />
                    حظر
                  </Button>
                </div>

                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="بحث في الأرقام المحظورة..."
                    value={blockedSearchQuery}
                    onChange={(e) => setBlockedSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl border-gray-200"
                  />
                </div>

                <div className="rounded-xl border border-gray-200 overflow-hidden mt-4">
                  {blockedNumbers && blockedNumbers.filter(b => b.phone.includes(blockedSearchQuery)).length > 0 ? (
                    <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                      {blockedNumbers
                        .filter(b => b.phone.includes(blockedSearchQuery))
                        .map((b) => (
                        <div key={b.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                          <div>
                            <p className="text-sm font-medium font-mono text-gray-800">{b.phone}</p>
                            {b.reason && <p className="text-xs text-red-500 mt-1">{b.reason}</p>}
                            <p className="text-[10px] text-gray-400 mt-1">
                              محظور منذ: {b.createdAt ? new Date(b.createdAt).toLocaleDateString("ar-EG") : ""}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unblockNumber.mutate({ phone: b.phone })}
                            className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 text-xs"
                          >
                            <ShieldCheck className="w-3 h-3 ml-1" />
                            رفع الحظر
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <ShieldCheck className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                      <p className="text-gray-400">لا توجد أرقام محظورة</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right text-xl">إعدادات النظام</DialogTitle>
          </DialogHeader>

          <Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-100 rounded-xl p-1">
              <TabsTrigger value="general" className="rounded-lg text-xs sm:text-sm">عام</TabsTrigger>
              <TabsTrigger value="messages" className="rounded-lg text-xs sm:text-sm">الرسائل</TabsTrigger>
              <TabsTrigger value="advanced" className="rounded-lg text-xs sm:text-sm">متقدم</TabsTrigger>
              <TabsTrigger value="system" className="rounded-lg text-xs sm:text-sm">النظام</TabsTrigger>
            </TabsList>

            {/* General Settings Tab */}
            <TabsContent value="general" className="space-y-4 mt-4 text-right">
              <div className="space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center justify-end gap-2">
                  <span>المظهر</span>
                  <RotateCcw className="w-4 h-4" />
                </h3>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <Checkbox
                    checked={darkMode}
                    onCheckedChange={(c) => setDarkMode(c === true)}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">الوضع الليلي</p>
                    <p className="text-xs text-gray-500">تفعيل المظهر الغامق</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Messages Settings Tab */}
            <TabsContent value="messages" className="space-y-4 mt-4 text-right">
              <div className="space-y-3 border-b pb-4">
                <h3 className="font-bold text-gray-800 flex items-center justify-end gap-2">
                  <span>التأخير والسرعة</span>
                  <Clock className="w-4 h-4" />
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    التأخير الافتراضي بين الرسائل: {defaultDelay}ms
                  </label>
                  <Slider
                    value={[defaultDelay]}
                    onValueChange={(val) => setDefaultDelay(val[0])}
                    min={500}
                    max={10000}
                    step={500}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-2">الفاصل الزمني بين كل رسالة (بالميلي ثانية)</p>
                </div>
              </div>

              <div className="space-y-3 border-b pb-4">
                <h3 className="font-bold text-gray-800 flex items-center justify-end gap-2">
                  <span>الحد الأقصى اليومي</span>
                  <AlertCircle className="w-4 h-4" />
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    أقصى عدد رسائل يومية: {maxDailyMessages}
                  </label>
                  <Input
                    type="number"
                    min="100"
                    max="10000"
                    step="100"
                    value={maxDailyMessages}
                    onChange={(e) => setMaxDailyMessages(parseInt(e.target.value))}
                    className="rounded-xl border-gray-200"
                  />
                  <p className="text-xs text-gray-500 mt-2">سيتم إيقاف الإرسال عند الوصول للحد الأقصى</p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center justify-end gap-2">
                  <span>الإشعارات</span>
                  <Send className="w-4 h-4" />
                </h3>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <Checkbox
                    checked={enableNotifications}
                    onCheckedChange={(c) => setEnableNotifications(c === true)}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">تفعيل الإشعارات</p>
                    <p className="text-xs text-gray-500">إخطار عند اكتمال الإرسال</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Advanced Settings Tab */}
            <TabsContent value="advanced" className="space-y-4 mt-4 text-right">
              <div className="space-y-3 border-b pb-4">
                <h3 className="font-bold text-gray-800 flex items-center justify-end gap-2">
                  <span>الحفظ التلقائي</span>
                  <RotateCcw className="w-4 h-4" />
                </h3>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <Checkbox
                    checked={autoSave}
                    onCheckedChange={(c) => setAutoSave(c === true)}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">حفظ تلقائي للمسودات</p>
                    <p className="text-xs text-gray-500">حفظ الرسائل غير المرسلة تلقائياً</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-b pb-4">
                <h3 className="font-bold text-gray-800 flex items-center justify-end gap-2">
                  <span>حذف الرسائل القديمة</span>
                  <Trash2 className="w-4 h-4" />
                </h3>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-3">
                  <Checkbox
                    checked={autoDeleteOldMessages}
                    onCheckedChange={(c) => setAutoDeleteOldMessages(c === true)}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">تفعيل الحذف التلقائي</p>
                    <p className="text-xs text-gray-500">حذف الرسائل القديمة تلقائياً</p>
                  </div>
                </div>
                {autoDeleteOldMessages && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      حذف الرسائل بعد: {deleteOldAfterDays} أيام
                    </label>
                    <Slider
                      value={[deleteOldAfterDays]}
                      onValueChange={(val) => setDeleteOldAfterDays(val[0])}
                      min={7}
                      max={365}
                      step={1}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* System Settings Tab */}
            <TabsContent value="system" className="space-y-4 mt-4 text-right">
              <div className="space-y-3 border-b pb-4">
                <h3 className="font-bold text-gray-800 flex items-center justify-end gap-2">
                  <span>معلومات النظام</span>
                  <Users className="w-4 h-4" />
                </h3>
                <div className="bg-gray-50 p-3 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">الإصدار:</span>
                    <span className="font-medium text-gray-900">v1.0.0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">المتصفح:</span>
                    <span className="font-medium text-gray-900">{navigator.userAgent.split("/").pop()?.slice(0, 20)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">التخزين المستخدم:</span>
                    <span className="font-medium text-gray-900">{((localStorage.length * 100) / 5242880 * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-b pb-4">
                <h3 className="font-bold text-gray-800 flex items-center justify-end gap-2">
                  <span>الخيارات المتقدمة</span>
                  <RotateCcw className="w-4 h-4" />
                </h3>
                <Button
                  onClick={() => {
                    localStorage.clear();
                    toast.success("تم مسح جميع البيانات");
                    setShowSettings(false);
                  }}
                  variant="outline"
                  className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  مسح جميع البيانات المحفوظة
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex gap-2 justify-end mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowSettings(false)}
              className="rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              onClick={saveSettings}
              className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              حفظ الإعدادات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
