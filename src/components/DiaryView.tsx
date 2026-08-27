import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Smile,
  Image as ImageIcon,
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  Wind,
  Trash2,
  Edit3,
  X,
  Upload,
  Move,
  RotateCw,
  Maximize2,
  Sparkles,
  Heart,
  Palette,
  Wallet,
  Receipt,
  CreditCard,
  Check,
  Star,
  Calendar
} from 'lucide-react';
import { DiaryEntry, EmotionTag, EmotionType, StickerPlacement, UserCustomSticker, FinancialEntry } from '../types';

interface DiaryViewProps {
  diaries: DiaryEntry[];
  setDiaries: React.Dispatch<React.SetStateAction<DiaryEntry[]>>;
  selectedDate: string;
  userStickers: UserCustomSticker[];
  setUserStickers: React.Dispatch<React.SetStateAction<UserCustomSticker[]>>;
  presetStickers: { id: string; name: string; imageUrl: string; type: string }[];
  financials?: FinancialEntry[];
  setFinancials?: React.Dispatch<React.SetStateAction<FinancialEntry[]>>;
  onSyncGoogleCalendar?: (updatedDiaries?: DiaryEntry[]) => void;
}

export const DiaryView: React.FC<DiaryViewProps> = ({
  diaries,
  setDiaries,
  selectedDate,
  userStickers,
  setUserStickers,
  presetStickers,
  financials = [],
  setFinancials,
  onSyncGoogleCalendar,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingDiary, setEditingDiary] = useState<DiaryEntry | null>(null);

  // Form states
  const [date, setDate] = useState(selectedDate);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy'>('sunny');
  const [images, setImages] = useState<string[]>([]);
  const [selectedEmotions, setSelectedEmotions] = useState<EmotionTag[]>([
    { type: 'joy', label: '기쁨', emoji: '😃', color: '#FBBF24', intensity: 5 },
  ]);
  const [placedStickers, setPlacedStickers] = useState<StickerPlacement[]>([]);
  const [syncToGoogleCalendar, setSyncToGoogleCalendar] = useState<boolean>(true);

  // Active sticker being adjusted on canvas
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);

  // Sticker Canvas Drag & Drop States
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingStickerId, setDraggingStickerId] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialStickerX: number; initialStickerY: number } | null>(null);

  // Handle Dragging Sticker across canvas with Mouse/Touch
  useEffect(() => {
    if (!draggingStickerId) return;

    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!canvasRef.current || !dragStartRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const deltaPercentX = (deltaX / rect.width) * 100;
      const deltaPercentY = (deltaY / rect.height) * 100;

      let newX = dragStartRef.current.initialStickerX + deltaPercentX;
      let newY = dragStartRef.current.initialStickerY + deltaPercentY;

      // Bound within canvas (5% ~ 95%)
      newX = Math.max(5, Math.min(95, newX));
      newY = Math.max(5, Math.min(95, newY));

      setPlacedStickers((prev) =>
        prev.map((s) => (s.id === draggingStickerId ? { ...s, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 } : s))
      );
    };

    const onMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onPointerUp = () => {
      setDraggingStickerId(null);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onPointerUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [draggingStickerId]);

  const handleStickerPointerDown = (e: React.MouseEvent | React.TouchEvent, stk: StickerPlacement) => {
    e.stopPropagation();
    setActiveStickerId(stk.id);
    setDraggingStickerId(stk.id);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialStickerX: stk.x,
      initialStickerY: stk.y,
    };
  };

  // Available Emotion preset tags
  const emotionOptions: { type: EmotionType; label: string; emoji: string; color: string }[] = [
    { type: 'joy', label: '기쁨', emoji: '😃', color: '#FBBF24' },
    { type: 'calm', label: '평온', emoji: '😌', color: '#34D399' },
    { type: 'excited', label: '설렘', emoji: '🥳', color: '#F472B6' },
    { type: 'sad', label: '우울', emoji: '🥺', color: '#60A5FA' },
    { type: 'angry', label: '답답/분노', emoji: '😠', color: '#F87171' },
    { type: 'tired', label: '피곤', emoji: '😴', color: '#9CA3AF' },
    { type: 'inspired', label: '영감', emoji: '💡', color: '#818CF8' },
    { type: 'love', label: '사랑', emoji: '💖', color: '#FB7185' },
  ];

  // Financial records for selected date in editor
  const todayFinancials = financials.filter((f) => f.date === date);
  const todayExpense = todayFinancials
    .filter((f) => f.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);
  const todayIncome = todayFinancials
    .filter((f) => f.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Import financial summary into diary text
  const handleImportFinancialSummary = () => {
    if (todayFinancials.length === 0) return;
    let summaryText = `\n\n[💰 ${date} 가계부 내역 요약]\n`;
    if (todayExpense > 0) summaryText += `• 총 지출: -${todayExpense.toLocaleString()}원\n`;
    if (todayIncome > 0) summaryText += `• 총 수입: +${todayIncome.toLocaleString()}원\n`;
    summaryText += `상세 내역:\n`;
    todayFinancials.forEach((f) => {
      summaryText += `- [${f.category}] ${f.memo ? `${f.memo} ` : ''}${f.type === 'expense' ? '-' : '+'}${f.amount.toLocaleString()}원 (${f.paymentMethod === 'card' ? '카드' : f.paymentMethod === 'cash' ? '현금' : '계좌이체'})\n`;
    });

    setContent((prev) => prev + summaryText);
  };

  // Save photo to User Custom Stickers / Gallery
  const handleSaveImageToUserStickers = (imgUrl: string) => {
    const newSticker: UserCustomSticker = {
      id: `usr_stk_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: `다이어리 스티커 (${date})`,
      imageUrl: imgUrl,
      createdAt: new Date().toISOString(),
    };
    setUserStickers((prev) => [newSticker, ...prev]);
    alert('⭐ 이 사진이 내 갤러리 스티커 보관함에 성공적으로 저장되었습니다!');
  };

  const handleOpenAdd = () => {
    setEditingDiary(null);
    setDate(selectedDate);
    setTitle('');
    setContent('');
    setWeather('sunny');
    setImages([]);
    setSelectedEmotions([{ type: 'joy', label: '기쁨', emoji: '😃', color: '#FBBF24', intensity: 5 }]);
    setPlacedStickers([]);
    setSyncToGoogleCalendar(true);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (entry: DiaryEntry) => {
    setEditingDiary(entry);
    setDate(entry.date);
    setTitle(entry.title);
    setContent(entry.content);
    setWeather(entry.weather || 'sunny');
    setImages(entry.images || []);
    setSelectedEmotions(entry.emotions || []);
    setPlacedStickers(entry.stickers || []);
    setSyncToGoogleCalendar(entry.syncToGoogleCalendar !== false);
    setIsEditorOpen(true);
  };

  const handleToggleEmotion = (option: { type: EmotionType; label: string; emoji: string; color: string }) => {
    const exists = selectedEmotions.find((e) => e.type === option.type);
    if (exists) {
      setSelectedEmotions(selectedEmotions.filter((e) => e.type !== option.type));
    } else {
      setSelectedEmotions([...selectedEmotions, { ...option, intensity: 4 }]);
    }
  };

  // Upload Photo to Diary Images
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files) as File[];
      filesArray.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setImages((prev) => [...prev, ev.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Upload Custom Photo as Sticker from Gallery!
  const handleCustomStickerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const newUrl = ev.target.result as string;
          const newStickerObj: UserCustomSticker = {
            id: `usr_stk_${Date.now()}`,
            name: file.name.split('.')[0] || '내 갤러리 스티커',
            imageUrl: newUrl,
            createdAt: new Date().toISOString(),
          };
          setUserStickers((prev) => [newStickerObj, ...prev]);

          // Automatically place it on active canvas
          addStickerToCanvas(newUrl, true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Place a sticker on the canvas
  const addStickerToCanvas = (imageUrl: string, isCustom = false) => {
    const newSticker: StickerPlacement = {
      id: `stk_place_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      imageUrl,
      x: 30 + Math.random() * 40, // percentage
      y: 20 + Math.random() * 40,
      scale: 1,
      rotation: Math.floor(Math.random() * 20) - 10,
      zIndex: placedStickers.length + 1,
      isCustom,
    };
    setPlacedStickers((prev) => [...prev, newSticker]);
    setActiveStickerId(newSticker.id);
  };

  // Adjust sticker position/scale
  const updateSticker = (id: string, updates: Partial<StickerPlacement>) => {
    setPlacedStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const removeSticker = (id: string) => {
    setPlacedStickers((prev) => prev.filter((s) => s.id !== id));
    if (activeStickerId === id) setActiveStickerId(null);
  };

  // Save Diary
  const handleSaveDiary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    let updatedList: DiaryEntry[] = [];

    if (editingDiary) {
      const updated: DiaryEntry = {
        ...editingDiary,
        date,
        title,
        content,
        weather,
        emotions: selectedEmotions,
        images,
        stickers: placedStickers,
        syncToGoogleCalendar,
        updatedAt: new Date().toISOString(),
      };
      updatedList = diaries.map((d) => (d.id === editingDiary.id ? updated : d));
      setDiaries(updatedList);
    } else {
      const newEntry: DiaryEntry = {
        id: `diary_${Date.now()}`,
        date,
        title,
        content,
        weather,
        emotions: selectedEmotions,
        images,
        stickers: placedStickers,
        syncToGoogleCalendar,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedList = [newEntry, ...diaries];
      setDiaries(updatedList);
    }

    setIsEditorOpen(false);

    // Auto-trigger Google Calendar sync if callback provided
    if (onSyncGoogleCalendar) {
      setTimeout(() => {
        onSyncGoogleCalendar(updatedList);
      }, 50);
    }
  };

  const deleteDiary = (id: string) => {
    if (confirm('이 다이어리 기록을 삭제하시겠습니까?')) {
      const remaining = diaries.filter((d) => d.id !== id);
      setDiaries(remaining);
      if (onSyncGoogleCalendar) {
        setTimeout(() => {
          onSyncGoogleCalendar(remaining);
        }, 50);
      }
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 rounded-2xl p-5 border border-rose-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center space-x-2 justify-center sm:justify-start">
            <BookOpen className="w-6 h-6 text-rose-500" />
            <h2 className="text-xl font-extrabold text-stone-800">감정 일기 & 갤러리 스티커 다이어리</h2>
          </div>
          <p className="text-xs text-stone-600">
            오늘의 사진, 감정 태그, 내 갤러리 이미지 스티커로 나만의 특색 있는 다이어리를 꾸며보세요.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-2 bg-rose-500 hover:bg-rose-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>오늘 다이어리 쓰기</span>
        </button>
      </div>

      {/* Diary Entries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {diaries.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-stone-200">
            <BookOpen className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-stone-600 font-bold">아직 다이어리 기록이 없습니다.</p>
            <p className="text-stone-400 text-xs mt-1">상단 버튼을 눌러 소중한 순간과 감정을 기록해보세요.</p>
          </div>
        ) : (
          diaries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-2xl p-6 shadow-2xs border border-stone-200/80 hover:shadow-md transition-all relative group overflow-hidden"
            >
              {/* Header Info */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-3">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    {entry.date}
                  </span>
                  {entry.weather === 'sunny' && <Sun className="w-4 h-4 text-amber-500" title="맑음" />}
                  {entry.weather === 'cloudy' && <Cloud className="w-4 h-4 text-stone-400" title="흐림" />}
                  {entry.weather === 'rainy' && <CloudRain className="w-4 h-4 text-blue-500" title="비" />}
                  {entry.weather === 'snowy' && <Snowflake className="w-4 h-4 text-sky-400" title="눈" />}
                  {entry.weather === 'windy' && <Wind className="w-4 h-4 text-teal-500" title="바람" />}
                  {entry.syncToGoogleCalendar !== false && (
                    <span
                      title={entry.isGoogleCalendarSynced ? '구글 캘린더 동기화 완료' : '구글 캘린더 연동 설정됨'}
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        entry.isGoogleCalendarSynced
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      <span>{entry.isGoogleCalendarSynced ? '캘린더 동기화됨' : '캘린더 연동'}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEdit(entry)}
                    className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-800 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteDiary(entry.id)}
                    className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Emotions */}
              <h3 className="font-extrabold text-stone-800 text-lg mb-2">{entry.title}</h3>

              {/* Emotions Badges */}
              {entry.emotions && entry.emotions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {entry.emotions.map((emo, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border shadow-2xs"
                      style={{ backgroundColor: `${emo.color}20`, borderColor: emo.color, color: emo.color }}
                    >
                      <span>{emo.emoji}</span>
                      <span>{emo.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Entry Content Text */}
              <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap mb-4 font-normal">
                {entry.content}
              </p>

              {/* Photos Gallery */}
              {entry.images && entry.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 my-3">
                  {entry.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt="일기 사진"
                      className="w-full h-32 object-cover rounded-xl border border-stone-200 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(img, '_blank')}
                    />
                  ))}
                </div>
              )}

              {/* Display Placed Decorator Stickers preview */}
              {entry.stickers && entry.stickers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center space-x-2">
                  <span className="text-[11px] font-bold text-stone-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> 꾸민 스티커 ({entry.stickers.length}개)
                  </span>
                  <div className="flex gap-1 overflow-x-auto no-scrollbar">
                    {entry.stickers.map((stk, i) => (
                      <span key={i} className="text-sm bg-stone-100 px-1.5 py-0.5 rounded-md">
                        {stk.imageUrl.startsWith('data:') || stk.imageUrl.startsWith('http') ? (
                          <img src={stk.imageUrl} className="w-5 h-5 object-cover rounded-xs inline" />
                        ) : (
                          stk.imageUrl
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* DIARY EDITOR & STICKER CANVAS MODAL */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 flex-none">
              <div>
                <h3 className="font-extrabold text-stone-800 text-xl flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-rose-500" />
                  {editingDiary ? '다이어리 일기 수정' : '오늘의 감정 다이어리 작성'}
                </h3>
                <p className="text-xs text-stone-500">일기 내용 및 갤러리 스티커 배치</p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content Form & Sticker Decorator Workspace */}
            <form onSubmit={handleSaveDiary} className="space-y-4 text-sm flex-1 overflow-y-auto pr-1">
              {/* Date & Weather Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">일기 날짜</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">오늘의 날씨</label>
                  <div className="flex items-center space-x-2">
                    {[
                      { id: 'sunny', icon: Sun, label: '맑음' },
                      { id: 'cloudy', icon: Cloud, label: '흐림' },
                      { id: 'rainy', icon: CloudRain, label: '비' },
                      { id: 'snowy', icon: Snowflake, label: '눈' },
                      { id: 'windy', icon: Wind, label: '바람' },
                    ].map((w) => {
                      const Icon = w.icon;
                      const isSel = weather === w.id;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setWeather(w.id as any)}
                          className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                            isSel
                              ? 'bg-rose-100 border-rose-400 text-rose-700 scale-105 shadow-2xs'
                              : 'bg-stone-50 border-stone-200 text-stone-500'
                          }`}
                          title={w.label}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Google Calendar Selective Sync Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/90 shadow-2xs">
                <div className="flex items-center space-x-2.5">
                  <Calendar className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-xs font-extrabold text-stone-800">구글 캘린더 연동 (선택 연동)</p>
                    <p className="text-[11px] text-stone-500">
                      체크 시 이 다이어리가 구글 캘린더 일정으로 자동 등록 및 동기화됩니다.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                  <input
                    type="checkbox"
                    checked={syncToGoogleCalendar}
                    onChange={(e) => setSyncToGoogleCalendar(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                </label>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">일기 제목 *</label>
                <input
                  type="text"
                  required
                  placeholder="오늘 하루를 한 문장으로 나타낸다면?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-400 font-bold text-base"
                />
              </div>

              {/* Emotion Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">오늘의 감정 태그 (복수 선택 가능)</label>
                <div className="flex flex-wrap gap-2">
                  {emotionOptions.map((opt) => {
                    const isSelected = selectedEmotions.some((e) => e.type === opt.type);
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => handleToggleEmotion(opt)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          isSelected
                            ? 'scale-105 shadow-2xs ring-1 ring-amber-300'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                        style={{
                          backgroundColor: isSelected ? `${opt.color}25` : undefined,
                          borderColor: isSelected ? opt.color : undefined,
                          color: isSelected ? opt.color : undefined,
                        }}
                      >
                        <span>{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Financial Records Linked Card */}
              <div className="bg-gradient-to-r from-amber-50/80 to-emerald-50/80 rounded-2xl p-4 border border-amber-200/80 space-y-2 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/50 pb-2">
                  <div className="flex items-center space-x-2">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    <h4 className="font-extrabold text-stone-800 text-xs">
                      {date} 가계부 내역 ({todayFinancials.length}건 연동됨)
                    </h4>
                  </div>
                  {todayFinancials.length > 0 && (
                    <button
                      type="button"
                      onClick={handleImportFinancialSummary}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1 shadow-2xs transition-all"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>가계부 요약 일기에 불러오기</span>
                    </button>
                  )}
                </div>

                {todayFinancials.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center space-x-3 text-xs font-bold text-stone-700">
                      {todayExpense > 0 && <span className="text-rose-600">지출 -{todayExpense.toLocaleString()}원</span>}
                      {todayIncome > 0 && <span className="text-emerald-600">수입 +{todayIncome.toLocaleString()}원</span>}
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {todayFinancials.map((f) => (
                        <div key={f.id} className="flex-none bg-white px-2.5 py-1.5 rounded-xl border border-stone-200 text-[11px] space-y-0.5">
                          <div className="flex items-center space-x-1 font-bold text-stone-800">
                            <span className="px-1.5 py-0.2 bg-stone-100 rounded text-[9px] text-stone-600">{f.category}</span>
                            <span>{f.type === 'expense' ? '-' : '+'}{f.amount.toLocaleString()}원</span>
                          </div>
                          {f.memo && <p className="text-[10px] text-stone-500 truncate max-w-[120px]">{f.memo}</p>}
                          {f.receiptImage && (
                            <button
                              type="button"
                              onClick={() => {
                                setImages((prev) => [...prev, f.receiptImage!]);
                                addStickerToCanvas(f.receiptImage!, true);
                              }}
                              className="text-[9px] text-amber-700 font-bold underline hover:text-amber-900"
                            >
                              영수증 사진 스티커/본문 첨부
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-500 italic">
                    {date}에 기록된 가계부 지출/수입 내역이 없습니다. (가계부 탭에서 지출을 기록해 보세요!)
                  </p>
                )}
              </div>

              {/* Content Text */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">일기 본문 *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="오늘 일어난 이벤트, 느낌, 감사했던 일을 자유롭게 기록하세요..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-rose-400 leading-relaxed"
                />
              </div>

              {/* Photo Upload Attachment */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">일기 본문 사진 첨부</label>
                <div className="flex items-center space-x-2">
                  <label className="cursor-pointer flex items-center space-x-1 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-xl text-xs font-semibold border border-stone-200 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>갤러리 사진 불러오기</span>
                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  </label>
                  <span className="text-xs text-stone-400">{images.length}장 선택됨</span>
                </div>

                {images.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 overflow-x-auto p-1">
                    {images.map((img, i) => (
                      <div key={i} className="relative flex-none group">
                        <img src={img} className="w-20 h-20 object-cover rounded-xl border border-stone-200" />
                        <button
                          type="button"
                          onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 shadow-xs"
                          title="삭제"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveImageToUserStickers(img)}
                          className="absolute bottom-1 right-1 bg-amber-400 text-stone-900 rounded-lg p-1 text-[9px] font-bold shadow-xs flex items-center space-x-0.5 opacity-90 hover:opacity-100"
                          title="내 갤러리 스티커 보관함에 저장"
                        >
                          <Star className="w-3 h-3 fill-stone-900" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 🎨 STICKER DECORATOR CANVAS STUDIO */}
              <div className="border border-amber-200 bg-amber-50/40 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                  <div>
                    <h4 className="font-extrabold text-stone-800 text-sm flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      내 갤러리 이미지 스티커 꾸미기 캔버스
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      스티커를 선택하거나 갤러리 사진을 불러와 스티커로 올려 자유롭게 배치해보세요.
                    </p>
                  </div>

                  {/* Upload Custom Sticker Button */}
                  <label className="cursor-pointer flex items-center justify-center space-x-1.5 bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>내 갤러리에서 스티커 불러오기</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomStickerUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Available Sticker Palette Tray */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-stone-600">스티커 팔레트 (클릭하여 캔버스에 추가):</p>
                  <div className="flex items-center gap-2 overflow-x-auto p-2 bg-white rounded-xl border border-stone-200 no-scrollbar">
                    {/* User imported stickers */}
                    {userStickers.map((stk) => (
                      <button
                        key={stk.id}
                        type="button"
                        onClick={() => addStickerToCanvas(stk.imageUrl, true)}
                        className="flex-none p-1 rounded-lg border border-rose-300 hover:border-rose-500 bg-rose-50/50 hover:scale-105 transition-transform flex items-center gap-1"
                        title={stk.name}
                      >
                        <img src={stk.imageUrl} className="w-8 h-8 object-cover rounded-md" />
                        <span className="text-[9px] font-bold text-rose-700 max-w-[50px] truncate">{stk.name}</span>
                      </button>
                    ))}

                    {/* Presets */}
                    {presetStickers.map((stk, idx) => {
                      const isObj = typeof stk === 'object' && stk !== null;
                      const imgUrl = isObj ? stk.imageUrl : String(stk);
                      const id = isObj ? stk.id : `preset_${idx}`;

                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => addStickerToCanvas(imgUrl)}
                          className="flex-none p-1.5 rounded-lg border border-stone-200 hover:border-amber-400 bg-stone-50 hover:scale-105 transition-transform text-lg"
                        >
                          {imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('data:')) ? (
                            <img src={imgUrl} className="w-8 h-8 object-cover rounded-md" />
                          ) : (
                            imgUrl
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Interactive Decorator Paper Canvas */}
                <div
                  ref={canvasRef}
                  className="relative w-full h-72 bg-stone-100/90 rounded-2xl border border-stone-300 overflow-hidden shadow-inner flex items-center justify-center touch-none select-none"
                >
                  <div className="absolute top-2 left-3 text-[10px] font-bold text-stone-400 pointer-events-none flex items-center gap-1">
                    <Move className="w-3 h-3 text-amber-500" />
                    <span>📄 스티커 꾸미기 영역 (마우스/손가락으로 드래그하여 이동 가능)</span>
                  </div>

                  {placedStickers.length === 0 && (
                    <p className="text-xs text-stone-400 italic pointer-events-none text-center px-4">
                      위 팔레트에서 스티커를 클릭하거나 갤러리 사진을 업로드하여 이곳에 올린 후 드래그하여 이동해보세요!
                    </p>
                  )}

                  {/* Render Placed Stickers */}
                  {placedStickers.map((stk) => {
                    const isActive = activeStickerId === stk.id;
                    const isDragging = draggingStickerId === stk.id;

                    return (
                      <div
                        key={stk.id}
                        onMouseDown={(e) => handleStickerPointerDown(e, stk)}
                        onTouchStart={(e) => handleStickerPointerDown(e, stk)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveStickerId(stk.id);
                        }}
                        style={{
                          top: `${stk.y}%`,
                          left: `${stk.x}%`,
                          transform: `translate(-50%, -50%) scale(${stk.scale}) rotate(${stk.rotation}deg)`,
                          zIndex: stk.zIndex,
                        }}
                        className={`absolute cursor-grab active:cursor-grabbing select-none transition-shadow ${
                          isActive ? 'ring-2 ring-rose-500 rounded-xl p-1 bg-white/80 shadow-lg scale-105' : 'hover:ring-1 hover:ring-amber-400'
                        } ${isDragging ? 'opacity-90 shadow-2xl ring-2 ring-amber-500' : ''}`}
                      >
                        {stk.imageUrl.startsWith('data:') || stk.imageUrl.startsWith('http') ? (
                          <img src={stk.imageUrl} className="w-16 h-16 object-cover rounded-xl shadow-xs pointer-events-none" />
                        ) : (
                          <span className="text-4xl pointer-events-none">{stk.imageUrl}</span>
                        )}

                        {/* Controls on active sticker */}
                        {isActive && (
                          <div
                            className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 bg-stone-900/95 text-white px-2.5 py-1 rounded-full text-[11px] shadow-xl z-50 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                          >
                            <span className="text-[9px] text-amber-300 font-bold px-1 border-r border-stone-700">
                              드래그 이동
                            </span>
                            <button
                              type="button"
                              onClick={() => updateSticker(stk.id, { scale: Math.min(2.5, stk.scale + 0.2) })}
                              className="hover:text-amber-300 px-1 font-bold"
                              title="확대"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSticker(stk.id, { scale: Math.max(0.4, stk.scale - 0.2) })}
                              className="hover:text-amber-300 px-1 font-bold"
                              title="축소"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSticker(stk.id, { rotation: stk.rotation + 15 })}
                              className="hover:text-amber-300 px-1"
                              title="회전"
                            >
                              ⟳
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSticker(stk.id)}
                              className="hover:text-rose-400 font-bold ml-1 text-xs"
                              title="삭제"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl shadow-xs"
                >
                  다이어리 저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
