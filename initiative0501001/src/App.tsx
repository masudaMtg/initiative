import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, Swords, Search, Trash2, Edit2, Check, RefreshCw, 
  ChevronDown, Menu, X, Twitter, ExternalLink, Lock, Moon, Sun, Globe,
  Shield, Info
} from 'lucide-react';

interface Room {
  id: string;
  name: { ja: string; en: string };
  description: { ja: string; en: string };
  depth: number;
}

const ROOMS: Room[] = [
  {
    id: 'entrance',
    name: { ja: '秘密の入り口', en: 'Secret Entrance' },
    description: { 
      ja: 'あなたのライブラリーから基本土地・カード１枚を探し、公開し、あなたの手札に加える。その後、ライブラリーを切り直す。', 
      en: 'Search your library for a basic land card, reveal it, put it into your hand, then shuffle. (Forge, Lost Well)' 
    },
    depth: 1,
  },
  {
    id: 'forge',
    name: { ja: '鍛冶場', en: 'Forge' },
    description: { 
      ja: 'クリーチャー１体を対象とする。それの上に＋１/＋１カウンター２個を置く。', 
      en: 'Put two +1/+1 counters on target creature. (Trap!, Arena)' 
    },
    depth: 2,
  },
  {
    id: 'well',
    name: { ja: '失われた井戸', en: 'Lost Well' },
    description: { 
      ja: '占術2を行う。', 
      en: 'Scry 2. (Arena, Stash)' 
    },
    depth: 2,
  },
  {
    id: 'trap',
    name: { ja: '罠だ！', en: 'Trap!' },
    description: { 
      ja: 'プレイヤー１人を対象とする。そのプレイヤーは５点のライフを失う。', 
      en: 'Target player loses 5 life. (Archives)' 
    },
    depth: 3,
  },
  {
    id: 'arena',
    name: { ja: '闘技場', en: 'Arena' },
    description: { 
      ja: 'クリーチャー１体を対象とする。それを使嗾する。', 
      en: 'Goad target creature. (Archives, Catacombs)' 
    },
    depth: 3,
  },
  {
    id: 'secret_room',
    name: { ja: '隠し部屋', en: 'Stash' },
    description: { 
      ja: '宝物・トークン1つを生成する。', 
      en: 'Create a Treasure token. (Catacombs)' 
    },
    depth: 3,
  },
  {
    id: 'archives',
    name: { ja: '書庫', en: 'Archives' },
    description: { 
      ja: 'カード1枚を引く。', 
      en: 'Draw a card. (Throne of the Dead Three)' 
    },
    depth: 4,
  },
  {
    id: 'catacombs',
    name: { ja: '地下墓地', en: 'Catacombs' },
    description: { 
      ja: '威迫を持つ黒の４/１のスケルトン・クリーチャー・トークン１体を生成する。', 
      en: 'Create a 4/1 black Skeleton creature token with menace. (Throne of the Dead Three)' 
    },
    depth: 4,
  },
  {
    id: 'throne',
    name: { ja: '死せる三者の玉座', en: 'Throne of the Dead Three' },
    description: { 
      ja: 'あなたのライブラリーの一番上にあるカード10枚を公開する。それらの中からクリーチャー・カード１枚を、＋１/＋１カウンター３個が置かれた状態で戦場に出す。次のあなたのターンまで、それは呪禁を得る。その後、ライブラリーを切り直す。', 
      en: 'Reveal the top ten cards of your library. Put a creature card from among them onto the battlefield with three +1/+1 counters on it. It gains hexproof until your next turn. Then shuffle.' 
    },
    depth: 5,
  },
];

const CONNECTIONS: Record<string, string[]> = {
  entrance: ['forge', 'well'],
  forge: ['trap', 'arena'],
  well: ['arena', 'secret_room'],
  trap: ['archives'],
  arena: ['archives', 'catacombs'],
  secret_room: ['catacombs'],
  archives: ['throne'],
  catacombs: ['throne'],
  throne: ['entrance'], // Loop back to entrance
};

interface Player {
  id: number;
  name: string;
  color: string;
  currentRoomId: string | null;
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: 'P1', color: '#EF4444', currentRoomId: null },
    { id: 2, name: 'P2', color: '#3B82F6', currentRoomId: null },
    { id: 3, name: 'P3', color: '#F59E0B', currentRoomId: null },
    { id: 4, name: 'P4', color: '#10B981', currentRoomId: null },
  ]);

  const [activePlayerId, setActivePlayerId] = useState<number>(1);
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [preventLock, setPreventLock] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isEnglish, setIsEnglish] = useState(false);

  const wakeLockRef = useRef<any>(null);

  const lang = isEnglish ? 'en' : 'ja';

  const t = {
    title: { ja: '地下街', en: 'Undercity' },
    subtitle: { 
      ja: '「地下街探索をする。」でなければこのダンジョンに入ることはできない', 
      en: 'You can\'t enter this dungeon unless you "venture into Undercity."' 
    },
    resetTitle: { ja: 'ゲームをリセットします', en: 'Reset Game' },
    resetMsg: { 
      ja: 'すべてのマーカーを待機状態に戻します。\nよろしいですか？', 
      en: 'Return all markers to standby?\nThis cannot be undone.' 
    },
    cancel: { ja: 'キャンセル', en: 'Cancel' },
    yes: { ja: 'はい', en: 'Yes' },
    standby: { ja: '待機', en: 'Wait' },
    settings: { ja: '設定', en: 'Settings' },
    preventLockLabel: { ja: '画面をロックしない', en: 'Prevent Lock' },
    darkModeLabel: { ja: 'ダークモード', en: 'Dark Mode' },
    englishLabel: { ja: 'English', en: 'English' },
    aboutTitle: { ja: 'このアプリについて', en: 'About this App' },
    aboutText: {
      ja: '「イニシアチブ」はファンコンテンツ・ポリシーに沿った非公式のファンコンテンツです。ウィザーズ社の認可/許諾は得ていません。題材の一部に、ウィザーズ・オブ・ザ・コースト社の財産を含んでいます。©Wizards of the Coast LLC.',
      en: '[INITIATIVE] is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.'
    },
    followMe: { ja: 'Follow Me', en: 'Follow Me' },
    on: { ja: 'ON', en: 'ON' },
    off: { ja: 'OFF', en: 'OFF' }
  };

  useEffect(() => {
    const handleWakeLock = async () => {
      if (preventLock && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err: any) {
          // Gracefully handle permission policy errors
          if (err.name === 'NotAllowedError') {
            console.warn('Wake Lock is disallowed by permission policy.');
          } else {
            console.error('Wake Lock failed:', err);
          }
        }
      } else if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };

    handleWakeLock();
    
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && preventLock) {
        handleWakeLock();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, [preventLock]);

  const activePlayer = players.find(p => p.id === activePlayerId)!;

  const handleRoomClick = (roomId: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.id === activePlayerId) {
        if (!p.currentRoomId) {
          if (roomId === 'entrance') return { ...p, currentRoomId: roomId };
        } else {
          if (CONNECTIONS[p.currentRoomId].includes(roomId)) {
            return { ...p, currentRoomId: roomId };
          }
        }
      }
      return p;
    }));
  };

  const confirmReset = () => {
    setPlayers(prev => prev.map(p => ({ ...p, currentRoomId: null })));
    setShowResetConfirm(false);
  };

  const updatePlayerName = (id: number, newName: string) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const getMarkerPosition = (pid: number) => {
    switch(pid) {
      case 1: return { top: '-14px', left: '-14px' };
      case 2: return { top: '-14px', right: '-14px' };
      case 3: return { bottom: '-14px', left: '-14px' };
      case 4: return { bottom: '-14px', right: '-14px' };
      default: return {};
    }
  };

  const renderRoom = (roomId: string) => {
    const room = ROOMS.find(r => r.id === roomId);
    if (!room) return null;

    const isCurrentPlayerRoom = activePlayer.currentRoomId === roomId;
    const canMoveTo = activePlayer.currentRoomId ? CONNECTIONS[activePlayer.currentRoomId].includes(roomId) : roomId === 'entrance';

    return (
      <motion.div
        key={roomId}
        id={`room-${roomId}`}
        whileTap={{ scale: 0.98 }}
        className={`relative p-2 rounded-lg border-2 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center gap-1 h-full w-full ${isDarkMode ? 'shadow-none' : 'shadow-sm'}
          ${isCurrentPlayerRoom 
            ? isDarkMode ? 'border-indigo-500 bg-indigo-500/20' : 'border-indigo-600 bg-indigo-50/50' 
            : isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}
          ${canMoveTo ? 'ring-2 ring-amber-400 ring-offset-1 border-amber-200' : ''}
        `}
        onClick={() => handleRoomClick(roomId)}
      >
        <h3 className={`font-bold text-[16px] tracking-tight leading-none ${
          isCurrentPlayerRoom 
            ? isDarkMode ? 'text-white' : 'text-indigo-900' 
            : isDarkMode ? 'text-slate-100' : 'text-slate-800'
        }`}>
          {room.name[lang]}
        </h3>
        <p className={`text-[8px] leading-[1.2] font-sans break-words whitespace-pre-line w-full overflow-visible px-1 ${
          isCurrentPlayerRoom && isDarkMode ? 'text-indigo-200' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
        }`}>
          {room.description[lang]}
        </p>
        
        {/* Absolute corner markers - wider for 5 chars */}
        {[1, 2, 3, 4].map(pid => {
          const playerInRoom = players.find(p => p.id === pid && p.currentRoomId === roomId);
          return (
            <AnimatePresence key={pid}>
              {playerInRoom && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className={`absolute px-2 h-10 min-w-[48px] max-w-[70px] rounded-full border-[3px] border-white flex items-center justify-center text-[11px] font-black z-20 text-white ${isDarkMode ? 'shadow-[0_4px_12px_rgba(0,0,0,0.5)]' : 'shadow-xl'}`}
                  style={{ 
                    backgroundColor: playerInRoom.color,
                    ...getMarkerPosition(pid)
                  }}
                >
                  <span className="truncate">{playerInRoom.name}</span>
                </motion.div>
              )}
            </AnimatePresence>
          );
        })}
      </motion.div>
    );
  };

  return (
    <div className={`h-[100dvh] transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-[#FDFBF7] text-slate-900'} px-3 py-3 font-sans selection:bg-indigo-100 overflow-hidden flex flex-col relative`}>
      {/* Top Left Menu Button */}
      <button 
        onClick={() => setIsMenuOpen(true)}
        className={`fixed top-3 left-3 z-[60] p-2 rounded-full border active:scale-90 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 shadow-none' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 shadow-sm'}`}
        aria-label="メニュー"
      >
        <Menu size={16} />
      </button>

      {/* Top Right Reset Button */}
      <button 
        onClick={() => setShowResetConfirm(true)}
        className={`fixed top-3 right-3 z-50 p-2 rounded-full border active:scale-90 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300 shadow-none' : 'bg-white border-slate-200 text-slate-400 hover:text-red-500 shadow-sm'}`}
        aria-label="リセット"
      >
        <RefreshCw size={16} />
      </button>

      {/* Sidebar Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed top-0 left-0 bottom-0 w-4/5 max-w-xs z-[80] shadow-2xl flex flex-col p-6 overflow-y-auto ${isDarkMode ? 'bg-slate-900 border-r border-slate-800' : 'bg-white'}`}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="relative">
                  <h2 
                    className={`text-2xl font-bold tracking-tight transition-all duration-300 ${isDarkMode ? 'text-white' : 'text-black'}`}
                  >
                    {isEnglish ? 'INITIATIVE' : 'イニシアチブ'}
                  </h2>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className={`p-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <section>
                  <h3 className={`text-[10px] uppercase font-bold tracking-widest mb-3 flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Target size={12} /> {t.settings[lang]}
                  </h3>
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <Lock size={14} className="text-indigo-500" /> {t.preventLockLabel[lang]}
                      </div>
                      <div className="flex gap-1 bg-slate-200/50 p-1 rounded-lg scale-90">
                        <button 
                          onClick={() => setPreventLock(true)}
                          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${preventLock ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}
                        >{t.on[lang]}</button>
                        <button 
                          onClick={() => setPreventLock(false)}
                          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${!preventLock ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                        >{t.off[lang]}</button>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <Moon size={14} className="text-indigo-500" /> {t.darkModeLabel[lang]}
                      </div>
                      <div className="flex gap-1 bg-slate-200/50 p-1 rounded-lg scale-90">
                        <button 
                          onClick={() => setIsDarkMode(true)}
                          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${isDarkMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}
                        >{t.on[lang]}</button>
                        <button 
                          onClick={() => setIsDarkMode(false)}
                          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${!isDarkMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                        >{t.off[lang]}</button>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between p-3 rounded-xl border ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <Globe size={14} className="text-indigo-500" /> {t.englishLabel[lang]}
                      </div>
                      <div className="flex gap-1 bg-slate-200/50 p-1 rounded-lg scale-90">
                        <button 
                          onClick={() => setIsEnglish(true)}
                          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${isEnglish ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}
                        >{t.on[lang]}</button>
                        <button 
                          onClick={() => setIsEnglish(false)}
                          className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${!isEnglish ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                        >{t.off[lang]}</button>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={`text-[10px] uppercase font-bold tracking-widest mb-3 flex items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Info size={12} /> {t.aboutTitle[lang]}
                  </h3>
                  <div className={`p-4 rounded-xl border text-[9px] leading-relaxed font-bold ${isDarkMode ? 'border-slate-800 bg-slate-800/50 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
                    <p>{t.aboutText[lang]}</p>
                  </div>
                </section>

                <section className="pt-2">
                   <a 
                    href="https://twitter.com/masudaMtg" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold active:scale-95 transition-all ${isDarkMode ? 'shadow-none border border-slate-800' : 'shadow-lg shadow-indigo-200/20'}`}
                   >
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> @masudaMtg
                   </a>
                </section>
              </div>

              <div className="mt-auto pt-8 flex justify-center">
                 <p className="text-[10px] font-black tracking-tighter opacity-10 uppercase italic">INITIATIVE v1.1</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reset Confirmation Dialog */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`rounded-2xl shadow-2xl p-6 w-full max-w-xs text-center border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            >
              <h2 className="text-lg font-bold mb-2">{t.resetTitle[lang]}</h2>
              <p className={`text-sm mb-6 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.resetMsg[lang]}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                >
                  {t.cancel[lang]}
                </button>
                <button 
                  onClick={confirmReset}
                  className={`flex-1 py-3 px-4 rounded-xl text-white font-bold text-sm ${isDarkMode ? 'bg-red-600 shadow-none' : 'bg-red-500 shadow-lg shadow-red-200'}`}
                >
                  {t.yes[lang]}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="max-w-md mx-auto w-full mb-1 flex-shrink-0">
        <header className="flex flex-col items-center justify-center">
          <h1 className="text-2xl font-black tracking-tighter">{t.title[lang]}</h1>
          <p className={`text-[9px] font-medium text-center leading-tight whitespace-nowrap ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            {t.subtitle[lang]}
          </p>
        </header>
      </div>

      {/* Dungeon Grid - flex-grow to take vertical space if needed */}
      <div className="max-w-md mx-auto w-full flex-grow flex flex-col py-1 overflow-visible gap-1">
        {/* Level 1 */}
        <div className="flex justify-center flex-shrink-0 flex-1 min-h-0">
          <div className="w-full px-5">{renderRoom('entrance')}</div>
        </div>

        <div className={`flex justify-center h-2 items-center flex-shrink-0 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}>
          <ChevronDown size={14} />
        </div>

        {/* Level 2 */}
        <div className="flex justify-center gap-5 px-3 flex-shrink-0 flex-1 min-h-0">
          <div className="flex-1">{renderRoom('forge')}</div>
          <div className="flex-1">{renderRoom('well')}</div>
        </div>

        <div className={`flex justify-center gap-5 h-2 items-center flex-shrink-0 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}>
           <div className="flex-1 flex justify-center"><ChevronDown size={14} /></div>
           <div className="flex-1 flex justify-center"><ChevronDown size={14} /></div>
        </div>

        {/* Level 3 */}
        <div className="flex justify-center gap-3 px-2 flex-shrink-0 flex-1 min-h-0">
          <div className="flex-1">{renderRoom('trap')}</div>
          <div className="flex-1">{renderRoom('arena')}</div>
          <div className="flex-1">{renderRoom('secret_room')}</div>
        </div>

        <div className={`flex justify-center gap-3 h-2 items-center flex-shrink-0 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}>
           <div className="flex-1 flex justify-center"><ChevronDown size={14} /></div>
           <div className="flex-1 flex justify-center"><ChevronDown size={14} /></div>
           <div className="flex-1 flex justify-center"><ChevronDown size={14} /></div>
        </div>

        {/* Level 4 */}
        <div className="flex justify-center gap-5 px-3 flex-shrink-0 flex-1 min-h-0">
          <div className="flex-1">{renderRoom('archives')}</div>
          <div className="flex-1">{renderRoom('catacombs')}</div>
        </div>

        <div className={`flex justify-center h-2 items-center flex-shrink-0 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}>
          <ChevronDown size={14} />
        </div>

        {/* Level 5 */}
        <div className="flex justify-center flex-shrink-0 flex-1 min-h-0">
          <div className="w-full px-5">{renderRoom('throne')}</div>
        </div>
      </div>

      {/* Player Selector */}
      <div className="max-w-md mx-auto w-full mt-2 grid grid-cols-4 gap-1.5 flex-shrink-0 mb-1 px-1">
        {players.map(p => (
          <div 
            key={p.id}
            className={`flex flex-col p-1.5 rounded-lg border-2 transition-all duration-300
              ${activePlayerId === p.id 
                ? isDarkMode ? 'border-indigo-500 bg-slate-800 shadow-none' : 'border-indigo-500 bg-white ring-1 ring-indigo-50 shadow-sm' 
                : isDarkMode ? 'border-slate-800 bg-slate-800/40 opacity-50 shadow-none' : 'border-slate-100 bg-white/60 opacity-80 shadow-sm'}
            `}
            onClick={() => {
              setActivePlayerId(p.id);
              if (activePlayerId !== p.id) setEditingPlayerId(null);
            }}
          >
            <div className="flex items-center gap-1 mb-1">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: p.color }} />
              {editingPlayerId === p.id ? (
                <input
                  autoFocus
                  className="bg-transparent border-b border-indigo-400 text-[10px] w-full focus:outline-none font-bold py-0"
                  value={p.name}
                  onChange={(e) => updatePlayerName(p.id, e.target.value)}
                  onBlur={() => setEditingPlayerId(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingPlayerId(null)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="flex items-center justify-between w-full overflow-hidden">
                  <span className={`text-[10px] font-black truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{p.name}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPlayerId(p.id);
                    }}
                    className="p-0.5 text-slate-400 hover:text-indigo-600 flex-shrink-0"
                  >
                    <Edit2 size={8} />
                  </button>
                </div>
              )}
            </div>
            <div className={`text-[8px] font-bold bg-indigo-50 px-1 py-0.5 rounded self-start truncate max-w-full ${isDarkMode ? 'text-indigo-400 bg-indigo-900/40' : 'text-indigo-600'}`}>
              {p.currentRoomId ? ROOMS.find(r => r.id === p.currentRoomId)?.name[lang] : t.standby[lang]}
            </div>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Outfit:wght@400;700;800;900&display=swap');
        
        :root {
          font-family: 'Outfit', 'Inter', sans-serif;
        }

        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        body {
          background-image: 
            linear-gradient(${isDarkMode ? 'rgba(51, 65, 85, 0.1)' : 'rgba(148, 163, 184, 0.05)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isDarkMode ? 'rgba(51, 65, 85, 0.1)' : 'rgba(148, 163, 184, 0.05)'} 1px, transparent 1px);
          background-size: 30px 30px;
          overscroll-behavior-y: none;
        }
      `}} />
    </div>
  );
}
