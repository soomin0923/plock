// Web Serial API Driver & Service for NXP DEVKIT-MPC5748G
// Board: NXP Semiconductors DEVKIT-MPC5748G (PUID: 1YUSEOAX224803, LOT: EOAX224803, CODENO: 9353 275 78598)

export type NxpConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'unsupported';
export type NxpTransportType = 'webserial' | 'wsbridge';

export interface NxpSerialLog {
  id: string;
  timestamp: string;
  type: 'tx' | 'rx' | 'system' | 'error';
  message: string;
}

export interface NxpBoardConfig {
  boardType: string;
  puid: string;
  lot: string;
  codeNo: string;
  baudRate: number;
  autoAlertEnabled: boolean;
  wsBridgeUrl: string;
  activeTrackPattern: 'CODING_DS4' | 'HINT_DS5' | 'SM_PINGPONG' | 'TOEIC_SYNC' | 'BREATHE' | 'OFF';
  colorMapping: {
    coding: 'CYAN' | 'RED' | 'BLUE' | 'GREEN' | 'MAGENTA';
    hint: 'BLUE' | 'CYAN' | 'WHITE' | 'YELLOW';
    sm: 'MAGENTA' | 'CYAN' | 'RED';
    toeic: 'GREEN' | 'YELLOW' | 'CYAN';
    general: 'WHITE' | 'YELLOW';
  };
}

export const DEFAULT_NXP_CONFIG: NxpBoardConfig = {
  boardType: 'DEVKIT-MPC5748G',
  puid: '1YUSEOAX224803',
  lot: 'EOAX224803',
  codeNo: '9353 275 78598',
  baudRate: 115200,
  autoAlertEnabled: true,
  wsBridgeUrl: 'ws://localhost:8765',
  activeTrackPattern: 'SM_PINGPONG',
  colorMapping: {
    coding: 'CYAN',
    hint: 'BLUE',
    sm: 'MAGENTA',
    toeic: 'GREEN',
    general: 'WHITE',
  },
};

type StateListener = (state: NxpConnectionState) => void;
type LogListener = (logs: NxpSerialLog[]) => void;
type RxCommandListener = (cmd: string) => void;

class NxpSerialManager {
  private port: any | null = null;
  private reader: any | null = null;
  private writer: any | null = null;
  private ws: WebSocket | null = null;
  private transport: NxpTransportType = 'webserial';
  private state: NxpConnectionState = 'disconnected';
  private logs: NxpSerialLog[] = [];
  private stateListeners: Set<StateListener> = new Set();
  private logListeners: Set<LogListener> = new Set();
  private rxListeners: Set<RxCommandListener> = new Set();
  private config: NxpBoardConfig = DEFAULT_NXP_CONFIG;
  private keepReading: boolean = false;
  private textDecoder: TextDecoderStream | null = null;
  private readableStreamClosed: Promise<void> | null = null;
  private textEncoder: TextEncoderStream | null = null;
  private writableStreamClosed: Promise<void> | null = null;

  constructor() {
    // Load config from localStorage
    try {
      const saved = localStorage.getItem('chronicle_nxp_config');
      if (saved) {
        this.config = { ...DEFAULT_NXP_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {}

    // Check Web Serial API support
    if (typeof window !== 'undefined' && !('serial' in navigator)) {
      this.state = 'unsupported';
      this.addLog('system', 'Web Serial API is not supported in this browser. Please use Google Chrome or MS Edge on Desktop, or use the Python WebSocket Bridge.');
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'serial' in navigator;
  }

  public isInIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  public getTransport(): NxpTransportType {
    return this.transport;
  }

  public getState(): NxpConnectionState {
    return this.state;
  }

  public getLogs(): NxpSerialLog[] {
    return [...this.logs];
  }

  public getConfig(): NxpBoardConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<NxpBoardConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem('chronicle_nxp_config', JSON.stringify(this.config));
    } catch (e) {}
  }

  public subscribeState(listener: StateListener) {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public subscribeLogs(listener: LogListener) {
    this.logListeners.add(listener);
    listener([...this.logs]);
    return () => this.logListeners.delete(listener);
  }

  public subscribeRx(listener: RxCommandListener) {
    this.rxListeners.add(listener);
    return () => this.rxListeners.delete(listener);
  }

  private setState(newState: NxpConnectionState) {
    this.state = newState;
    this.stateListeners.forEach((l) => l(newState));
  }

  private addLog(type: 'tx' | 'rx' | 'system' | 'error', message: string) {
    const timeStr = new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logItem: NxpSerialLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: timeStr,
      type,
      message,
    };
    this.logs = [logItem, ...this.logs.slice(0, 99)]; // keep latest 100
    this.logListeners.forEach((l) => l([...this.logs]));
  }

  public clearLogs() {
    this.logs = [];
    this.logListeners.forEach((l) => l([]));
  }

  // Request Port & Connect to DEVKIT-MPC5748G via Web Serial API
  public async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      this.setState('unsupported');
      this.addLog('error', '이 브라우저는 Web Serial API를 지원하지 않습니다. Chrome/Edge를 사용하시거나 [Python 브릿지 모드]를 이용하세요.');
      return false;
    }

    if (this.isInIframe()) {
      this.addLog('system', '💡 알림: 현재 창이 iframe 내부(미리보기)일 수 있습니다. 기기 선택창에 보드가 안 뜰 경우 우측 상단 "새 탭에서 열기"를 이용해 보세요.');
    }

    try {
      this.setState('connecting');
      this.transport = 'webserial';
      this.addLog('system', `NXP DEVKIT-MPC5748G (Baud: ${this.config.baudRate}) 연결 요청 중... OpenSDA VCOM 포트를 선택하세요.`);

      // Prompt user to select USB OpenSDA COM port without filters so all COM ports are visible
      this.port = await (navigator as any).serial.requestPort();

      // Open port with configured baud rate (default 115200 8N1)
      await this.port.open({
        baudRate: this.config.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 1024,
      });

      this.setState('connected');
      this.addLog('system', `✅ NXP DEVKIT-MPC5748G 연결 성공! (Baud: ${this.config.baudRate} 8N1)`);

      // Initialize Writer Stream
      this.textEncoder = new TextEncoderStream();
      this.writableStreamClosed = this.textEncoder.readable.pipeTo(this.port.writable);
      this.writer = this.textEncoder.writable.getWriter();

      // Send initial handshaking / hello command
      await this.sendRaw('HELLO:CHRONICLE\n');

      // Start Read Loop
      this.startReadLoop();

      return true;
    } catch (err: any) {
      console.error('Serial Connection Error:', err);
      this.setState('disconnected');
      if (err.name === 'NotFoundError') {
        this.addLog('error', '포트 선택이 취소되었거나 장치를 찾을 수 없습니다. (케이블 데이터선 연결 / J10 포트 / OpenSDA 드라이버 확인 필요)');
      } else if (err.name === 'SecurityError') {
        this.addLog('error', '보안 에러: iframe 환경에서는 Serial 포트 접근이 제한될 수 있습니다. "새 탭에서 열기"로 접속해 주세요.');
      } else {
        this.addLog('error', `연결 실패: ${err.message || '포트에 접근할 수 없습니다.'}`);
      }
      return false;
    }
  }

  // Connect via Local Python WebSocket Bridge (Alternative for Driver/Iframe bypass)
  public async connectWsBridge(customUrl?: string): Promise<boolean> {
    const url = customUrl || this.config.wsBridgeUrl || 'ws://localhost:8765';
    this.setState('connecting');
    this.transport = 'wsbridge';
    this.addLog('system', `Python WebSocket 로컬 브릿지 (${url}) 연결 시도 중...`);

    return new Promise((resolve) => {
      try {
        const socket = new WebSocket(url);

        socket.onopen = () => {
          this.ws = socket;
          this.setState('connected');
          this.addLog('system', `✅ Python 로컬 브릿지 연동 성공! NXP 보드 통신 활성화됨 (${url})`);
          this.sendRaw('HELLO:CHRONICLE\n');
          resolve(true);
        };

        socket.onmessage = (event) => {
          const msg = typeof event.data === 'string' ? event.data.trim() : '';
          if (msg) {
            this.addLog('rx', msg);
            this.rxListeners.forEach((l) => l(msg));
          }
        };

        socket.onerror = (e) => {
          this.setState('disconnected');
          this.addLog('error', `로컬 브릿지 연결 실패: ${url} 서버가 실행 중인지 확인하세요. (nxp_bridge.py 실행 필요)`);
          resolve(false);
        };

        socket.onclose = () => {
          if (this.state === 'connected') {
            this.setState('disconnected');
            this.addLog('system', '로컬 브릿지 서버와의 연결이 종료되었습니다.');
          }
        };
      } catch (err: any) {
        this.setState('disconnected');
        this.addLog('error', `로컬 브릿지 예외: ${err.message}`);
        resolve(false);
      }
    });
  }

  // Read loop for incoming data from MPC5748G via Web Serial
  private async startReadLoop() {
    if (!this.port || !this.port.readable) return;
    this.keepReading = true;

    try {
      while (this.port.readable && this.keepReading) {
        this.textDecoder = new TextDecoderStream();
        this.readableStreamClosed = this.port.readable.pipeTo(this.textDecoder.writable);
        const reader = this.textDecoder.readable.getReader();
        this.reader = reader;

        try {
          let lineBuffer = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              lineBuffer += value;
              const lines = lineBuffer.split('\n');
              lineBuffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.length > 0) {
                  this.addLog('rx', trimmed);
                  this.rxListeners.forEach((l) => l(trimmed));
                }
              }
            }
          }
        } catch (readErr: any) {
          if (this.keepReading) {
            this.addLog('error', `수신 오류: ${readErr.message}`);
          }
        } finally {
          reader.releaseLock();
        }
      }
    } catch (err: any) {
      console.error('Read loop failure:', err);
    }
  }

  // Send Raw String Command
  public async sendRaw(text: string): Promise<boolean> {
    if (this.state !== 'connected') {
      this.addLog('error', `전송 실패: 보드가 연결되어 있지 않습니다. (${text.trim()})`);
      return false;
    }

    const payload = text.endsWith('\n') ? text : `${text}\n`;

    // 1. If using WebSocket Bridge
    if (this.transport === 'wsbridge' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      this.addLog('tx', payload.trim());
      return true;
    }

    // 2. If using Web Serial API
    if (this.writer) {
      try {
        await this.writer.write(payload);
        this.addLog('tx', payload.trim());
        return true;
      } catch (err: any) {
        this.addLog('error', `전송 에러: ${err.message}`);
        return false;
      }
    }

    return false;
  }

  // Trigger Schedule Category LED Alert
  public async sendScheduleAlert(category: string, title: string): Promise<boolean> {
    if (this.state !== 'connected') {
      return false;
    }

    const catUpper = category.toUpperCase();
    let color = 'WHITE';

    if (catUpper.includes('CODING') || catUpper.includes('코딩')) {
      color = this.config.colorMapping.coding;
    } else if (catUpper.includes('HINT') || catUpper.includes('교육') || catUpper.includes('직장')) {
      color = this.config.colorMapping.hint;
    } else if (catUpper.includes('SM') || catUpper.includes('개발') || catUpper.includes('포트폴리오')) {
      color = this.config.colorMapping.sm;
    } else if (catUpper.includes('TOEIC') || catUpper.includes('토익') || catUpper.includes('영어')) {
      color = this.config.colorMapping.toeic;
    } else {
      color = this.config.colorMapping.general;
    }

    // Format: ALERT:<COLOR>:<CATEGORY>:<TITLE>
    const safeTitle = title.replace(/[:\n\r]/g, ' ').substring(0, 30);
    const command = `ALERT:${color}:${category}:${safeTitle}\n`;
    return await this.sendRaw(command);
  }

  // Direct Onboard LED Controls for NXP DEVKIT-MPC5748G (DS4 [PA10], DS5 [PA7])
  public async setOnboardLed(led: 'DS4' | 'DS5' | 'ALL', state: 'ON' | 'OFF' | 'TOGGLE'): Promise<boolean> {
    return await this.sendRaw(`ONBOARD_LED:${led}:${state}\n`);
  }

  // Trigger specialized Blinking Patterns on Onboard DS4 (PA10) & DS5 (PA7)
  public async setBoardPattern(
    pattern: 'CODING_DS4' | 'HINT_DS5' | 'SM_PINGPONG' | 'TOEIC_SYNC' | 'BREATHE' | 'SUCCESS' | 'OFF'
  ): Promise<boolean> {
    this.updateConfig({ activeTrackPattern: pattern === 'SUCCESS' ? this.config.activeTrackPattern : pattern });
    return await this.sendRaw(`PATTERN:${pattern}\n`);
  }

  // Success Celebration Pattern (DS4 + DS5 rapid double flash)
  public async sendSuccessCelebration(): Promise<boolean> {
    return await this.sendRaw('PATTERN:SUCCESS\n');
  }

  // Direct RGB LED Controls for NXP MPC5748G
  public async setLed(color: 'RED' | 'GREEN' | 'BLUE' | 'CYAN' | 'MAGENTA' | 'YELLOW' | 'WHITE' | 'OFF'): Promise<boolean> {
    if (color === 'OFF') {
      return await this.sendRaw('LED:OFF\n');
    }
    return await this.sendRaw(`LED:${color}:ON\n`);
  }

  public async setBlink(color: 'RED' | 'GREEN' | 'BLUE' | 'CYAN' | 'MAGENTA' | 'YELLOW' | 'WHITE', count: number = 3): Promise<boolean> {
    return await this.sendRaw(`BLINK:${color}:${count}\n`);
  }

  public async runTestPattern(): Promise<boolean> {
    return await this.sendRaw('TEST:RAINBOW\n');
  }

  // Disconnect from DEVKIT-MPC5748G
  public async disconnect() {
    this.keepReading = false;

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    if (this.writer) {
      try {
        await this.sendRaw('LED:OFF\n');
        await this.writer.close();
      } catch (e) {}
      this.writer = null;
    }

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {}
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {}
      this.port = null;
    }

    this.setState('disconnected');
    this.addLog('system', 'NXP DEVKIT-MPC5748G 연결이 해제되었습니다.');
  }
}

export const nxpSerial = new NxpSerialManager();
