import React, { useState, useRef } from 'react';
import {
  Calendar,
  Download,
  Upload,
  ExternalLink,
  CheckCircle2,
  Share2,
  FileText,
  X,
  HelpCircle,
  Sparkles,
  Layers,
  FileUp,
  AlertCircle,
  CheckSquare,
  Clock,
  MapPin,
  Tag,
  RefreshCw,
  PlusCircle,
  FileDown,
} from 'lucide-react';
import { PlannerItem, ChecklistItem, CustomCategory } from '../types';
import {
  generateICalendarString,
  downloadICalendarFile,
  GOOGLE_CALENDAR_IMPORT_URL,
} from '../lib/iCalendarExport';
import {
  parseICalendarString,
  convertICalEventsToAppItems,
  ParsedICalEvent,
} from '../lib/iCalendarImport';

interface ICalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  plannerItems: PlannerItem[];
  checklistItems?: ChecklistItem[];
  categories?: CustomCategory[];
  primaryColor?: string;
  onShowToast?: (msg: string) => void;
  onImportItems?: (importedPlanner: PlannerItem[], importedChecklist: ChecklistItem[]) => void;
  initialTab?: 'export' | 'import';
}

export const ICalExportModal: React.FC<ICalSyncModalProps> = ({
  isOpen,
  onClose,
  plannerItems,
  checklistItems = [],
  categories = [],
  primaryColor = '#C1876B',
  onShowToast,
  onImportItems,
  initialTab = 'import',
}) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const todayStr = `${currentYear}-${currentMonth}-${String(now.getDate()).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState<'import' | 'export'>(initialTab);

  // --- Export State ---
  const [exportScope, setExportScope] = useState<'all' | 'month' | 'custom'>('all');
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [includeChecklists, setIncludeChecklists] = useState(true);
  const [calendarName, setCalendarName] = useState('Plock 개인 일정');
  const [isExported, setIsExported] = useState(false);

  // --- Import State ---
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [parsedEvents, setParsedEvents] = useState<ParsedICalEvent[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [targetCategory, setTargetCategory] = useState<string>(categories[0]?.id || 'personal');

  if (!isOpen) return null;

  // Filtered export count
  const getFilteredItems = () => {
    if (exportScope === 'all') return plannerItems;
    if (exportScope === 'month') {
      const monthPrefix = `${currentYear}-${currentMonth}`;
      return plannerItems.filter((item) => {
        const s = item.startDate || item.date;
        const e = item.endDate || item.date;
        return s.startsWith(monthPrefix) || e.startsWith(monthPrefix);
      });
    }
    return plannerItems.filter((item) => {
      const s = item.startDate || item.date;
      const e = item.endDate || item.date;
      return s <= customEnd && e >= customStart;
    });
  };

  const filteredPlannerList = getFilteredItems();

  const handleExport = () => {
    let filterRange: { startDate?: string; endDate?: string } | undefined = undefined;

    if (exportScope === 'month') {
      const lastDay = new Date(currentYear, now.getMonth() + 1, 0).getDate();
      filterRange = {
        startDate: `${currentYear}-${currentMonth}-01`,
        endDate: `${currentYear}-${currentMonth}-${String(lastDay).padStart(2, '0')}`,
      };
    } else if (exportScope === 'custom') {
      filterRange = {
        startDate: customStart,
        endDate: customEnd,
      };
    }

    const icsContent = generateICalendarString(plannerItems, checklistItems, {
      calendarName,
      categories,
      includeChecklists,
      filterDateRange: filterRange,
    });

    const timestamp = todayStr.replace(/-/g, '');
    const filename = `plock_schedule_${exportScope}_${timestamp}.ics`;

    downloadICalendarFile(filename, icsContent);
    setIsExported(true);

    if (onShowToast) {
      onShowToast(`📅 iCalendar (.ics) 파일 [${filename}]이 성공적으로 다운로드되었습니다!`);
    }
  };

  // --- Process Imported File ---
  const handleFileChange = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.ics')) {
      setImportError('iCalendar (.ics) 확장자 파일만 업로드할 수 있습니다.');
      return;
    }

    setImportError(null);
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const events = parseICalendarString(content);
        if (events.length === 0) {
          setImportError('파일 내에 등록 가능한 캘린더 일정(VEVENT)이 없습니다.');
          setParsedEvents([]);
        } else {
          setParsedEvents(events);
          if (onShowToast) {
            onShowToast(`🎉 ${events.length}개의 구글 캘린더 일정을 분석했습니다. 검토 후 가져오기를 눌러주세요.`);
          }
        }
      } catch (err: any) {
        setImportError(err.message || '.ics 파일을 읽는 중 오류가 발생했습니다.');
        setParsedEvents([]);
      }
    };
    reader.onerror = () => {
      setImportError('파일을 읽어오는 중 에러가 발생했습니다.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setParsedEvents((prev) => prev.map((ev) => ({ ...ev, selected: checked })));
  };

  const toggleEventSelect = (id: string) => {
    setParsedEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, selected: !ev.selected } : ev))
    );
  };

  const handleExecuteImport = () => {
    const selectedList = parsedEvents.filter((ev) => ev.selected);
    if (selectedList.length === 0) {
      if (onShowToast) onShowToast('⚠️ 가져올 일정을 최소 1개 이상 선택해주세요.');
      return;
    }

    setIsImporting(true);
    try {
      const catMap: Record<string, string> = {};
      categories.forEach((c) => {
        catMap[c.name] = c.id;
        catMap[c.id] = c.id;
      });
      // Fallback for default
      catMap[''] = targetCategory;

      const { plannerItems: newPlans, checklistItems: newChecks } = convertICalEventsToAppItems(
        selectedList,
        catMap
      );

      // Apply chosen target category to any items without category
      newPlans.forEach((p) => {
        if (!p.category || p.category === 'other') p.category = targetCategory;
      });
      newChecks.forEach((c) => {
        if (!c.category || c.category === 'other') c.category = targetCategory;
      });

      if (onImportItems) {
        onImportItems(newPlans, newChecks);
      }

      if (onShowToast) {
        onShowToast(
          `✨ 구글 캘린더에서 총 ${newPlans.length}건의 플래너 일정과 ${newChecks.length}건의 할 일이 성공적으로 등록되었습니다!`
        );
      }

      onClose();
    } catch (err: any) {
      setImportError(err.message || '일정 가져오기 중 오류가 발생했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  const selectedCount = parsedEvents.filter((e) => e.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FDFCF9] rounded-3xl max-w-2xl w-full border border-stone-300 shadow-2xl overflow-hidden font-sans max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/90">
          <div className="flex items-center space-x-3">
            <div
              style={{ backgroundColor: primaryColor }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md font-bold text-sm"
            >
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  RFC 5545 iCalendar
                </span>
                <span className="text-[11px] font-mono text-stone-500">GOOGLE & APPLE CALENDAR</span>
              </div>
              <h3 className="font-serif font-bold text-stone-900 text-lg mt-0.5">
                구글 캘린더 (.ics) 연동 & 파일 불러오기
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 bg-stone-100/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-extrabold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>📥 구글 캘린더 .ics 파일 불러오기 (Import)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-extrabold'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <Download className="w-4 h-4 text-amber-600" />
            <span>📤 iCalendar (.ics) 파일 내보내기 (Export)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'import' ? (
            /* =================== IMPORT TAB =================== */
            <div className="space-y-5">
              {/* Google Export Guide Callout */}
              <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-2xl flex items-start justify-between gap-3 text-xs text-blue-950">
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-900">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>구글 캘린더에서 .ics 파일 다운로드 방법</span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    구글 캘린더 우측 상단 ⚙️ 설정 &gt; <strong>[가져오기/내보내기]</strong> &gt; <strong>[내보내기]</strong>를 누르면 압축된 .ics 일정 파일을 다운받으실 수 있습니다.
                  </p>
                </div>
                <a
                  href={GOOGLE_CALENDAR_IMPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold shrink-0 flex items-center gap-1 shadow-2xs transition-colors"
                >
                  <span>구글 캘린더 설정</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/70 scale-[1.01]'
                    : importFileName
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-stone-300 hover:border-stone-400 bg-stone-50/60 hover:bg-stone-100/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ics,text/calendar"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-stone-200 flex items-center justify-center text-emerald-600">
                  <FileUp className="w-6 h-6" />
                </div>

                <div>
                  <div className="text-xs font-bold text-stone-800">
                    {importFileName ? (
                      <span className="text-emerald-700 font-mono font-extrabold">{importFileName}</span>
                    ) : (
                      <span>구글 캘린더 .ics 파일을 여기로 드래그하거나 클릭하여 선택</span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    구글, 애플 캘린더, 네이버 캘린더 등 모든 표준 .ics 파일 지원
                  </p>
                </div>
              </div>

              {/* Error Box */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Parsed Events Preview List */}
              {parsedEvents.length > 0 && (
                <div className="space-y-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs animate-fade-in">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-stone-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-bold text-stone-900">
                        불러온 일정 목록 ({selectedCount}/{parsedEvents.length}개 선택됨)
                      </h4>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Target Category Select */}
                      <div className="flex items-center space-x-1 text-xs">
                        <Tag className="w-3.5 h-3.5 text-stone-400" />
                        <span className="text-[11px] text-stone-500 font-bold">카테고리:</span>
                        <select
                          value={targetCategory}
                          onChange={(e) => setTargetCategory(e.target.value)}
                          className="px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-stone-800 focus:outline-none"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectAll(selectedCount !== parsedEvents.length)}
                        className="px-2.5 py-1 text-[11px] font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                      >
                        {selectedCount === parsedEvents.length ? '전체 해제' : '전체 선택'}
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {parsedEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => toggleEventSelect(ev.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 ${
                          ev.selected
                            ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                            : 'bg-stone-50/60 border-stone-200 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={ev.selected}
                          onChange={() => {}}
                          className="mt-0.5 w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-stone-900 truncate">
                              {ev.title}
                            </span>
                            {ev.isChecklist ? (
                              <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-bold">
                                할 일
                              </span>
                            ) : (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                일정
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-stone-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span className="flex items-center space-x-1 font-mono">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              <span>
                                {ev.startDate}
                                {ev.endDate !== ev.startDate ? ` ~ ${ev.endDate}` : ''}
                              </span>
                            </span>
                            {ev.startTime && (
                              <span className="flex items-center space-x-1 font-mono">
                                <Clock className="w-3 h-3 text-stone-400" />
                                <span>
                                  {ev.startTime}
                                  {ev.endTime ? ` - ${ev.endTime}` : ''}
                                </span>
                              </span>
                            )}
                            {ev.location && (
                              <span className="flex items-center space-x-1 truncate max-w-[150px]">
                                <MapPin className="w-3 h-3 text-stone-400" />
                                <span className="truncate">{ev.location}</span>
                              </span>
                            )}
                          </div>

                          {ev.description && (
                            <p className="text-[11px] text-stone-600 mt-1 line-clamp-1 bg-white/80 px-2 py-0.5 rounded border border-stone-100">
                              {ev.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isImporting || selectedCount === 0}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer active:scale-[0.99]"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>일정 등록 진행 중...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        <span>선택한 {selectedCount}개 일정 플래너에 즉시 등록하기</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* =================== EXPORT TAB =================== */
            <div className="space-y-6">
              {/* Calendar Name Setting */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  캘린더 이름 (구글 캘린더 표시명)
                </label>
                <input
                  type="text"
                  value={calendarName}
                  onChange={(e) => setCalendarName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
              </div>

              {/* Scope Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">
                  내보낼 일정 범위 선택
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExportScope('all')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      exportScope === 'all'
                        ? 'border-amber-700 bg-amber-50/70 text-amber-950 font-bold shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    <div className="text-xs font-bold">전체 일정</div>
                    <div className="text-[11px] text-stone-500 mt-0.5 font-mono">
                      총 {plannerItems.length}개 항목
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope('month')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      exportScope === 'month'
                        ? 'border-amber-700 bg-amber-50/70 text-amber-950 font-bold shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    <div className="text-xs font-bold">이번 달 ({currentMonth}월)</div>
                    <div className="text-[11px] text-stone-500 mt-0.5 font-mono">
                      {filteredPlannerList.length}개 항목
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope('custom')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      exportScope === 'custom'
                        ? 'border-amber-700 bg-amber-50/70 text-amber-950 font-bold shadow-xs'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    <div className="text-xs font-bold">직접 기간 설정</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">날짜 선택</div>
                  </button>
                </div>

                {/* Custom Range Picker */}
                {exportScope === 'custom' && (
                  <div className="mt-3 p-3 bg-stone-100/70 rounded-xl border border-stone-200 grid grid-cols-2 gap-3 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">시작일</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => {
                          setCustomStart(e.target.value);
                          if (e.target.value > customEnd) setCustomEnd(e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">종료일</label>
                      <input
                        type="date"
                        min={customStart}
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs bg-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Checklist Inclusion Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                <div>
                  <div className="text-xs font-bold text-stone-900">할 일(체크리스트) 포함</div>
                  <div className="text-[11px] text-stone-500">
                    마감 기한이 있는 할 일도 캘린더 이벤트로 함께 내보냅니다.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeChecklists}
                    onChange={(e) => setIncludeChecklists(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Export Action Button */}
              <button
                type="button"
                onClick={handleExport}
                className="w-full py-3 bg-[#1A1A1A] hover:bg-[#1A1A1A]/85 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md transition-all active:scale-[0.99] cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>iCalendar (.ics) 파일 생성 및 다운로드</span>
              </button>

              {isExported && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs space-y-2 animate-fade-in">
                  <div className="flex items-center space-x-2 text-emerald-800 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>다운로드가 완료되었습니다!</span>
                  </div>
                  <p className="text-emerald-700 text-[11px] leading-relaxed">
                    구글 캘린더 웹페이지로 이동 후, 설정 &gt; [가져오기 및 내보내기]에서 방금 다운로드한 .ics 파일을 업로드하면 구글 캘린더에 일정이 동기화됩니다.
                  </p>
                  <a
                    href={GOOGLE_CALENDAR_IMPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-2xs transition-colors"
                  >
                    <span>구글 캘린더 가져오기 바로가기</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-stone-500 font-mono">
            {activeTab === 'import' ? '📥 CALENDAR IMPORT ENGINE' : '📤 CALENDAR EXPORT ENGINE'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
