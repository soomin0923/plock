import React, { useState } from 'react';
import { Smile, Upload, Trash2, Plus, Sparkles, Heart, Image as ImageIcon, Check, BookOpen, Receipt, ExternalLink, Star } from 'lucide-react';
import { UserCustomSticker, DiaryEntry, FinancialEntry } from '../types';

interface StickerGalleryProps {
  userStickers: UserCustomSticker[];
  setUserStickers: React.Dispatch<React.SetStateAction<UserCustomSticker[]>>;
  presetStickers: { id: string; name: string; imageUrl: string; type: string }[];
  diaries?: DiaryEntry[];
  financials?: FinancialEntry[];
  onNavigateToDiary?: (date?: string) => void;
}

export const StickerGallery: React.FC<StickerGalleryProps> = ({
  userStickers,
  setUserStickers,
  presetStickers,
  diaries = [],
  financials = [],
  onNavigateToDiary,
}) => {
  const [activeGalleryTab, setActiveGalleryTab] = useState<'stickers' | 'collected'>('stickers');
  const [newStickerName, setNewStickerName] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Collect all photos from diaries and financial receipts
  const diaryPhotos = diaries.flatMap((d) =>
    (d.images || []).map((img, idx) => ({
      id: `d_photo_${d.id}_${idx}`,
      imageUrl: img,
      date: d.date,
      title: d.title,
      source: 'diary' as const,
    }))
  );

  const financialReceipts = financials
    .filter((f) => f.receiptImage)
    .map((f) => ({
      id: `f_photo_${f.id}`,
      imageUrl: f.receiptImage!,
      date: f.date,
      title: `${f.category} ${f.type === 'expense' ? '-' : '+'}${f.amount.toLocaleString()}원 영수증`,
      source: 'financial' as const,
    }));

  const collectedPhotos = [...diaryPhotos, ...financialReceipts];

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setSelectedImage(ev.target.result as string);
          if (!newStickerName) {
            setNewStickerName(file.name.split('.')[0] || '내 갤러리 스티커');
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCustomSticker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage) return;

    const newSticker: UserCustomSticker = {
      id: `usr_stk_${Date.now()}`,
      name: newStickerName.trim() || '내 스티커',
      imageUrl: selectedImage,
      createdAt: new Date().toISOString(),
    };

    setUserStickers((prev) => [newSticker, ...prev]);
    setSelectedImage(null);
    setNewStickerName('');
  };

  const deleteCustomSticker = (id: string) => {
    if (confirm('이 커스텀 스티커를 삭제하시겠습니까?')) {
      setUserStickers((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleConvertPhotoToSticker = (photo: { imageUrl: string; title: string; date: string }) => {
    const newSticker: UserCustomSticker = {
      id: `usr_stk_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: photo.title || `갤러리 포토 (${photo.date})`,
      imageUrl: photo.imageUrl,
      createdAt: new Date().toISOString(),
    };
    setUserStickers((prev) => [newSticker, ...prev]);
    alert('⭐ 성공적으로 내 갤러리 스티커 보관함에 추가되었습니다!');
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-theme-soft via-rose-50 to-purple-50 rounded-2xl p-6 border border-theme-soft shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-theme-primary text-white flex items-center justify-center font-bold text-xl shadow-xs">
              🎨
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-stone-800">내 갤러리 스티커 및 사진 보관소</h2>
              <p className="text-xs text-stone-600">
                내 사진으로 커스텀 스티커를 만들고, 다이어리와 가계부에 수집된 전체 사진 갤러리를 한눈에 모아보세요!
              </p>
            </div>
          </div>

          {/* Sub-Tabs Selector */}
          <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-xs p-1 rounded-xl border border-stone-200/80">
            <button
              onClick={() => setActiveGalleryTab('stickers')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeGalleryTab === 'stickers'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              🎨 내 스티커 보관함 ({userStickers.length})
            </button>
            <button
              onClick={() => setActiveGalleryTab('collected')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeGalleryTab === 'collected'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              📸 수집된 갤러리 ({collectedPhotos.length})
            </button>
          </div>
        </div>
      </div>

      {activeGalleryTab === 'stickers' ? (
        <>
          {/* Upload New Custom Photo Sticker Section */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-4">
            <h3 className="font-extrabold text-stone-800 text-base flex items-center gap-2">
              <Upload className="w-5 h-5 text-theme-primary" />
              내 갤러리 사진으로 새 스티커 만들기
            </h3>

            <form onSubmit={handleSaveCustomSticker} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">스티커 이름</label>
                <input
                  type="text"
                  placeholder="예: 내 반려견 사진, 여행 사진"
                  value={newStickerName}
                  onChange={(e) => setNewStickerName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-theme-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-stone-700">갤러리 이미지 파일 선택</label>
                <label className="cursor-pointer flex items-center space-x-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 border border-stone-200 rounded-xl text-xs font-bold transition-colors">
                  <ImageIcon className="w-4 h-4 text-stone-500" />
                  <span>사진 불러오기</span>
                  <input type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                </label>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={!selectedImage}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-all shadow-xs ${
                    selectedImage
                      ? 'bg-theme-primary hover:opacity-90 text-white'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>스티커 보관함에 저장하기</span>
                </button>
              </div>
            </form>

            {/* Selected Image Preview */}
            {selectedImage && (
              <div className="p-3 bg-theme-soft rounded-xl border border-theme-soft flex items-center space-x-3">
                <img src={selectedImage} alt="미리보기" className="w-16 h-16 object-cover rounded-xl border" />
                <div>
                  <p className="text-xs font-bold text-amber-900">새 스티커 미리보기 준비 완료!</p>
                  <p className="text-[11px] text-amber-700">‘스티커 보관함에 저장하기’를 누르면 다이어리에서 바로 사용할 수 있습니다.</p>
                </div>
              </div>
            )}
          </div>

          {/* Custom User Stickers Collection */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-4">
            <h3 className="font-extrabold text-stone-800 text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-500" />
              등록된 내 갤러리 커스텀 스티커 ({userStickers.length}개)
            </h3>

            {userStickers.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                아직 등록된 갤러리 스티커가 없습니다. 위 입력창에서 내 사진을 불러와 스티커를 만들어보세요!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {userStickers.map((stk) => (
                  <div
                    key={stk.id}
                    className="p-3 rounded-2xl border border-stone-200 bg-stone-50/50 hover:bg-white hover:shadow-md transition-all group relative flex flex-col items-center"
                  >
                    <img src={stk.imageUrl} alt={stk.name} className="w-20 h-20 object-cover rounded-xl border shadow-2xs mb-2" />
                    <span className="text-xs font-bold text-stone-800 truncate w-full text-center mb-1">{stk.name}</span>

                    {onNavigateToDiary && (
                      <button
                        type="button"
                        onClick={() => onNavigateToDiary()}
                        className="w-full py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-bold flex items-center justify-center space-x-1"
                      >
                        <BookOpen className="w-3 h-3 text-amber-700" />
                        <span>다이어리 쓰기</span>
                      </button>
                    )}

                    <button
                      onClick={() => deleteCustomSticker(stk.id)}
                      className="absolute top-2 right-2 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preset System Stickers */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-4">
            <h3 className="font-extrabold text-stone-800 text-base flex items-center gap-2">
              <Smile className="w-5 h-5 text-amber-500" />
              기본 제공 에스테틱 스티커 보관함
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-3">
              {presetStickers.map((stk, idx) => {
                const isObj = typeof stk === 'object' && stk !== null;
                const imgUrl = isObj ? stk.imageUrl : String(stk);
                const name = isObj ? stk.name : '스티커';
                const id = isObj ? stk.id : `stk_${idx}`;

                return (
                  <div
                    key={id}
                    className="p-3 rounded-xl border border-stone-200 bg-stone-50 flex flex-col items-center justify-center hover:scale-105 transition-transform"
                  >
                    {imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('data:')) ? (
                      <img src={imgUrl} className="w-12 h-12 object-cover rounded-lg" alt={name} />
                    ) : (
                      <span className="text-3xl">{imgUrl}</span>
                    )}
                    <span className="text-[10px] text-stone-500 mt-1 truncate w-full text-center">{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* Collected Photos View (Diaries + Financial Receipts) */
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-stone-200/80 space-y-4">
          <h3 className="font-extrabold text-stone-800 text-base flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-rose-500" />
            다이어리 첨부 사진 & 가계부 영수증 모아보기 ({collectedPhotos.length}장)
          </h3>

          {collectedPhotos.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              아직 다이어리나 가계부에 수집된 사진이 없습니다. 다이어리 쓰기나 가계부 등록 시 사진을 첨부해 보세요!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {collectedPhotos.map((photo) => (
                <div key={photo.id} className="border border-stone-200 rounded-2xl p-3 bg-stone-50 space-y-2 hover:shadow-md transition-shadow">
                  <div className="relative aspect-4/3 overflow-hidden rounded-xl bg-stone-200">
                    <img src={photo.imageUrl} alt={photo.title} className="w-full h-full object-cover" />
                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-2xs ${
                        photo.source === 'diary' ? 'bg-rose-500' : 'bg-emerald-600'
                      }`}
                    >
                      {photo.source === 'diary' ? '다이어리 사진' : '가계부 영수증'}
                    </span>
                  </div>

                  <div>
                    <p className="text-[11px] font-bold text-stone-400">{photo.date}</p>
                    <p className="text-xs font-bold text-stone-800 truncate">{photo.title}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-stone-200/60">
                    <button
                      type="button"
                      onClick={() => handleConvertPhotoToSticker(photo)}
                      className="flex-1 py-1.5 bg-amber-400 hover:bg-amber-500 text-stone-900 rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 shadow-2xs transition-all"
                    >
                      <Star className="w-3.5 h-3.5 fill-stone-900" />
                      <span>스티커로 저장</span>
                    </button>

                    {onNavigateToDiary && (
                      <button
                        type="button"
                        onClick={() => onNavigateToDiary(photo.date)}
                        className="py-1.5 px-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-[11px] font-bold flex items-center justify-center transition-all"
                        title="다이어리 이동"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
