import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
  DollarSign,
  PieChart as PieIcon,
  Search,
  Filter,
  Trash2,
  X,
  Upload,
  Receipt,
  BookOpen,
  Star,
  ExternalLink
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { FinancialEntry, FinancialType, DiaryEntry, UserCustomSticker } from '../types';

interface FinancialViewProps {
  financials: FinancialEntry[];
  setFinancials: React.Dispatch<React.SetStateAction<FinancialEntry[]>>;
  selectedDate: string;
  diaries?: DiaryEntry[];
  setDiaries?: React.Dispatch<React.SetStateAction<DiaryEntry[]>>;
  userStickers?: UserCustomSticker[];
  setUserStickers?: React.Dispatch<React.SetStateAction<UserCustomSticker[]>>;
  onNavigateToDiary?: (date?: string) => void;
}

export const FinancialView: React.FC<FinancialViewProps> = ({
  financials,
  setFinancials,
  selectedDate,
  diaries = [],
  setDiaries,
  userStickers = [],
  setUserStickers,
  onNavigateToDiary,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState<FinancialType>('expense');
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState('식비');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'transfer'>('card');
  const [date, setDate] = useState(selectedDate);
  const [memo, setMemo] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);
  const [syncToDiary, setSyncToDiary] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');

  // Categories list
  const expenseCategories = ['식비', '교통', '쇼핑', '문화/여가', '주거/통신', '의료/건강', '기타'];
  const incomeCategories = ['급여', '용돈', '부수입', '금융소득', '기타'];

  const categoryColors: Record<string, string> = {
    식비: '#F59E0B',
    교통: '#3B82F6',
    쇼핑: '#EC4899',
    '문화/여가': '#8B5CF6',
    '주거/통신': '#10B981',
    '의료/건강': '#14B8A6',
    급여: '#06B6D4',
    용돈: '#F43F5E',
    부수입: '#84CC16',
    기타: '#6B7280',
  };

  // Calculations
  const totalIncome = financials
    .filter((f) => f.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = financials
    .filter((f) => f.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Pie chart expense category aggregate
  const expenseByCategory = expenseCategories.map((cat) => {
    const value = financials
      .filter((f) => f.type === 'expense' && f.category === cat)
      .reduce((acc, curr) => acc + curr.amount, 0);
    return { name: cat, value };
  }).filter((c) => c.value > 0);

  // Filtered transactions
  const filteredList = financials.filter((f) => {
    const matchesSearch =
      f.memo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || f.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    const numAmount = Number(amount);
    const newEntry: FinancialEntry = {
      id: `fin_${Date.now()}`,
      date,
      type,
      amount: numAmount,
      category,
      paymentMethod,
      memo,
      receiptImage,
    };

    setFinancials((prev) => [newEntry, ...prev]);

    // Save receipt image as a User Custom Sticker in Gallery
    if (receiptImage && setUserStickers) {
      const newSticker: UserCustomSticker = {
        id: `usr_stk_${Date.now()}`,
        name: `영수증 (${category} ${numAmount.toLocaleString()}원)`,
        imageUrl: receiptImage,
        createdAt: new Date().toISOString(),
      };
      setUserStickers((prev) => [newSticker, ...prev]);
    }

    // Sync to Diary if enabled
    if (syncToDiary && setDiaries) {
      const noteLine = `\n[💰 가계부 연동] ${category} ${type === 'expense' ? '-' : '+'}${numAmount.toLocaleString()}원 (${memo || '지출 기록'})`;
      
      setDiaries((prevDiaries) => {
        const existingIdx = prevDiaries.findIndex((d) => d.date === date);
        if (existingIdx >= 0) {
          const updated = [...prevDiaries];
          const curr = updated[existingIdx];
          updated[existingIdx] = {
            ...curr,
            content: (curr.content || '') + noteLine,
            images: receiptImage ? Array.from(new Set([...(curr.images || []), receiptImage])) : curr.images,
          };
          return updated;
        } else {
          // Create new diary entry for today
          const newDiary: DiaryEntry = {
            id: `diary_${Date.now()}`,
            date,
            title: `${date} 가계부 일기`,
            content: `오늘의 가계부 연동 기록:${noteLine}`,
            weather: 'sunny',
            emotions: [{ type: 'joy', label: '평온', emoji: '😌', color: '#34D399', intensity: 4 }],
            images: receiptImage ? [receiptImage] : [],
            stickers: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return [newDiary, ...prevDiaries];
        }
      });
    }

    setAmount('');
    setMemo('');
    setReceiptImage(undefined);
    setIsModalOpen(false);
  };

  const deleteEntry = (id: string) => {
    if (confirm('이 가계부 내역을 삭제하시겠습니까?')) {
      setFinancials((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setReceiptImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const todayDiary = diaries.find((d) => d.date === selectedDate);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Linked Diary Quick Banner */}
      {todayDiary && (
        <div className="bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-800">📖 {selectedDate} 다이어리가 작성되어 있습니다!</p>
              <p className="text-xs font-medium text-stone-700 font-bold truncate max-w-md">"{todayDiary.title}"</p>
            </div>
          </div>
          {onNavigateToDiary && (
            <button
              type="button"
              onClick={() => onNavigateToDiary(selectedDate)}
              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-2xs transition-all flex-none"
            >
              <span>다이어리 보기</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Header Banner & Summary Cards */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-stone-800 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-600" />
            스마트 가계부 (Household Account Ledger)
          </h2>
          <p className="text-xs text-stone-500">
            일별 수입 및 지출을 체계적으로 수집하고 시각화 차트로 관리해보세요.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-98 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>내역 추가</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Income Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 mb-1">
            <span>이번 달 총 수입</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-900">
            +{totalIncome.toLocaleString()} <span className="text-xs">원</span>
          </p>
        </div>

        {/* Total Expense Card */}
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-2xl p-4 border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800 mb-1">
            <span>이번 달 총 지출</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-900">
            -{totalExpense.toLocaleString()} <span className="text-xs">원</span>
          </p>
        </div>

        {/* Net Balance Card */}
        <div className="bg-gradient-to-br from-theme-soft to-stone-50 rounded-2xl p-4 border border-theme-soft shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-theme-primary mb-1">
            <span>현재 순잔액</span>
            <Wallet className="w-4 h-4 text-theme-primary" />
          </div>
          <p className={`text-2xl font-black ${netBalance >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>
            {netBalance.toLocaleString()} <span className="text-xs">원</span>
          </p>
        </div>
      </div>

      {/* Charts & Categorical Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expense Category Pie Chart */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-stone-200/80 lg:col-span-1 space-y-3">
          <h3 className="font-bold text-stone-800 text-sm flex items-center gap-1.5">
            <PieIcon className="w-4 h-4 text-theme-primary" />
            카테고리별 지출 비율
          </h3>

          {expenseByCategory.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-xs">지출 내역이 없습니다.</div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expenseByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={categoryColors[entry.name] || '#6B7280'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `${value?.toLocaleString()}원`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {expenseByCategory.map((item) => (
                  <span key={item.name} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[item.name] }} />
                    {item.name}: {item.value.toLocaleString()}원
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Transaction History List */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-stone-200/80 lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <h3 className="font-bold text-stone-800 text-base">가계부 수입/지출 내역</h3>

            {/* Filters & Search */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="메모/카테고리 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-stone-200 rounded-xl text-xs w-36 sm:w-44 focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-2.5 py-1.5 border border-stone-200 rounded-xl text-xs bg-stone-50"
              >
                <option value="all">전체 보기</option>
                <option value="expense">지출만</option>
                <option value="income">수입만</option>
              </select>
            </div>
          </div>

          {filteredList.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-xs italic">
              조회 가능한 가계부 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto no-scrollbar pr-1">
              {filteredList.map((entry) => {
                const isIncome = entry.type === 'income';
                return (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl border border-stone-100 bg-stone-50/40 hover:bg-stone-50 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {isIncome ? '＋' : '－'}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-stone-800">{entry.category}</span>
                          <span className="text-[10px] text-stone-400 bg-white px-2 py-0.5 rounded-md border">
                            {entry.paymentMethod === 'card'
                              ? '카드'
                              : entry.paymentMethod === 'cash'
                              ? '현금'
                              : '계좌이체'}
                          </span>
                          <span className="text-[10px] text-stone-400">{entry.date}</span>
                        </div>
                        {entry.memo && <p className="text-xs text-stone-600 mt-0.5">{entry.memo}</p>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`font-black text-sm sm:text-base ${isIncome ? 'text-emerald-600' : 'text-stone-900'}`}>
                        {isIncome ? '+' : '-'}{entry.amount.toLocaleString()}원
                      </span>

                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="text-stone-300 hover:text-rose-600 p-1 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ADD ENTRY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-800 text-lg">가계부 내역 추가</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-4 text-sm">
              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setType('expense');
                    setCategory('식비');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    type === 'expense' ? 'bg-rose-500 text-white shadow-xs' : 'text-stone-600'
                  }`}
                >
                  지출 (Expense)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('income');
                    setCategory('급여');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    type === 'income' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-600'
                  }`}
                >
                  수입 (Income)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">금액 (원) *</label>
                <input
                  type="number"
                  required
                  placeholder="예: 15000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-400 font-extrabold text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">카테고리</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  >
                    {(type === 'expense' ? expenseCategories : incomeCategories).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">결제 수단</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  >
                    <option value="card">카드</option>
                    <option value="cash">현금</option>
                    <option value="transfer">계좌이체</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">날짜</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">메모 내용</label>
                <input
                  type="text"
                  placeholder="예: 스타벅스 아메리카노, 택시비"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              {/* Receipt Image Upload */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">영수증 첨부 (선택)</label>
                <label className="cursor-pointer flex items-center space-x-1 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 rounded-xl text-xs font-semibold border border-stone-200 transition-colors">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>영수증 이미지 파일</span>
                  <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
                </label>
                {receiptImage && (
                  <img src={receiptImage} className="w-20 h-20 object-cover rounded-xl mt-2 border" />
                )}
              </div>

              {/* Sync to Diary Checkbox */}
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/70 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="syncToDiary"
                  checked={syncToDiary}
                  onChange={(e) => setSyncToDiary(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-400 accent-amber-500"
                />
                <label htmlFor="syncToDiary" className="text-xs font-bold text-stone-800 cursor-pointer flex items-center space-x-1">
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>오늘 다이어리에도 가계부 기록 자동 생성/연동</span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white font-bold rounded-xl shadow-xs ${
                    type === 'expense' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  내역 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
