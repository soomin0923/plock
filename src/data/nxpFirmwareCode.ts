// C Firmware Examples, Pinout Guide, and Hardware Logic for NXP DEVKIT-MPC5748G
// Target IDE: NXP S32 Design Studio for Power Architecture (S32DS) or MCUXpresso / Keil / IAR
// Target Device: MPC5748G (32-bit Automotive MCU)

export const NXP_MPC5748G_SPECS = {
  boardName: 'DEVKIT-MPC5748G',
  puid: '1YUSEOAX224803',
  lot: 'EOAX224803',
  dateCode: '2248',
  codeNo: '9353 275 78598',
  architecture: 'Power Architecture® e200z4/z2 Triple Cores',
  debugger: 'OpenSDA V2.2 (CDC Virtual COM Port UART)',
  defaultBaud: 115200,
  onboardLeds: [
    { name: 'DS4 (User LED 1)', port: 'PA10 (SIUL2 MSCR[10])', function: '코딩테스트 / 주 트랙 상태 알림 (단독/교차 점멸)' },
    { name: 'DS5 (User LED 2)', port: 'PA7 (SIUL2 MSCR[7])', function: 'HINT 교육 / 보조 트랙 상태 알림 (단독/교차 점멸)' },
    { name: 'DS6 (User LED 3)', port: 'PA4 (SIUL2 MSCR[4])', function: 'SM 로드맵 개발 알림' },
    { name: 'DS7 (User LED 4)', port: 'PA0 (SIUL2 MSCR[0])', function: 'TOEIC 800 알림' },
  ],
  onboardButtons: [
    { name: 'SW1 (User Btn 1)', port: 'PA3 (SIUL2 MSCR[3])', silk: 'SW1_PA3', function: '🎯 오늘의 첫 번째 미완료 일정/루틴 완료 체크 (Task Complete)' },
    { name: 'SW2 (User Btn 2)', port: 'PE12 (SIUL2 MSCR[76])', silk: 'SW2_PE12', function: '⏭️ 다음 4대 핵심 트랙으로 플래너 뷰/포커스 전환 (Next Track)' },
    { name: 'SW3 (User Btn 3 / ROOT)', port: 'PE14 (SIUL2 MSCR[78])', silk: 'SW3 ROOT', function: '🔕 알림 음소거 / 스누즈 & 온보드 LED 끄기 (Snooze Alert)' },
    { name: 'SW4 (User Btn 4 / 1)', port: 'PE13 / PA0 (SIUL2 MSCR[77])', silk: 'SW4 1', function: '🔄 DS4(PA10) & DS5(PA7) LED 점멸 패턴 순환 및 모드 전환 (Cycle Mode)' },
    { name: 'RESET', port: 'MCU RESET PIN', silk: 'SW1 RESET', function: '⚡ 하드웨어 보드 리셋 (MCU Hard Reset)' },
  ],
  trackPatterns: [
    {
      id: 'CODING_DS4',
      track: '코딩테스트 트랙',
      ledName: 'DS4 (PA10)',
      pattern: 'DS4 단독 4회 고속 점멸 (Flash 4x)',
      description: '아침 08:00 코드업 100제 & 백준 코딩테스트 풀이 시간 알림',
    },
    {
      id: 'HINT_DS5',
      track: 'HINT 직무 교육 트랙',
      ledName: 'DS5 (PA7)',
      pattern: 'DS5 단독 3회 점멸 (Flash 3x)',
      description: '09:00 HINT 온디바이스 AI / 임베디드 실습 세션 알림',
    },
    {
      id: 'SM_PINGPONG',
      track: 'SM 취업 로드맵 트랙',
      ledName: 'DS4 ↔ DS5',
      pattern: 'DS4와 DS5 번갈아 교차 핑퐁 점멸 (Ping-Pong Blink)',
      description: '18:30 Jetson Orin Nano / ROS2 / fingense 포트폴리오 개발 알림',
    },
    {
      id: 'TOEIC_SYNC',
      track: 'TOEIC 800 트랙',
      ledName: 'DS4 + DS5',
      pattern: 'DS4와 DS5 동시 동기 점멸 (Dual Sync Blink)',
      description: '20:00 TOEIC 800점 기출 단어 40개 & 실전 RC/LC 풀이 알림',
    },
    {
      id: 'SUCCESS',
      track: '일정 완료 피드백',
      ledName: 'DS4 + DS5',
      pattern: 'DS4와 DS5 2회 고속 점멸 (Double Flash)',
      description: 'SW1_PA3 버튼으로 일정 완료 시 축하 및 확인 피드백',
    },
  ],
};

export const NXP_MPC5748G_C_MAIN = `/*
 * ============================================================================
 * NXP DEVKIT-MPC5748G Onboard LED (DS4/PA10, DS5/PA7) & 4-Button (SW1~SW4)
 * Project: Chronicle Planner -> NXP Hardware Embedded Bridge
 * Board: DEVKIT-MPC5748G (PUID: 1YUSEOAX224803, LOT: EOAX224803)
 * Silk Screen Buttons:
 *   - SW1 RESET  : Hardware MCU Reset
 *   - SW1_PA3    : User Button 1 (PA3)  -> Task Complete (일정/루틴 완료)
 *   - SW2_PE12   : User Button 2 (PE12) -> Next Track Focus (화면 전환)
 *   - SW3 ROOT   : User Button 3 (PE14) -> Snooze / Dismiss Alert (스누즈)
 *   - SW4 1      : User Button 4 (PE13 / PA0) -> Cycle LED Pattern (모드 순환)
 * Target IDE: NXP S32 Design Studio for Power Architecture (S32DS)
 * Compiler: GCC for Power Architecture / Wind River / Diab
 * ============================================================================
 */

#include "derivative.h"
#include "project.h"
#include <string.h>
#include <stdio.h>
#include <stdbool.h>

/* --- Onboard SMD LED Pin Definitions (DEVKIT-MPC5748G Silk Screen) --- */
#define LED_DS4_PIN     10   /* PA10 - User LED 1 (DS4) */
#define LED_DS5_PIN     7    /* PA7  - User LED 2 (DS5) */
#define LED_DS6_PIN     4    /* PA4  - User LED 3 (DS6) */
#define LED_DS7_PIN     0    /* PA0  - User LED 4 (DS7) */

/* --- Exact Silk Screen User Push Buttons on DEVKIT-MPC5748G --- */
/* 1. SW1_PA3: PA3 (SIUL2 MSCR 3, GPDI 3) */
#define BTN_SW1_PA3_PIN  3    /* PA3  - MSCR[3] -> Task Complete (SW1) */

/* 2. SW2_PE12: PE12 (Port E offset 64 + 12 = 76, SIUL2 MSCR 76, GPDI 76) */
#define BTN_SW2_PE12_PIN 76   /* PE12 - MSCR[76] -> Next Track Focus (SW2) */

/* 3. SW3 ROOT: PE14 (Port E offset 64 + 14 = 78, SIUL2 MSCR 78, GPDI 78) */
#define BTN_SW3_PE14_PIN 78   /* PE14 - MSCR[78] -> Snooze / Dismiss (SW3 ROOT) */

/* 4. SW4 1: PE13 (Port E offset 64 + 13 = 77, SIUL2 MSCR 77, GPDI 77) */
#define BTN_SW4_PE13_PIN 77   /* PE13 - MSCR[77] -> Cycle LED Pattern (SW4 1) */

/* Fallback Header Compatibility Pins (PTE0 ~ PTE3) */
#define BTN_FB_PTE0_PIN  64   /* PTE0 */
#define BTN_FB_PTE1_PIN  65   /* PTE1 */
#define BTN_FB_PTE2_PIN  66   /* PTE2 */
#define BTN_FB_PTE3_PIN  67   /* PTE3 */

#define RX_BUFFER_SIZE  128
static char rx_buffer[RX_BUFFER_SIZE];
static uint8_t rx_index = 0;

/* Current active mode (0: Coding, 1: HINT, 2: SM, 3: TOEIC) */
static uint8_t current_track_mode = 2; /* Default: SM Roadmap */

/* Simple busy-wait delay function */
void delay_ms(uint32_t ms) {
    volatile uint32_t i, j;
    for (i = 0; i < ms; i++) {
        for (j = 0; j < 8000; j++) {
            __asm__("nop");
        }
    }
}

/* UART Transmit via LINFlexD0 (OpenSDA Virtual COM Port) */
void UART_SendString(const char *str) {
    while (*str) {
        while (LINFLEX_0.UARTSR.B.DTFTFF == 1); /* Wait if TX FIFO full */
        LINFLEX_0.BDRL.B.DATA0 = (uint8_t)(*str++);
    }
}

/* LINFlexD0 UART Configuration: 115200 Baud, 8N1 */
void UART_Init(void) {
    /* Enter LINFlexD INIT mode */
    LINFLEX_0.LINCR1.B.INIT = 1;
    LINFLEX_0.LINCR1.B.SLEEP = 0;

    /* Set UART Mode: 8-bit data, no parity, 1 stop bit */
    LINFLEX_0.UARTCR.B.UART = 1;
    LINFLEX_0.UARTCR.B.WL0 = 1;   /* 8-bit length */
    LINFLEX_0.UARTCR.B.PCE = 0;   /* Parity disabled */
    LINFLEX_0.UARTCR.B.TxEn = 1;  /* Transmitter Enable */
    LINFLEX_0.UARTCR.B.RxEn = 1;  /* Receiver Enable */

    /* Baud Rate Calculation for 115200 (80MHz LIN_CLK) */
    LINFLEX_0.LINIBRR.B.DIV_M = 43;
    LINFLEX_0.LINFBRR.B.DIV_F = 6;

    /* Exit INIT mode to start normal operation */
    LINFLEX_0.LINCR1.B.INIT = 0;
}

/* GPIO Initialization using SIUL2 Peripheral for Onboard LEDs & Buttons */
void GPIO_Init(void) {
    /* 1. Configure Onboard LEDs PA10 (DS4) & PA7 (DS5) as Output */
    SIUL2.MSCR[LED_DS4_PIN].B.OBE = 1;    /* PA10 Output Buffer Enable */
    SIUL2.MSCR[LED_DS5_PIN].B.OBE = 1;    /* PA7 Output Buffer Enable */

    /* Turn OFF LEDs initially (Active LOW: 1 = OFF, 0 = ON) */
    SIUL2.GPDO[LED_DS4_PIN].B.PDO = 1;
    SIUL2.GPDO[LED_DS5_PIN].B.PDO = 1;

    /* 2. Configure Exact Silk-Screen Buttons:
     * - SW1_PA3 (MSCR 3)
     * - SW2_PE12 (MSCR 76)
     * - SW3 ROOT / PE14 (MSCR 78)
     * - SW4 1 / PE13 (MSCR 77)
     */
    uint32_t btn_pins[] = {
        BTN_SW1_PA3_PIN,
        BTN_SW2_PE12_PIN,
        BTN_SW3_PE14_PIN,
        BTN_SW4_PE13_PIN,
        BTN_FB_PTE0_PIN,
        BTN_FB_PTE1_PIN,
        BTN_FB_PTE2_PIN,
        BTN_FB_PTE3_PIN
    };

    for (int i = 0; i < sizeof(btn_pins)/sizeof(btn_pins[0]); i++) {
        uint32_t pin = btn_pins[i];
        SIUL2.MSCR[pin].B.IBE = 1;     /* Input Buffer Enable */
        SIUL2.MSCR[pin].B.PUE = 1;     /* Pull-Up Enable */
        SIUL2.MSCR[pin].B.PUS = 1;     /* Pull-Up Select */
    }
}

/* Direct LED Control: Active LOW on DEVKIT-MPC5748G */
void Set_DS4_LED(bool on) {
    SIUL2.GPDO[LED_DS4_PIN].B.PDO = on ? 0 : 1;
}

void Set_DS5_LED(bool on) {
    SIUL2.GPDO[LED_DS5_PIN].B.PDO = on ? 0 : 1;
}

void Turn_All_LEDs_Off(void) {
    Set_DS4_LED(false);
    Set_DS5_LED(false);
}

/* -------------------------------------------------------------------------- */
/* Specialized Schedule Alert LED Blinking Patterns                          */
/* -------------------------------------------------------------------------- */

/* Pattern 1: Coding Test Alert (DS4 Fast 4x Blink) */
void Pattern_Coding_DS4(void) {
    for (int i = 0; i < 4; i++) {
        Set_DS4_LED(true);  delay_ms(120);
        Set_DS4_LED(false); delay_ms(100);
    }
}

/* Pattern 2: HINT Training Alert (DS5 Steady 3x Blink) */
void Pattern_HINT_DS5(void) {
    for (int i = 0; i < 3; i++) {
        Set_DS5_LED(true);  delay_ms(250);
        Set_DS5_LED(false); delay_ms(200);
    }
}

/* Pattern 3: SM Roadmap Alert (DS4 <-> DS5 Ping-Pong Alternating Blink) */
void Pattern_SM_PingPong(void) {
    for (int i = 0; i < 3; i++) {
        Set_DS4_LED(true);  Set_DS5_LED(false); delay_ms(150);
        Set_DS4_LED(false); Set_DS5_LED(true);  delay_ms(150);
    }
    Turn_All_LEDs_Off();
}

/* Pattern 4: TOEIC 800 Alert (DS4 + DS5 Synchronous Dual Blink) */
void Pattern_TOEIC_Sync(void) {
    for (int i = 0; i < 3; i++) {
        Set_DS4_LED(true);  Set_DS5_LED(true);  delay_ms(200);
        Set_DS4_LED(false); Set_DS5_LED(false); delay_ms(180);
    }
}

/* Pattern 5: Task Complete Success Feedback (DS4 + DS5 Rapid Double Flash) */
void Pattern_Success_Celebration(void) {
    for (int i = 0; i < 2; i++) {
        Set_DS4_LED(true);  Set_DS5_LED(true);  delay_ms(80);
        Set_DS4_LED(false); Set_DS5_LED(false); delay_ms(80);
    }
}

/* Execute Current Mode Pattern */
void Execute_Current_Mode_Pattern(void) {
    switch (current_track_mode) {
        case 0:
            UART_SendString("[NXP] Mode 1: Coding Track (DS4 Fast Flash)\\r\\n");
            Pattern_Coding_DS4();
            break;
        case 1:
            UART_SendString("[NXP] Mode 2: HINT Education (DS5 Steady Flash)\\r\\n");
            Pattern_HINT_DS5();
            break;
        case 2:
            UART_SendString("[NXP] Mode 3: SM Roadmap (DS4 <-> DS5 Ping-Pong)\\r\\n");
            Pattern_SM_PingPong();
            break;
        case 3:
            UART_SendString("[NXP] Mode 4: TOEIC 800 (DS4 + DS5 Sync Flash)\\r\\n");
            Pattern_TOEIC_Sync();
            break;
    }
}

/* -------------------------------------------------------------------------- */
/* Command Parser (from Web Planner -> MPC5748G via OpenSDA UART)             */
/* -------------------------------------------------------------------------- */
void Process_Command(const char *cmd) {
    UART_SendString("[NXP-ACK] Cmd: ");
    UART_SendString(cmd);
    UART_SendString("\\r\\n");

    if (strstr(cmd, "PATTERN:CODING_DS4") || strstr(cmd, "ALERT:CODING")) {
        current_track_mode = 0;
        Pattern_Coding_DS4();
    } else if (strstr(cmd, "PATTERN:HINT_DS5") || strstr(cmd, "ALERT:HINT")) {
        current_track_mode = 1;
        Pattern_HINT_DS5();
    } else if (strstr(cmd, "PATTERN:SM_PINGPONG") || strstr(cmd, "ALERT:SM")) {
        current_track_mode = 2;
        Pattern_SM_PingPong();
    } else if (strstr(cmd, "PATTERN:TOEIC_SYNC") || strstr(cmd, "ALERT:TOEIC")) {
        current_track_mode = 3;
        Pattern_TOEIC_Sync();
    } else if (strstr(cmd, "PATTERN:SUCCESS")) {
        Pattern_Success_Celebration();
    } else if (strstr(cmd, "LED:OFF") || strstr(cmd, "ONBOARD_LED:ALL:OFF")) {
        Turn_All_LEDs_Off();
    } else if (strstr(cmd, "ONBOARD_LED:DS4:ON")) {
        Set_DS4_LED(true);
    } else if (strstr(cmd, "ONBOARD_LED:DS5:ON")) {
        Set_DS5_LED(true);
    } else if (strstr(cmd, "TEST:RAINBOW") || strstr(cmd, "HELLO")) {
        Pattern_SM_PingPong();
        Pattern_TOEIC_Sync();
    }
}

/* -------------------------------------------------------------------------- */
/* Main Application Loop with Multi-Pin Button Polling & UART Receiver        */
/* -------------------------------------------------------------------------- */
int main(void) {
    GPIO_Init();
    UART_Init();

    UART_SendString("\\r\\n=======================================================\\r\\n");
    UART_SendString(" NXP DEVKIT-MPC5748G Ready for Chronicle Smart Planner\\r\\n");
    UART_SendString(" - Onboard LEDs: DS4(PA10), DS5(PA7)\\r\\n");
    UART_SendString(" - Silk Buttons: SW1_PA3, SW2_PE12, SW3 ROOT(PE14), SW4 1(PE13)\\r\\n");
    UART_SendString("=======================================================\\r\\n");

    /* Startup Animation */
    Pattern_SM_PingPong();

    while (1) {
        /* 1. Poll SW1 (SW1_PA3 on PA3 / Fallback PTE0): Task Complete */
        if (SIUL2.GPDI[BTN_SW1_PA3_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE0_PIN].B.PDI == 0) {
            delay_ms(35); /* Debounce */
            if (SIUL2.GPDI[BTN_SW1_PA3_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE0_PIN].B.PDI == 0) {
                UART_SendString("BTN:SW1:TASK_COMPLETE (SW1_PA3)\\r\\n");
                Pattern_Success_Celebration();
                while (SIUL2.GPDI[BTN_SW1_PA3_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE0_PIN].B.PDI == 0);
                delay_ms(50);
            }
        }

        /* 2. Poll SW2 (SW2_PE12 on PE12 / Fallback PTE1): Next Track Switch */
        if (SIUL2.GPDI[BTN_SW2_PE12_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE1_PIN].B.PDI == 0) {
            delay_ms(35); /* Debounce */
            if (SIUL2.GPDI[BTN_SW2_PE12_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE1_PIN].B.PDI == 0) {
                current_track_mode = (current_track_mode + 1) % 4;
                UART_SendString("BTN:SW2:NEXT_TRACK (SW2_PE12)\\r\\n");
                Execute_Current_Mode_Pattern();
                while (SIUL2.GPDI[BTN_SW2_PE12_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE1_PIN].B.PDI == 0);
                delay_ms(50);
            }
        }

        /* 3. Poll SW3 (SW3 ROOT on PE14 / Fallback PTE2): Snooze / LED OFF */
        if (SIUL2.GPDI[BTN_SW3_PE14_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE2_PIN].B.PDI == 0) {
            delay_ms(35); /* Debounce */
            if (SIUL2.GPDI[BTN_SW3_PE14_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE2_PIN].B.PDI == 0) {
                UART_SendString("BTN:SW3:SNOOZE (SW3_ROOT)\\r\\n");
                Turn_All_LEDs_Off();
                while (SIUL2.GPDI[BTN_SW3_PE14_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE2_PIN].B.PDI == 0);
                delay_ms(50);
            }
        }

        /* 4. Poll SW4 (SW4 1 on PE13 / Fallback PTE3): Cycle LED Pattern / Mode */
        if (SIUL2.GPDI[BTN_SW4_PE13_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE3_PIN].B.PDI == 0) {
            delay_ms(35); /* Debounce */
            if (SIUL2.GPDI[BTN_SW4_PE13_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE3_PIN].B.PDI == 0) {
                current_track_mode = (current_track_mode + 1) % 4;
                UART_SendString("BTN:SW4:CYCLE_MODE (SW4_1)\\r\\n");
                Execute_Current_Mode_Pattern();
                while (SIUL2.GPDI[BTN_SW4_PE13_PIN].B.PDI == 0 || SIUL2.GPDI[BTN_FB_PTE3_PIN].B.PDI == 0);
                delay_ms(50);
            }
        }

        /* 5. Check UART Receive FIFO */
        if (LINFLEX_0.UARTSR.B.RMB == 1) {
            char rx_char = (char)LINFLEX_0.BDRM.B.DATA4;
            LINFLEX_0.UARTSR.B.RMB = 1; /* Clear Flag */

            if (rx_char == '\\n' || rx_char == '\\r') {
                rx_buffer[rx_index] = '\\0';
                if (rx_index > 0) {
                    Process_Command(rx_buffer);
                    rx_index = 0;
                }
            } else if (rx_index < RX_BUFFER_SIZE - 1) {
                rx_buffer[rx_index++] = rx_char;
            }
        }

        delay_ms(10);
    }

    return 0;
}
`;

export const NXP_TROUBLESHOOTING_CASES = [
  {
    id: 'onboard_led_sw4',
    title: '💡 온보드 LED (DS4/PA10, DS5/PA7) & 4대 버튼 (SW1~SW4) 기본 동작',
    status: '하드웨어 특성',
    description:
      '별도 외부 LED 전구 연결 없이, 보드 표면에 내장된 SMD LED(DS4, DS5)와 온보드 푸시 버튼(SW1, SW2, SW3, SW4)을 누르는 것만으로 플래너 일정 완료 및 4대 트랙 알림을 100% 제어할 수 있습니다. SW4를 누를 때마다 DS4(PA10)와 DS5(PA7)의 점멸 패턴이 순환하며 현재 트랙 상태를 알려줍니다.',
    action: 'SW1(일정완료), SW2(다음트랙), SW3(알림스누즈), SW4(패턴전환) 즉시 사용 가능',
  },
  {
    id: 'port_location',
    title: '1. 보드의 micro-USB 연결 위치 확인 (J10 vs J13/J14)',
    status: '가장 빈번한 원인',
    description:
      'DEVKIT-MPC5748G 보드에는 2개의 micro-USB 포트가 있습니다. 반드시 보드 모서리에 각인된 J10 (OpenSDA) 포트에 케이블을 꽂으셔야 PC와 데이터 COM 포트 통신이 열립니다. (J13/J14 전원 포트에 꽂으면 전원 불과 띠링 소리는 나지만 COM 포트가 생성되지 않습니다.)',
    action: 'micro-USB 케이블을 보드의 [J10 (OpenSDA)] 포트에 연결하세요.',
  },
  {
    id: 'power_only_cable',
    title: '2. 데이터 전송(4선) vs 충전 전용(2선) 케이블 점검',
    status: '하드웨어 문제',
    description:
      '일반 충전기용 마이크로 5핀 케이블 중에는 데이터 선(D+/D-) 없이 전원선 2가닥만 있는 충전 전용 케이블이 많습니다. 이 경우 띠링 소리와 전원 불은 들어오지만 PC가 장치를 인식하지 못합니다.',
    action: '스마트폰 데이터 전송이 정상 작동하는 온전한 4선 데이터 케이블로 교체해 보세요.',
  },
  {
    id: 'driver_opensda',
    title: '3. Windows P&E Micro OpenSDA CDC Serial 드라이버 확인',
    status: '드라이버 필요',
    description:
      'Windows 장치 관리자(devmgmt.msc)의 [포트 (COM & LPT)]에 "OpenSDA - CDC Serial Port"가 있는지 확인하세요. 만약 [기타 장치]에 노란색 느낌표로 떠 있다면 S32DS 설치 시 함께 제공되는 PEMicro OpenSDA 드라이버를 설치해야 가상 COM 포트가 할당됩니다.',
    action: 'PEMicro OpenSDA VCOM 드라이버 설치 또는 [Python 브릿지 모드] 이용',
  },
  {
    id: 'iframe_sandbox',
    title: '4. 브라우저 보안 샌드박스 격리 (새 탭에서 열기)',
    status: '브라우저 보안',
    description:
      'AI Studio의 미리보기 창은 iframe 보안 격리 상태이므로, 브라우저에 따라 Web Serial 접근이 차단될 수 있습니다. 우측 상단의 [새 탭에서 열기 ↗] 버튼을 눌러 독립된 브라우저 탭에서 [NXP 보드 연결]을 클릭하세요.',
    action: '우측 상단의 [새 탭에서 열기 ↗] 버튼 클릭',
  },
];

export const NXP_STEP_BY_STEP_GUIDE = [
  {
    step: 1,
    title: '온보드 LED 및 버튼 확인 (DS4, DS5, SW1~SW4)',
    description: 'DEVKIT-MPC5748G 보드 표면의 실크스크린에서 DS4 (PA10), DS5 (PA7) LED와 SW1~SW4 버튼을 확인합니다. 외부 부품 연결이 일절 필요 없습니다.',
  },
  {
    step: 2,
    title: 'J10 (OpenSDA) 포트에 micro-USB 케이블 연결',
    description: 'PC와 보드의 J10 포트를 데이터 지원 케이블로 연결합니다. 보드 전원 LED가 켜지고 OpenSDA VCOM 포트가 활성화됩니다.',
  },
  {
    step: 3,
    title: '새 탭에서 열기 후 [NXP 보드 연결] 클릭 (또는 Python 브릿지)',
    description: '상단의 [새 탭에서 열기]로 독립 창을 연 뒤 [NXP 보드 연결]을 누르면 Chrome/Edge에서 OpenSDA 포트를 선택하여 즉시 양방향 연동됩니다.',
  },
  {
    step: 4,
    title: 'SW1 버튼으로 일정 완료 & SW4 버튼으로 LED 점멸 패턴 변경!',
    description: '보드의 SW1 버튼을 누르면 오늘의 일정이 실시간 완료 처리되며, SW4를 누르면 코딩/HINT/SM/TOEIC 트랙의 DS4, DS5 점멸 패턴이 즉시 변경됩니다.',
  },
];

export const NXP_PYTHON_BRIDGE_CODE = `"""
============================================================================
NXP DEVKIT-MPC5748G - Chronicle Planner Local WebSocket Bridge (Python)
- Onboard LEDs: DS4 (PA10), DS5 (PA7)
- Onboard Buttons: SW1 (Complete), SW2 (Track), SW3 (Snooze), SW4 (Pattern)
============================================================================
설명: 브라우저 Web Serial 드라이버 문제나 iframe 제약을 완전히 우회하여,
      로컬 PC에서 NXP 보드 COM 포트를 찾아 웹 플래너와 실시간 양방향 통신을 중계합니다.
      터미널에서 숫자 키(1, 2, 3, 4)를 입력하여 보드 버튼을 가상으로 시뮬레이션할 수도 있습니다!

필요 라이브러리 설치 (터미널/CMD):
    pip install pyserial websockets asyncio

실행 방법:
    python nxp_bridge.py
============================================================================
"""

import asyncio
import glob
import sys
import serial
import serial.tools.list_ports
import websockets

BAUD_RATE = 115200
WS_HOST = "localhost"
WS_PORT = 8765

CONNECTED_CLIENTS = set()
ser_conn = None

def find_nxp_port():
    ports = serial.tools.list_ports.comports()
    print("\\n[🔍 시스템 COM 포트 검색 중...]")
    for p in ports:
        print(f"  - 발견: {p.device} | {p.description} | HWID: {p.hwid}")
        if any(keyword in p.description.lower() for keyword in ["opensda", "mpc5748", "pemicro", "usb 직렬", "serial", "cdc"]):
            return p.device
    if len(ports) > 0:
        return ports[0].device
    return None

async def serial_reader_task():
    global ser_conn
    while True:
        if ser_conn and ser_conn.is_open:
            try:
                line = ser_conn.readline().decode("utf-8", errors="ignore").strip()
                if line:
                    print(f"📡 [NXP 보드 RX]: {line}")
                    # Broadcast to connected web clients
                    if CONNECTED_CLIENTS:
                        await asyncio.gather(*[ws.send(line) for ws in CONNECTED_CLIENTS])
            except Exception as e:
                print(f"❌ Serial 읽기 오류: {e}")
                await asyncio.sleep(1)
        else:
            await asyncio.sleep(1)

async def ws_handler(websocket):
    CONNECTED_CLIENTS.add(websocket)
    print(f"🌐 [웹 플래너 연결됨]: {websocket.remote_address}")
    try:
        async for message in websocket:
            print(f"💻 [웹 플래너 TX → NXP]: {message.strip()}")
            if ser_conn and ser_conn.is_open:
                payload = message if message.endswith("\\n") else f"{message}\\n"
                ser_conn.write(payload.encode("utf-8"))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        CONNECTED_CLIENTS.remove(websocket)
        print(f"🔌 [웹 플래너 연결 종료]: {websocket.remote_address}")

async def main():
    global ser_conn
    target_port = find_nxp_port()

    if target_port:
        try:
            ser_conn = serial.Serial(target_port, BAUD_RATE, timeout=0.1)
            print(f"✅ NXP DEVKIT-MPC5748G 연결 성공! (포트: {target_port}, Baud: {BAUD_RATE})")
            print("💡 온보드 LED: DS4(PA10), DS5(PA7) 제어 대기 중")
            print("🔘 버튼 맵핑: SW1(일정완료), SW2(다음트랙), SW3(스누즈), SW4(패턴순환)")
        except Exception as e:
            print(f"⚠️ {target_port} 포트 열기 실패: {e}")
            print("👉 케이블 연결 및 포트 사용 중 여부를 확인하세요.")
    else:
        print("⚠️ 활성화된 COM 포트를 찾지 못했습니다. 보드 케이블(J10)을 다시 연결해주세요.")

    print(f"🚀 WebSocket 로컬 브릿지 서버 시작됨: ws://{WS_HOST}:{WS_PORT}")
    print("👉 이제 웹 플래너 모달에서 [Python 브릿지 서버 연결]을 클릭하세요!\\n")

    server = await websockets.serve(ws_handler, WS_HOST, WS_PORT)
    await asyncio.gather(server.wait_closed(), serial_reader_task())

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\\n브릿지 서버가 종료되었습니다.")
`;
