import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
  Send,
  Trash2,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  Code2,
  HelpCircle,
  Radio,
  Sparkles,
  Layers,
  X,
  Volume2,
  ToggleLeft,
  ToggleRight,
  Wrench,
  FileCode,
  Globe,
  Info,
  ArrowRight,
  BellOff,
  FastForward,
} from 'lucide-react';
import {
  nxpSerial,
  NxpConnectionState,
  NxpSerialLog,
  NxpBoardConfig,
  DEFAULT_NXP_CONFIG,
} from '../lib/nxpSerialService';
import {
  NXP_MPC5748G_C_MAIN,
  NXP_MPC5748G_SPECS,
  NXP_STEP_BY_STEP_GUIDE,
  NXP_TROUBLESHOOTING_CASES,
  NXP_PYTHON_BRIDGE_CODE,
} from '../data/nxpFirmwareCode';

interface NxpBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryColor?: string;
  onTaskCompleteByHardware?: () => void;
  onNextTrackByHardware?: () => void;
  onSnoozeByHardware?: () => void;
  onCycleModeByHardware?: (mode?: string) => void;
}

export const NxpBoardModal: React.FC<NxpBoardModalProps> = ({
  isOpen,
  onClose,
  primaryColor = '#C1876B',
  onTaskCompleteByHardware,
  onNextTrackByHardware,
  onSnoozeByHardware,
  onCycleModeByHardware,
}) => {
  const [activeTab, setActiveTab] = useState<'buttons_leds' | 'troubleshoot' | 'python' | 'terminal' | 'firmware' | 'guide'>('buttons_leds');
  const [connectionState, setConnectionState] = useState<NxpConnectionState>(nxpSerial.getState());
  const [logs, setLogs] = useState<NxpSerialLog[]>(nxpSerial.getLogs());
  const [config, setConfig] = useState<NxpBoardConfig>(nxpSerial.getConfig());
  const [customCmd, setCustomCmd] = useState<string>('');
  const [isCopiedCode, setIsCopiedCode] = useState<boolean>(false);
  const [isCopiedPython, setIsCopiedPython] = useState<boolean>(false);
  const [lastTriggeredAlert, setLastTriggeredAlert] = useState<string | null>(null);
  const [customWsUrl, setCustomWsUrl] = useState<string>('ws://localhost:8765');
  
  // Virtual LED visual simulation states
  const [virtualDs4, setVirtualDs4] = useState<boolean>(false);
  const [virtualDs5, setVirtualDs5] = useState<boolean>(false);
  const [simulatedPattern, setSimulatedPattern] = useState<string>('SM_PINGPONG');
  const [lastPressedBtn, setLastPressedBtn] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to serial state, logs, and incoming button packets
  useEffect(() => {
    const unsubState = nxpSerial.subscribeState(setConnectionState);
    const unsubLogs = nxpSerial.subscribeLogs(setLogs);
    const unsubRx = nxpSerial.subscribeRx((rawCmd) => {
      const cmd = rawCmd.toUpperCase().trim();

      // SW1: Task Complete
      // Matches: SW1_PA3, SW1, PA3, TASK_COMPLETE, SW1_PRESSED, BTN:SW1, etc. (excluding SW1 RESET)
      if (
        (cmd.includes('SW1_PA3') ||
          cmd.includes('PA3') ||
          cmd.includes('BTN:SW1') ||
          cmd.includes('TASK_COMPLETE') ||
          cmd.includes('SW1_PRESSED') ||
          cmd.includes('BUTTON_1') ||
          cmd.includes('BTN1') ||
          cmd === 'SW1' ||
          cmd === '1') &&
        !cmd.includes('RESET')
      ) {
        setLastPressedBtn('SW1 (SW1_PA3)');
        setTimeout(() => setLastPressedBtn(null), 2000);
        triggerVirtualPattern('SUCCESS');
        if (onTaskCompleteByHardware) {
          onTaskCompleteByHardware();
        }
      }
      // SW2: Next Track Focus
      // Matches: SW2_PE12, SW2, PE12, NEXT_TRACK, SW2_PRESSED, BTN:SW2, etc.
      else if (
        cmd.includes('SW2_PE12') ||
        cmd.includes('PE12') ||
        cmd.includes('SW2') ||
        cmd.includes('BTN:SW2') ||
        cmd.includes('NEXT_TRACK') ||
        cmd.includes('SW2_PRESSED') ||
        cmd.includes('BUTTON_2') ||
        cmd.includes('BTN2') ||
        cmd === '2'
      ) {
        setLastPressedBtn('SW2 (SW2_PE12)');
        setTimeout(() => setLastPressedBtn(null), 2000);
        if (onNextTrackByHardware) {
          onNextTrackByHardware();
        }
      }
      // SW3: Snooze / Alert Dismiss
      // Matches: SW3 ROOT, ROOT, SW3_ROOT, PE14, SW3, SNOOZE, SW3_PRESSED, BTN:SW3, etc.
      else if (
        cmd.includes('SW3 ROOT') ||
        cmd.includes('SW3_ROOT') ||
        cmd.includes('ROOT') ||
        cmd.includes('PE14') ||
        cmd.includes('SW3') ||
        cmd.includes('BTN:SW3') ||
        cmd.includes('SNOOZE') ||
        cmd.includes('SW3_PRESSED') ||
        cmd.includes('BUTTON_3') ||
        cmd.includes('BTN3') ||
        cmd === '3'
      ) {
        setLastPressedBtn('SW3 (SW3 ROOT)');
        setTimeout(() => setLastPressedBtn(null), 2000);
        triggerVirtualPattern('OFF');
        if (onSnoozeByHardware) {
          onSnoozeByHardware();
        }
      }
      // SW4: Cycle LED Blinking Pattern & Mode
      // Matches: SW4 1, SW4_1, SW4, PE13, PA0, CYCLE_MODE, SW4_PRESSED, BTN:SW4, etc.
      else if (
        cmd.includes('SW4 1') ||
        cmd.includes('SW4_1') ||
        cmd.includes('PE13') ||
        cmd.includes('SW4') ||
        cmd.includes('BTN:SW4') ||
        cmd.includes('CYCLE_MODE') ||
        cmd.includes('SW4_PRESSED') ||
        cmd.includes('PATTERN') ||
        cmd.includes('BUTTON_4') ||
        cmd.includes('BTN4') ||
        cmd === '4'
      ) {
        setLastPressedBtn('SW4 (SW4 1)');
        setTimeout(() => setLastPressedBtn(null), 2000);
        if (onCycleModeByHardware) {
          onCycleModeByHardware();
        }
      }
      // MCU RESET Detection (SW1 RESET)
      else if (cmd.includes('RESET') || cmd.includes('SW1 RESET')) {
        setLastPressedBtn('RESET (SW1 RESET)');
        setTimeout(() => setLastPressedBtn(null), 2500);
        triggerVirtualPattern('SM_PINGPONG');
      }
    });

    return () => {
      unsubState();
      unsubLogs();
      unsubRx();
    };
  }, [onTaskCompleteByHardware, onNextTrackByHardware, onSnoozeByHardware, onCycleModeByHardware]);

  // Auto-scroll terminal
  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (connectionState === 'connected') {
      await nxpSerial.disconnect();
    } else {
      await nxpSerial.connect();
    }
  };

  const handleConnectWs = async () => {
    if (connectionState === 'connected') {
      await nxpSerial.disconnect();
    } else {
      await nxpSerial.connectWsBridge(customWsUrl);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handleSendCustom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customCmd.trim()) return;
    await nxpSerial.sendRaw(customCmd.trim());
    setCustomCmd('');
  };

  // Virtual LED visual animator
  const triggerVirtualPattern = (pattern: 'CODING_DS4' | 'HINT_DS5' | 'SM_PINGPONG' | 'TOEIC_SYNC' | 'SUCCESS' | 'OFF') => {
    setSimulatedPattern(pattern);
    if (pattern === 'OFF') {
      setVirtualDs4(false);
      setVirtualDs5(false);
      return;
    }

    if (pattern === 'CODING_DS4') {
      // DS4 4x Fast flash
      let count = 0;
      const interval = setInterval(() => {
        setVirtualDs4((p) => !p);
        setVirtualDs5(false);
        count++;
        if (count >= 8) {
          clearInterval(interval);
          setVirtualDs4(true);
        }
      }, 130);
    } else if (pattern === 'HINT_DS5') {
      // DS5 3x Steady flash
      let count = 0;
      const interval = setInterval(() => {
        setVirtualDs5((p) => !p);
        setVirtualDs4(false);
        count++;
        if (count >= 6) {
          clearInterval(interval);
          setVirtualDs5(true);
        }
      }, 220);
    } else if (pattern === 'SM_PINGPONG') {
      // DS4 <-> DS5 Ping-Pong
      let count = 0;
      const interval = setInterval(() => {
        if (count % 2 === 0) {
          setVirtualDs4(true);
          setVirtualDs5(false);
        } else {
          setVirtualDs4(false);
          setVirtualDs5(true);
        }
        count++;
        if (count >= 8) {
          clearInterval(interval);
          setVirtualDs4(false);
          setVirtualDs5(false);
        }
      }, 160);
    } else if (pattern === 'TOEIC_SYNC') {
      // DS4 + DS5 Synchronous dual flash
      let count = 0;
      const interval = setInterval(() => {
        setVirtualDs4((p) => !p);
        setVirtualDs5((p) => !p);
        count++;
        if (count >= 6) {
          clearInterval(interval);
          setVirtualDs4(false);
          setVirtualDs5(false);
        }
      }, 200);
    } else if (pattern === 'SUCCESS') {
      // DS4 + DS5 Rapid double flash
      let count = 0;
      const interval = setInterval(() => {
        setVirtualDs4((p) => !p);
        setVirtualDs5((p) => !p);
        count++;
        if (count >= 4) {
          clearInterval(interval);
          setVirtualDs4(false);
          setVirtualDs5(false);
        }
      }, 90);
    }
  };

  const handleTestTrackPattern = async (
    pattern: 'CODING_DS4' | 'HINT_DS5' | 'SM_PINGPONG' | 'TOEIC_SYNC' | 'SUCCESS',
    title: string
  ) => {
    setLastTriggeredAlert(title);
    triggerVirtualPattern(pattern);
    await nxpSerial.setBoardPattern(pattern);
    setTimeout(() => setLastTriggeredAlert(null), 3000);
  };

  const handleSimulateButton = (btn: 'SW1' | 'SW2' | 'SW3' | 'SW4') => {
    setLastPressedBtn(btn);
    setTimeout(() => setLastPressedBtn(null), 1800);

    if (btn === 'SW1' && onTaskCompleteByHardware) {
      triggerVirtualPattern('SUCCESS');
      onTaskCompleteByHardware();
    } else if (btn === 'SW2' && onNextTrackByHardware) {
      onNextTrackByHardware();
    } else if (btn === 'SW3' && onSnoozeByHardware) {
      triggerVirtualPattern('OFF');
      onSnoozeByHardware();
    } else if (btn === 'SW4' && onCycleModeByHardware) {
      onCycleModeByHardware();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(NXP_MPC5748G_C_MAIN);
    setIsCopiedCode(true);
    setTimeout(() => setIsCopiedCode(false), 2500);
  };

  const handleCopyPython = () => {
    navigator.clipboard.writeText(NXP_PYTHON_BRIDGE_CODE);
    setIsCopiedPython(true);
    setTimeout(() => setIsCopiedPython(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-[#FDFCF9] w-full max-w-4xl max-h-[94vh] rounded-2xl border border-stone-300 shadow-2xl flex flex-col overflow-hidden text-stone-800">
        {/* 1. Modal Header & Device Identifier */}
        <div className="p-4 sm:p-5 bg-white border-b border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-300 flex items-center justify-center shrink-0 border border-stone-700 shadow-xs">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900">
                  NXP Semiconductors DEVKIT-MPC5748G
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Onboard LED (DS4/PA10, DS5/PA7) & SW1~SW4
                </span>
              </div>
              <div className="flex items-center space-x-2.5 text-xs text-stone-500 font-mono mt-0.5 flex-wrap">
                <span>PUID: <strong className="text-stone-700">1YUSEOAX224803</strong></span>
                <span>LOT: <strong className="text-stone-700">EOAX224803</strong></span>
                <span>CODE: <strong className="text-stone-700">9353 275 78598</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Open in new tab button */}
            <button
              onClick={handleOpenInNewTab}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-all flex items-center space-x-1"
              title="iframe 샌드박스 제한 없이 Web Serial을 완벽히 사용하기 위해 새 탭에서 엽니다"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">새 탭에서 열기</span>
            </button>

            {/* Connect / Disconnect button */}
            <button
              onClick={handleConnect}
              disabled={connectionState === 'connecting' || connectionState === 'unsupported'}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs ${
                connectionState === 'connected'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : connectionState === 'connecting'
                  ? 'bg-amber-500 text-white cursor-wait'
                  : 'bg-stone-900 hover:bg-stone-800 text-amber-200'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${connectionState === 'connected' ? 'fill-current' : ''}`} />
              <span>
                {connectionState === 'connected'
                  ? '보드 연결 해제'
                  : connectionState === 'connecting'
                  ? '포트 연결 중...'
                  : 'NXP 보드 연결 (USB J10)'}
              </span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Connection Status Ribbon */}
        <div className="px-5 py-2 bg-stone-100 border-b border-stone-200 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-stone-600">통신 상태:</span>
            {connectionState === 'connected' && (
              <span className="inline-flex items-center space-x-1.5 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>NXP 보드 연동됨 ({nxpSerial.getTransport() === 'wsbridge' ? 'Python WebSocket Bridge' : `OpenSDA VCOM ${config.baudRate}`})</span>
              </span>
            )}
            {connectionState === 'disconnected' && (
              <span className="text-stone-500 font-medium bg-stone-200/80 px-2.5 py-0.5 rounded-full">
                연결 대기 중 (USB J10 포트 연결 후 상단 버튼 클릭)
              </span>
            )}
            {connectionState === 'connecting' && (
              <span className="text-amber-700 font-medium bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 animate-pulse">
                포트 연결 시도 중...
              </span>
            )}
            {connectionState === 'unsupported' && (
              <span className="text-rose-700 font-medium bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                브라우저 Web Serial 미지원 (Chrome / Edge 권장 또는 Python 브릿지 이용)
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-stone-500 font-mono">
            <label className="flex items-center space-x-1 cursor-pointer">
              <span>Baud:</span>
              <select
                value={config.baudRate}
                onChange={(e) => nxpSerial.updateConfig({ baudRate: Number(e.target.value) })}
                disabled={connectionState === 'connected'}
                className="bg-white border border-stone-300 rounded px-1.5 py-0.5 text-xs text-stone-800 font-mono disabled:opacity-50"
              >
                <option value={115200}>115200</option>
                <option value={57600}>57600</option>
                <option value={38400}>38400</option>
                <option value={9600}>9600</option>
              </select>
            </label>

            <button
              onClick={() => {
                const toggled = !config.autoAlertEnabled;
                nxpSerial.updateConfig({ autoAlertEnabled: toggled });
                setConfig(nxpSerial.getConfig());
              }}
              className="flex items-center space-x-1 hover:text-stone-900 transition-colors"
              title="플래너 일정 알림 시 NXP 보드 LED 자동 점등 여부"
            >
              {config.autoAlertEnabled ? (
                <ToggleRight className="w-4 h-4 text-teal-600" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-stone-400" />
              )}
              <span>자동 알림 {config.autoAlertEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* 3. Navigation Tabs */}
        <div className="flex border-b border-stone-200 bg-white px-5 space-x-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'buttons_leds', label: '🕹️ 온보드 LED (DS4/DS5) & 4대 버튼 (SW1~SW4)', icon: Radio, badge: '실시간 연동' },
            { id: 'troubleshoot', label: '🔧 "호환 기기 없음" 해결 & 진단', icon: Wrench },
            { id: 'python', label: '🐍 Python 로컬 브릿지 (100% 우회)', icon: FileCode },
            { id: 'terminal', label: '📟 시리얼 터미널 & 로그', icon: Terminal },
            { id: 'firmware', label: '💻 C 펌웨어 소스 (S32DS)', icon: Code2 },
            { id: 'guide', label: '📖 MPC5748G 핀맵 매뉴얼', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 px-2 flex items-center space-x-1.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  isActive
                    ? 'border-stone-900 text-stone-900 font-bold'
                    : 'border-transparent text-stone-400 hover:text-stone-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-700' : 'text-stone-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 4. Tab Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-[#FAF8F5] space-y-5">
          {/* TAB 1: ONBOARD LEDS & 4-BUTTON HARDWARE CONTROLLER */}
          {activeTab === 'buttons_leds' && (
            <div className="space-y-5">
              {/* Virtual Hardware Board Live Visualizer */}
              <div className="p-5 rounded-2xl bg-stone-900 text-white border border-stone-800 shadow-md relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-800 pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h4 className="text-sm font-mono font-bold text-amber-300">
                        DEVKIT-MPC5748G 온보드 하드웨어 상태 뷰어
                      </h4>
                    </div>
                    <p className="text-xs text-stone-400 font-sans mt-0.5">
                      외부 LED 없이도 보드에 실장된 <strong>DS4(PA10), DS5(PA7)</strong> SMD LED와 <strong>SW1~SW4</strong> 버튼으로 플래너가 동작합니다.
                    </p>
                  </div>

                  {/* Virtual SMD LEDs */}
                  <div className="flex items-center space-x-4 bg-stone-950/80 px-4 py-2 rounded-xl border border-stone-800">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center text-[9px] font-mono font-bold ${
                          virtualDs4
                            ? 'bg-amber-400 border-amber-300 text-stone-950 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-pulse'
                            : 'bg-stone-800 border-stone-700 text-stone-500'
                        }`}
                      >
                        DS4
                      </div>
                      <span className="text-[11px] font-mono text-stone-300">PA10</span>
                    </div>

                    <div className="w-px h-5 bg-stone-800" />

                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center text-[9px] font-mono font-bold ${
                          virtualDs5
                            ? 'bg-teal-400 border-teal-300 text-stone-950 shadow-[0_0_12px_rgba(45,212,191,0.9)] animate-pulse'
                            : 'bg-stone-800 border-stone-700 text-stone-500'
                        }`}
                      >
                        DS5
                      </div>
                      <span className="text-[11px] font-mono text-stone-300">PA7</span>
                    </div>
                  </div>
                </div>

                {/* 4 Physical Buttons Simulation & Trigger Bar */}
                <div className="mt-4 space-y-2">
                  <span className="text-xs font-mono font-bold text-stone-300 flex items-center justify-between">
                    <span>🔘 온보드 물리 버튼 동작 (보드의 실제 버튼을 누르거나 아래 버튼을 클릭하여 테스트)</span>
                    {lastPressedBtn && (
                      <span className="text-amber-400 font-bold animate-bounce">
                        [{lastPressedBtn} 신호 감지됨!]
                      </span>
                    )}
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* SW1 */}
                    <button
                      onClick={() => handleSimulateButton('SW1')}
                      className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                        lastPressedBtn?.includes('SW1')
                          ? 'bg-emerald-950 border-emerald-400 ring-2 ring-emerald-400/50 text-white'
                          : 'bg-stone-800/80 hover:bg-stone-800 border-stone-700 text-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold font-mono text-emerald-400">SW1 (SW1_PA3)</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-xs font-bold text-white">🎯 일정/루틴 완료 체크</div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        오늘의 첫 번째 미완료 일정 자동 완료 + DS4+DS5 2회 점멸
                      </p>
                    </button>

                    {/* SW2 */}
                    <button
                      onClick={() => handleSimulateButton('SW2')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        lastPressedBtn?.includes('SW2')
                          ? 'bg-blue-950 border-blue-400 ring-2 ring-blue-400/50 text-white'
                          : 'bg-stone-800/80 hover:bg-stone-800 border-stone-700 text-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold font-mono text-blue-400">SW2 (SW2_PE12)</span>
                        <FastForward className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-xs font-bold text-white">⏭️ 다음 화면/트랙 전환</div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        SM로드맵 ↔ 플래너 ↔ 루틴 ↔ 다이어리 화면 순환
                      </p>
                    </button>

                    {/* SW3 */}
                    <button
                      onClick={() => handleSimulateButton('SW3')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        lastPressedBtn?.includes('SW3')
                          ? 'bg-rose-950 border-rose-400 ring-2 ring-rose-400/50 text-white'
                          : 'bg-stone-800/80 hover:bg-stone-800 border-stone-700 text-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold font-mono text-rose-400">SW3 (SW3 ROOT)</span>
                        <BellOff className="w-4 h-4 text-rose-400" />
                      </div>
                      <div className="text-xs font-bold text-white">🔕 알림 스누즈 & LED 끄기</div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        현재 울리는 일정 알림 10분 스누즈 및 온보드 LED 소등
                      </p>
                    </button>

                    {/* SW4 */}
                    <button
                      onClick={() => handleSimulateButton('SW4')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        lastPressedBtn?.includes('SW4')
                          ? 'bg-amber-950 border-amber-400 ring-2 ring-amber-400/50 text-white'
                          : 'bg-stone-800/80 hover:bg-stone-800 border-stone-700 text-stone-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold font-mono text-amber-400">SW4 (SW4 1)</span>
                        <RotateCcw className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-xs font-bold text-white">🔄 LED 패턴 순환 & 모드</div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        DS4, DS5 점멸 패턴을 순환하며 4대 트랙 상태 확인
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4-Pillars Track Alert & Blinking Pattern Matrix */}
              <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-serif font-bold text-stone-900 flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>4대 트랙 온보드 LED 점멸 패턴 (DS4/PA10, DS5/PA7)</span>
                    </h4>
                    <p className="text-xs text-stone-500 font-sans mt-0.5">
                      각 트랙의 일정 시간이 되면 보드의 DS4, DS5가 고유한 패턴으로 점멸하여 알림을 전달합니다.
                    </p>
                  </div>
                  {lastTriggeredAlert && (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 text-xs font-bold rounded-lg animate-bounce border border-emerald-300">
                      신호 송신: {lastTriggeredAlert}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 1. 코딩테스트: DS4 단독 4회 고속 점멸 */}
                  <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-900">🔴 코딩테스트 알림</span>
                        <span className="text-[10px] bg-teal-200 text-teal-900 px-1.5 py-0.5 rounded font-mono font-bold">
                          DS4 (PA10)
                        </span>
                      </div>
                      <p className="text-[11px] text-teal-700 mt-1 leading-snug">
                        08:00 코드업 100제 & 백준 2문제 풀이
                      </p>
                      <div className="mt-2 text-[10px] text-teal-800 font-mono bg-teal-100/70 px-2 py-1 rounded">
                        💡 DS4 단독 4회 고속 점멸
                      </div>
                    </div>
                    <button
                      onClick={() => handleTestTrackPattern('CODING_DS4', '코딩테스트 (DS4 4회 점멸)')}
                      className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>신호 전송 & 시뮬레이션</span>
                    </button>
                  </div>

                  {/* 2. HINT 교육: DS5 단독 3회 점멸 */}
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-900">🎓 HINT 교육 알림</span>
                        <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-mono font-bold">
                          DS5 (PA7)
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-700 mt-1 leading-snug">
                        09:00 HINT 온디바이스 AI / 임베디드 실습
                      </p>
                      <div className="mt-2 text-[10px] text-blue-800 font-mono bg-blue-100/70 px-2 py-1 rounded">
                        💡 DS5 단독 3회 점멸
                      </div>
                    </div>
                    <button
                      onClick={() => handleTestTrackPattern('HINT_DS5', 'HINT 교육 (DS5 3회 점멸)')}
                      className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>신호 전송 & 시뮬레이션</span>
                    </button>
                  </div>

                  {/* 3. SM 개발: DS4 <-> DS5 교차 핑퐁 점멸 */}
                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-900">🚀 SM 개발 알림</span>
                        <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded font-mono font-bold">
                          DS4 ↔ DS5
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-700 mt-1 leading-snug">
                        18:30 Jetson / ROS2 / fingense 개발
                      </p>
                      <div className="mt-2 text-[10px] text-purple-800 font-mono bg-purple-100/70 px-2 py-1 rounded">
                        💡 DS4 ↔ DS5 번갈아 핑퐁 점멸
                      </div>
                    </div>
                    <button
                      onClick={() => handleTestTrackPattern('SM_PINGPONG', 'SM 로드맵 (DS4 ↔ DS5 교차 점멸)')}
                      className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>신호 전송 & 시뮬레이션</span>
                    </button>
                  </div>

                  {/* 4. TOEIC: DS4 + DS5 동시 동기 점멸 */}
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-900">🎯 TOEIC 800 알림</span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">
                          DS4 + DS5
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mt-1 leading-snug">
                        20:00 기출 단어 40개 & RC/LC 풀이
                      </p>
                      <div className="mt-2 text-[10px] text-emerald-800 font-mono bg-emerald-100/70 px-2 py-1 rounded">
                        💡 DS4 + DS5 동시 동기 점멸
                      </div>
                    </div>
                    <button
                      onClick={() => handleTestTrackPattern('TOEIC_SYNC', 'TOEIC 800 (DS4+DS5 동시 점멸)')}
                      className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>신호 전송 & 시뮬레이션</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Pin Controls */}
              <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
                <h4 className="text-sm font-serif font-bold text-stone-900 flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-stone-700" />
                  <span>수동 온보드 LED 직접 점등 및 소등 (PA10, PA7)</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    onClick={() => {
                      setVirtualDs4(true);
                      nxpSerial.setOnboardLed('DS4', 'ON');
                    }}
                    className="p-3 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all"
                  >
                    <span className="w-3.5 h-3.5 rounded bg-amber-400" />
                    <span>DS4 (PA10) 켜기</span>
                  </button>

                  <button
                    onClick={() => {
                      setVirtualDs5(true);
                      nxpSerial.setOnboardLed('DS5', 'ON');
                    }}
                    className="p-3 rounded-xl bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-900 text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all"
                  >
                    <span className="w-3.5 h-3.5 rounded bg-teal-400" />
                    <span>DS5 (PA7) 켜기</span>
                  </button>

                  <button
                    onClick={() => handleTestTrackPattern('SUCCESS', 'DS4+DS5 빠른 2회 점멸')}
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-900 text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>완료 피드백 (2회 점멸)</span>
                  </button>

                  <button
                    onClick={() => {
                      triggerVirtualPattern('OFF');
                      nxpSerial.setOnboardLed('ALL', 'OFF');
                    }}
                    className="p-3 rounded-xl bg-stone-100 border border-stone-300 hover:bg-stone-200 text-stone-700 text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all"
                  >
                    <span className="w-3.5 h-3.5 rounded bg-stone-400" />
                    <span>LED 전체 끄기 (OFF)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TROUBLESHOOTING ('호환 기기 없음' 해결 마법사) */}
          {activeTab === 'troubleshoot' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-serif font-bold text-stone-900 flex items-center space-x-2">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      <span>소리는 나고 보드 전원 불은 들어오는데 "호환되는 기기가 없습니다"가 뜨는 원인 점검</span>
                    </h4>
                    <p className="text-xs text-stone-500 mt-1">
                      PC가 USB 전원(5V)을 공급하여 보드 불과 띠링 소리는 나지만, 데이터 COM 포트(VCOM)가 정상 열리지 않은 상태입니다. 아래 항목을 순서대로 확인해 보세요.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenInNewTab}
                    className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl flex items-center space-x-1 shrink-0 shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>새 탭에서 열기 (권장)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {NXP_TROUBLESHOOTING_CASES.map((item, idx) => (
                  <div key={item.id} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-stone-900 flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-stone-900 text-amber-300 font-mono text-[11px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <span>{item.title}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed font-sans pl-7">
                      {item.description}
                    </p>
                    <div className="pl-7 pt-1">
                      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs font-bold text-amber-950 flex items-center justify-between flex-wrap gap-2">
                        <span>{item.action}</span>
                        {item.id === 'iframe_sandbox' && (
                          <button
                            onClick={handleOpenInNewTab}
                            className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-amber-200 rounded-lg text-xs font-bold flex items-center space-x-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>새 탭 열기</span>
                          </button>
                        )}
                        {item.id === 'port_location' && (
                          <span className="text-[11px] font-mono text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                            보드 각인: J10 (OpenSDA)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: PYTHON LOCAL BRIDGE */}
          {activeTab === 'python' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-serif font-bold text-stone-900 flex items-center space-x-2">
                      <FileCode className="w-4 h-4 text-teal-700" />
                      <span>Python 로컬 브릿지 모드 (Web Serial 완벽 대체)</span>
                    </h4>
                    <p className="text-xs text-stone-500 mt-1">
                      브라우저 드라이버 문제나 iframe 제약 없이, PC에서 가상 COM 포트를 직접 열어 본 플래너와 실시간 WebSocket으로 연동합니다.
                    </p>
                  </div>

                  <button
                    onClick={handleCopyPython}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-amber-100 transition-all flex items-center space-x-1.5 shrink-0 shadow-xs"
                  >
                    {isCopiedPython ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedPython ? 'nxp_bridge.py 복사됨!' : 'Python 스크립트 복사'}</span>
                  </button>
                </div>

                {/* Connection Box */}
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 text-xs font-mono">
                    <span className="text-stone-600 font-sans font-bold">브릿지 URL:</span>
                    <input
                      type="text"
                      value={customWsUrl}
                      onChange={(e) => setCustomWsUrl(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-900 text-xs font-mono w-48"
                    />
                  </div>
                  <button
                    onClick={handleConnectWs}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Python 브릿지 서버 연결</span>
                  </button>
                </div>
              </div>

              {/* Code Preview */}
              <div className="relative">
                <pre className="bg-stone-950 text-stone-200 font-mono text-[11px] p-4 rounded-2xl border border-stone-800 max-h-80 overflow-y-auto leading-relaxed shadow-inner">
                  <code>{NXP_PYTHON_BRIDGE_CODE}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: TERMINAL & LOGS */}
          {activeTab === 'terminal' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-teal-700" />
                  <span>실시간 OpenSDA CDC Serial 패킷 모니터</span>
                </span>
                <button
                  onClick={() => nxpSerial.clearLogs()}
                  className="px-2.5 py-1 text-xs text-stone-500 hover:text-stone-800 bg-white border border-stone-300 rounded-lg flex items-center space-x-1 hover:bg-stone-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>로그 지우기</span>
                </button>
              </div>

              {/* Terminal Screen */}
              <div className="bg-stone-950 text-stone-200 font-mono text-xs p-5 rounded-2xl border border-stone-800 h-80 overflow-y-auto space-y-1.5 shadow-inner">
                {logs.length === 0 ? (
                  <div className="text-stone-500 py-10 text-center">
                    로그가 비어 있습니다. NXP 보드를 연결하고 버튼을 누르거나 명령을 전송해 보세요.
                  </div>
                ) : (
                  logs
                    .slice()
                    .reverse()
                    .map((log) => (
                      <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
                        <span className="text-stone-600 shrink-0 select-none">[{log.timestamp}]</span>
                        {log.type === 'tx' && <span className="text-amber-400 shrink-0 font-bold">[TX →]</span>}
                        {log.type === 'rx' && <span className="text-teal-300 shrink-0 font-bold">[RX ←]</span>}
                        {log.type === 'system' && <span className="text-blue-400 shrink-0 font-bold">[SYS]</span>}
                        {log.type === 'error' && <span className="text-rose-400 shrink-0 font-bold">[ERR]</span>}
                        <span
                          className={
                            log.type === 'tx'
                              ? 'text-amber-200'
                              : log.type === 'rx'
                              ? 'text-teal-200'
                              : log.type === 'error'
                              ? 'text-rose-300'
                              : 'text-stone-300'
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))
                )}
                <div ref={terminalEndRef} />
              </div>

              {/* Command Input Bar */}
              <form onSubmit={handleSendCustom} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customCmd}
                  onChange={(e) => setCustomCmd(e.target.value)}
                  placeholder="예: PATTERN:CODING_DS4, PATTERN:SM_PINGPONG, ONBOARD_LED:DS4:ON, PATTERN:SUCCESS"
                  disabled={connectionState !== 'connected'}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 disabled:bg-stone-100 disabled:text-stone-400"
                />
                <button
                  type="submit"
                  disabled={connectionState !== 'connected' || !customCmd.trim()}
                  className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-amber-200 rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>전송</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: C FIRMWARE SOURCE CODE */}
          {activeTab === 'firmware' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-serif font-bold text-stone-900 flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-teal-700" />
                    <span>S32 Design Studio (S32DS) C 펌웨어 소스 코드 (main.c)</span>
                  </h4>
                  <p className="text-xs text-stone-500 font-sans mt-0.5">
                    DEVKIT-MPC5748G의 온보드 LED(PA10, PA7) 및 4버튼(SW1~SW4) SIUL2 GPIO 및 LINFlexD_0 UART 소스입니다.
                  </p>
                </div>

                <button
                  onClick={handleCopyCode}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-amber-100 transition-all flex items-center space-x-1.5 shrink-0 shadow-xs"
                >
                  {isCopiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopiedCode ? '전체 코드 복사됨!' : 'C 소스 코드 전체 복사'}</span>
                </button>
              </div>

              {/* Code Display */}
              <div className="relative">
                <pre className="bg-stone-950 text-stone-200 font-mono text-[11px] p-5 rounded-2xl border border-stone-800 max-h-96 overflow-y-auto leading-relaxed shadow-inner">
                  <code>{NXP_MPC5748G_C_MAIN}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: STEP-BY-STEP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-6">
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <h4 className="text-sm font-serif font-bold text-stone-900 flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>DEVKIT-MPC5748G 온보드 하드웨어 핀맵 & 매뉴얼</span>
                </h4>

                <div className="space-y-3.5">
                  {NXP_STEP_BY_STEP_GUIDE.map((step) => (
                    <div key={step.step} className="flex items-start space-x-3.5 p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
                      <div className="w-7 h-7 rounded-full bg-stone-900 text-amber-300 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {step.step}
                      </div>
                      <div className="space-y-0.5">
                        <h5 className="text-xs font-bold text-stone-900">{step.title}</h5>
                        <p className="text-xs text-stone-600 leading-relaxed font-sans">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pinout Details */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-3">
                <h4 className="text-sm font-serif font-bold text-stone-900">
                  DEVKIT-MPC5748G 핀맵 및 온보드 소자 사양
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                    <span className="font-bold text-stone-800 block">💡 온보드 SMD LED 핀맵</span>
                    <ul className="space-y-1 text-stone-600 text-[11px] font-mono">
                      <li>• DS4: PA10 (SIUL2 MSCR[10], Active LOW)</li>
                      <li>• DS5: PA7 (SIUL2 MSCR[7], Active LOW)</li>
                      <li>• DS6: PA4 (SIUL2 MSCR[4])</li>
                      <li>• DS7: PA0 (SIUL2 MSCR[0])</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1">
                    <span className="font-bold text-stone-800 block">🔘 온보드 4대 푸시 버튼 & 실크스크린</span>
                    <ul className="space-y-1 text-stone-600 text-[11px] font-mono">
                      <li>• SW1_PA3 (PA3): 일정/루틴 완료 체크 (Task Complete)</li>
                      <li>• SW2_PE12 (PE12): 플래너 4대 트랙 화면 전환 (Next Track)</li>
                      <li>• SW3 ROOT (PE14): 일정 알림 10분 스누즈 & 소등 (Snooze Alert)</li>
                      <li>• SW4 1 (PE13/PA0): DS4/DS5 점멸 패턴 순환 모드 (Cycle Mode)</li>
                      <li>• SW1 RESET: MCU 하드웨어 리셋 (Hard Reset)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. Modal Footer */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span>NXP Semiconductors Automotive Power Architecture® Bridge v1.2 (Onboard HW Mode)</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
