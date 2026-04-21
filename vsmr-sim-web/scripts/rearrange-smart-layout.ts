/**
 * SMART 원자로 노달라이제이션 다이어그램 기반 노드 재배치 스크립트
 *
 * PDF 참조: documents/SMART_Node_260311.pdf
 * 대상: documents/100%_ICV.json
 *
 * 각 CCC 번호를 PDF 다이어그램의 실제 위치와 대조하여 배치.
 * [PDF] 마크 = PDF에서 직접 확인한 컴포넌트
 * [INF] 마크 = 인접 컴포넌트로부터 위치 추정
 *
 * 사용법: npx tsx scripts/rearrange-smart-layout.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 캔버스 좌표 매핑: PDF 다이어그램 → ReactFlow 캔버스
// 캔버스 크기: ~9000 x 8000 (수력), 열구조체는 y=8500+ 영역
// ============================================================

const POS: Record<number, [number, number]> = {
  // ================================================================
  // 1. DEAERATOR (PDF 최상단 중앙)
  //    PDF: C662, C660 두 개의 탱크, J859 아래 연결
  // ================================================================
  662: [3200, 500],    // [PDF] C662 - 탈기기 좌측 탱크
  660: [3600, 500],    // [PDF] C660 - 탈기기 우측 탱크
  661: [3400, 700],    // [INF] poolj - 탈기기 하부 pool junction
  663: [3200, 700],    // [INF] junc - C662 하부 연결

  // ================================================================
  // 2. MSR / REHEATER 영역 (PDF 상단)
  //    PDF: C908, J909, J907, C912, C914, C910(Reheater), C620, C916, C622
  // ================================================================
  908: [1600, 1200],   // [PDF] C908 - 바이패스 파이프 (-01...-23), J907 아래
  909: [1800, 1000],   // [PDF] J909 - C908 우측 연결 junction (valve LPbyp4)
  907: [1400, 1400],   // [PDF] J907 - C908 아래 (valve sgtbn)
  912: [2200, 1400],   // [PDF] C912 - 바이패스 파이프 (-01 -02)
  914: [2600, 1400],   // [PDF] C914 - 바이패스 파이프 (-01...-04)
  910: [3800, 1200],   // [PDF] C910 - Reheater 파이프
  620: [4000, 1000],   // [PDF] C620 - Reheater 출구
  622: [4400, 900],    // [PDF] C622 - LP 방향 연결 파이프 (-04)
  916: [3800, 1500],   // [PDF] C916 - Reheater 하부 파이프

  // ================================================================
  // 3. HIGH PRESSURE TURBINE (PDF 좌측 상단)
  //    PDF: C606(Governor valve), C608, TBN610, TBN612, TBN614
  // ================================================================
  606: [1400, 2000],   // [PDF] C606 - Governor valve 전단 파이프 (-01...-05)
  607: [1600, 2000],   // [INF] GValve - Governor valve (C606과 C608 사이)
  608: [1800, 1800],   // [PDF] C608 - HP 터빈 전단 파이프 (-01...-05)
  610: [2200, 1800],   // [PDF] TBN610 - HP 터빈 1단
  612: [2500, 1800],   // [PDF] TBN612 - HP 터빈 2단
  614: [2800, 1800],   // [PDF] TBN614 - HP 터빈 3단
  615: [3100, 1800],   // [INF] junc2 - HP 터빈 후단 junction

  // ================================================================
  // 4. SEPARATOR (PDF 중앙)
  //    PDF: C616, C618(SEPERATOR)
  // ================================================================
  616: [3300, 1800],   // [PDF] C616 - Separator 전단 파이프 (-01 -02)
  618: [3600, 1700],   // [PDF] C618 - SEPARATOR

  // ================================================================
  // 5. LOW PRESSURE TURBINE (PDF 우측 상단)
  //    PDF: TBN624, TBN626, TBN628, TBN630, TBN632
  // ================================================================
  668: [4400, 1600],   // [PDF] C668 - LP 터빈 전단 파이프 (-13...-01)
  720: [4400, 1900],   // [PDF] C720 - Separator 드레인 SEP
  722: [4600, 1900],   // [PDF] C722 - LP 연결 파이프
  624: [4900, 1700],   // [PDF] TBN624 - LP 터빈 1단
  626: [5200, 1700],   // [PDF] TBN626 - LP 터빈 2단
  628: [5500, 1700],   // [PDF] TBN628 - LP 터빈 3단
  630: [5800, 1700],   // [PDF] TBN630 - LP 터빈 4단
  632: [6100, 1700],   // [PDF] TBN632 - LP 터빈 5단
  621: [4600, 1700],   // [INF] sbout - separator outlet junction
  633: [6300, 1700],   // [INF] tbout - LP 터빈 후단 junction

  // ================================================================
  // 6. CONDENSER (PDF 우측)
  //    PDF: C634, C938, C636(CONDENSER)
  // ================================================================
  634: [6600, 1500],   // [PDF] C634 - 복수기 전단 파이프
  635: [6800, 1500],   // [INF] jun01 - 복수기 전 junction
  938: [7200, 1200],   // [PDF] C938 - 복수기 상부 파이프 (-06)
  937: [7200, 1000],   // [INF] poolj - 복수기 pool junction
  636: [7200, 1500],   // [PDF] C636 - CONDENSER 본체

  // ================================================================
  // 7. SEAWATER TDVs (PDF 우측 끝)
  //    PDF: TDV998, TDV986/TDJ987, TDV990/TDJ991, TDV994/TDJ995
  //         C996, C992, C988 (냉각수 튜브)
  // ================================================================
  998: [8200, 1200],   // [PDF] TDV998 - 해수 TDV (최상단)
  996: [7600, 1300],   // [PDF] C996 - 냉각수 튜브
  997: [7800, 1300],   // [INF] outlet junction
  988: [7600, 1600],   // [PDF] C988 - 냉각수 튜브
  989: [7800, 1600],   // [INF] outlet junction
  987: [8000, 1600],   // [PDF] TDJ987
  986: [8200, 1600],   // [PDF] TDV986 - 해수 TDV
  992: [7600, 1900],   // [PDF] C992 - 냉각수 튜브
  993: [7800, 1900],   // [INF] outlet junction
  991: [8000, 1900],   // [PDF] TDJ991
  990: [8200, 1900],   // [PDF] TDV990 - 해수 TDV
  994: [8200, 2200],   // [PDF] TDV994 - 해수 TDV
  995: [8000, 2200],   // [PDF] TDJ995

  // ================================================================
  // 8. CONDENSATE PUMP → FW LINE (PDF 우측→좌측 급수 흐름)
  //    PDF: C637→C638→C640(Condensate pump)→C642→...
  // ================================================================
  637: [7200, 1800],   // [INF] tbout - 복수기 출구 junction
  638: [7000, 2200],   // [PDF] C638 - FW라인 (-07...-01)
  640: [6800, 2500],   // [PDF] C640 - Condensate pump (-01...-05)
  642: [6600, 2200],   // [PDF] C642 - FW라인
  643: [6400, 2200],   // [INF] LPFCV - LP 급수 제어밸브
  644: [6200, 2600],   // [PDF] C644 - FW라인
  645: [6000, 2600],   // [INF] junc
  646: [5800, 2800],   // [PDF] C646 - FW라인
  647: [5600, 2800],   // [INF] junc
  648: [5400, 2800],   // [PDF] C648 - FW라인
  649: [5200, 2800],   // [INF] junc
  650: [5000, 2900],   // [PDF] C650 - FW라인 (-03...-01)
  651: [4800, 2900],   // [INF] junc
  652: [4600, 2900],   // [PDF] C652 - FW라인
  653: [4400, 2900],   // [INF] junc
  654: [4200, 2700],   // [PDF] C654 - FW라인 (-08...-01)
  655: [4000, 2700],   // [INF] junc
  656: [4200, 3000],   // [PDF] C656 - FWHX5 (LP가열기 #5 튜브)
  657: [4000, 3000],   // [INF] junc

  // ================================================================
  // 9. LP FW HEATER 셸측 - 추출 증기 연결
  //    PDF: C730, C738, C746, C754, C780, C776, C772, C768
  // ================================================================
  // 추출증기 연결 파이프 (LP Heater 셸측 상부)
  730: [4200, 3300],   // [PDF] C730 - E6 추출 연결
  731: [4200, 3500],   // [INF] junc
  738: [4700, 3100],   // [PDF] C738 - 추출 연결 joint
  739: [4700, 3300],   // [INF] junc
  746: [5200, 3100],   // [PDF] C746 - E9 추출 연결
  747: [5200, 3300],   // [INF] junc
  754: [5700, 3100],   // [PDF] C754 - E10 추출 연결
  755: [5700, 3300],   // [INF] junc (J755 in PDF)

  // 바이패스 라인 (LP 터빈 추출 바이패스)
  780: [4600, 2500],   // [PDF] C780 - byline5 (-02 -01)
  781: [4600, 2700],   // [INF] byps5 (J781 in PDF)
  779: [4600, 2300],   // [INF] junc
  776: [5100, 2500],   // [PDF] C776 - byline6 (-03...-01)
  777: [5100, 2700],   // [INF] byps6 (J777 in PDF)
  775: [5100, 2300],   // [INF] junc
  772: [5400, 2300],   // [PDF] C772 - byline7 (-01 -02)
  773: [5400, 2500],   // [INF] byps7 (J773 in PDF)
  771: [5400, 2100],   // [INF] junc
  768: [5700, 2400],   // [PDF] C768 - byline8 (-02 -01)
  769: [5700, 2600],   // [INF] byps8 (J769 in PDF)
  767: [5700, 2200],   // [INF] junc

  // ================================================================
  // 10. LP FW HEATER 셸측 - Heater 쌍 (PDF 하단 3열)
  //     PDF: C726/C724/C728, C734/C732/C736, C742/C740/C744, C750/C748/C752
  // ================================================================
  // LP Heater #4 (E7)
  726: [4500, 3700],   // [PDF] C726 - lpfw4sa
  724: [4700, 3700],   // [PDF] C724 - lpfw4sh
  728: [4900, 3700],   // [PDF] C728 - lpfw4sb
  725: [4500, 3900],   // [INF] junc
  727: [4700, 3900],   // [INF] junc
  729: [4900, 3900],   // [INF] junc

  // LP Heater #3 (E8)
  734: [4500, 4100],   // [PDF] C734 - lpfw3sa
  732: [4700, 4100],   // [PDF] C732 - lpfw3sh
  736: [4900, 4100],   // [PDF] C736 - lpfw3sb
  733: [4500, 4300],   // [INF] junc
  735: [4700, 4300],   // [INF] junc
  737: [4900, 4300],   // [INF] junc

  // LP Heater #2 (E9)
  742: [5400, 3700],   // [PDF] C742 - lpfw2sa
  740: [5600, 3700],   // [PDF] C740 - lpfw2sh
  744: [5800, 3700],   // [PDF] C744 - lpfw2sb
  741: [5400, 3900],   // [INF] junc
  743: [5600, 3900],   // [INF] junc
  745: [5800, 3900],   // [INF] junc

  // LP Heater #1 (E10)
  750: [5400, 4100],   // [PDF] C750 - lpfw1sa
  748: [5600, 4100],   // [PDF] C748 - lpfw1sh
  752: [5800, 4100],   // [PDF] C752 - lpfw1sb
  749: [5400, 4300],   // [INF] junc
  751: [5600, 4300],   // [INF] junc
  753: [5800, 4300],   // [INF] junc

  // LP 바이패스 valve (E7 바이패스)
  721: [4400, 2100],   // [INF] byps4_1 junction
  723: [4400, 2300],   // [INF] byps4 valve

  // ================================================================
  // 11. DEAERATOR → FW PUMP 연결
  //     PDF: C664, C666(Feedwater pump), C668
  // ================================================================
  659: [3800, 2500],   // [INF] junc - LP heater → deaerator 연결
  664: [3600, 2500],   // [PDF] C664 - 파이프 (-01...-09)
  658: [3800, 2000],   // [PDF] C658 - 파이프 near separator (-08...-01)
  666: [3800, 3500],   // [PDF] C666 - Feedwater pump
  668: [3800, 3200],   // [PDF] C668 area (but labeled near LP turbine in PDF text)
  669: [3600, 3200],   // [INF] junc

  // ================================================================
  // 12. HP FW HEATER (PDF 좌측 중앙)
  //     FW Pump → C670(FWHX6) → C672(h6to7) → C674(FWHX7) → C676 → SG
  // ================================================================
  670: [3200, 3500],   // [PDF] C670 - FWHX6
  671: [3000, 3500],   // [INF] junc
  672: [2800, 3500],   // [PDF] C672 - h6to7 파이프 (-10...-01)
  673: [2600, 3500],   // [INF] junc
  674: [2400, 3500],   // [PDF] C674 - FWHX7 (-03...-01)
  675: [2200, 3500],   // [INF] junc
  676: [2000, 3500],   // [PDF] C676 - 파이프 (-04...-01)
  820: [2600, 3800],   // [PDF] C820 - HP가열기 셸 (-01...-06)
  821: [2600, 4000],   // [INF] junc
  828: [3400, 2200],   // [PDF] C828 - 파이프 (-01...-12)
  829: [3400, 2400],   // [INF] junc (J829 in PDF)

  // HP Heater #1 (E1/E2 추출)
  816: [1800, 3900],   // [PDF] C816 - hpfw1sa
  814: [2000, 3900],   // [PDF] C814 - hpfw1sh
  818: [2200, 3900],   // [PDF] C818 - hpfw1sb
  815: [1800, 4100],   // [INF] junc
  817: [2000, 4100],   // [INF] junc
  819: [2200, 4100],   // [INF] junc

  // HP Heater #2 (E3/E4 추출)
  824: [1800, 4300],   // [PDF] C824 - hpfw2sa
  822: [2000, 4300],   // [PDF] C822 - hpfw2sh
  826: [2200, 4300],   // [PDF] C826 - hpfw2sb
  823: [1800, 4500],   // [INF] junc
  825: [2000, 4500],   // [INF] junc
  827: [2200, 4500],   // [INF] junc

  // HP 추출 바이패스 & 연결
  812: [2200, 2300],   // [PDF] C812 - byln1_1 (-11...-01)
  813: [2000, 2500],   // [PDF] J813 - HPbyp2 junction
  811: [2200, 2100],   // [INF] HPbyp1 valve
  809: [2200, 1900],   // [INF] junc - HP 추출 junction
  834: [2500, 2500],   // [PDF] C834 - byline2 (-08...-01)
  835: [2500, 2700],   // [PDF] J835 - byps2 junction
  833: [2500, 2300],   // [INF] junc
  858: [3100, 1600],   // [PDF] C858 - byline3 (E5 추출) (-13...-01)
  857: [3100, 1400],   // [INF] junc
  859: [3300, 1600],   // [INF] byps3 valve (J859 in PDF = near deaerator too)
  913: [2600, 1200],   // [INF] HPbyp3 valve
  919: [2000, 1200],   // [INF] HPbyp3_1 valve
  914: [2800, 1200],   // [PDF] C914 위치와 동일(byln1_2) → 재할당
  911: [4200, 1000],   // [PDF] J911 junction
  917: [3800, 1400],   // [PDF] J917 junction

  // ================================================================
  // 13. PRIMARY SYSTEM - RPV & CORE (PDF 좌측 하단)
  //     PDF: C100/C110, C120, C130(hot), C140(bypass), C150, C160, C170, C180
  //          SJ105, SJ115, SJ145, MJ155, SJ275, SJ259, SJ265
  // ================================================================
  // 노심 영역 (수직 배치: 하→상)
  260: [700, 7100],    // [PDF] C260 - 하부 헤드 (RPV 최하단)
  100: [700, 6800],    // [PDF] C100 - 코어 슈라우드 내부 (sk_inner)
  110: [700, 6500],    // [PDF] C110 - 코어 플레넘 (branch)
  115: [500, 6700],    // [PDF] SJ115 - inlet_cb junction
  120: [700, 6100],    // [PDF] C120 - 코어 평균 채널 (-01...-12)
  125: [900, 6200],    // [INF] core_crs - 크로스플로 mtpljun
  130: [500, 6100],    // [INF] core_hot - 코어 고온 채널 (C120 병렬)
  140: [300, 6500],    // [PDF] C140 - 코어 바이패스
  145: [300, 6700],    // [PDF] SJ145 - inlet_cb junction
  150: [700, 5700],    // [PDF] C150 - 상부 플레넘 (-07)
  155: [500, 5900],    // [PDF] MJ155 - in_csb junction
  160: [500, 5500],    // [PDF] C160 - UGS 파이프 (-01...-06)
  165: [700, 5500],    // [INF] ugs_crs - UGS 크로스플로
  170: [300, 5700],    // [INF] an_csb - CSB 환형관
  175: [300, 5500],    // [PDF] SJ275 - out_csa junction
  180: [300, 5200],    // [PDF] C180 - UGS 환형관/다운커머 (4루프 공통)
  261: [900, 6800],    // [INF] sk_hole junction

  // 가압기 (RPV 우측으로 분기)
  265: [1100, 6500],   // [PDF] SJ265 → [PDF] SJ259 근처, in-surge
  270: [1300, 6200],   // [PDF] C270 - 가압기 서지관 (-01 02)
  275: [1400, 5900],   // [INF] in-pzr junction
  280: [1400, 5600],   // [PDF] C280 - 가압기 (-01 07)
  289: [1400, 5300],   // [INF] pzr_ij junction
  290: [1400, 5100],   // [INF] pzr_top (tmdpvol)
  291: [1600, 5300],   // [INF] pzrpsv1 (safety valve)
  292: [1800, 5300],   // [INF] prt1 (PRT tmdpvol)

  // RCPs (4대 펌프)
  181: [600, 5000],    // [PDF] C181 - RCP#1
  182: [900, 5000],    // [PDF] C182 - RCP#2 (C252→C210→C240→C180→C182 경로)
  183: [1200, 5000],   // [PDF] C183 - RCP#3
  184: [1500, 5000],   // [PDF] C184 - RCP#4
  190: [900, 4800],    // [INF] discharge mtpljun
  191: [600, 4800],    // [INF] dis_rcp1
  192: [800, 4800],    // [PDF] C192 - dis_rcp2 (PDF 텍스트에 C192 명시)
  193: [1100, 4800],   // [PDF] C193 - dis_rcp3
  194: [1400, 4800],   // [PDF] C194 - dis_rcp4
  195: [900, 4600],    // [INF] br_disbr (discharge branch)

  // SG 1차측 (RPV → SG 튜브 연결)
  200: [700, 4600],    // [PDF] C200 - sg12 파이프 (-01 14)
  205: [500, 4600],    // [INF] out-sg12 junction
  210: [900, 4400],    // [PDF] C210 - sg34 (C252 경로)
  215: [1100, 4400],   // [INF] out-sg34 junction
  220: [1200, 4400],   // [PDF] C220 - sg56 (C254 경로)
  225: [1400, 4400],   // [INF] out-sg56 junction
  230: [1500, 4400],   // [PDF] C230 - sg78 (C256 경로)
  235: [1700, 4400],   // [INF] out-sg78 junction
  240: [1000, 4600],   // [PDF] C240 - SG 바이패스 (-01 08)
  245: [1200, 4600],   // [INF] out-sgby junction
  246: [1000, 4200],   // [INF] fmhamj (FMHA mtpljun)

  // FMHA & 하부 구조물
  250: [500, 7200],    // [PDF] C250 - FMHA 파이프
  251: [600, 7200],    // [INF] fmha-j1
  252: [700, 6200],    // [PDF] C252 - FMHA2 (C252→C210 경로 명시)
  253: [800, 6400],    // [INF] fmha-j2
  254: [900, 6400],    // [PDF] C254 - FMHA3 (C254→C220 경로 명시)
  255: [1000, 6400],   // [INF] fmha-j3
  256: [1100, 6400],   // [PDF] C256 - FMHA4 (C256→C230 경로 명시)
  257: [1200, 6400],   // [INF] fmha-j4
  258: [400, 7000],    // [PDF] C258 - fmha_out (PDF에서 C258 반복 확인)
  259: [400, 7200],    // [INF] fmha2fsh junction

  // ================================================================
  // 14. STEAM GENERATOR #1 (PDF 하단 좌측)
  //     PDF: C310(-16...-01), C305, V303, C302, V317, C382, C315(-01...-13)
  //          MFIV, MSIV, J307, J313
  // ================================================================
  302: [2800, 5600],   // [PDF] C302 - FW 헤더
  303: [2700, 5600],   // [PDF] V303 - MFIV (Main Feed Isolation Valve)
  305: [2600, 5400],   // [PDF] C305 - FW 파이프
  307: [2600, 5200],   // [PDF] J307 - FW→SG junction
  310: [2600, 4900],   // [PDF] C310 - SG 튜브 (-16...-01)
  313: [2800, 4900],   // [PDF] J313 - 증기 라인 junction
  315: [2800, 5200],   // [PDF] C315 - 주증기관 (-01...-13)
  317: [2900, 5400],   // [PDF] V317 - MSIV (Main Steam Isolation Valve)

  // ================================================================
  // 15. STEAM GENERATOR #2 (PDF SG#1 우측)
  //     PDF: C330, C325, V323, C322, V337, C382, C335, J327, J333
  // ================================================================
  322: [3400, 5800],   // [PDF] C322
  323: [3300, 5800],   // [PDF] V323 - MFIV
  325: [3200, 5600],   // [PDF] C325 - FW 파이프
  327: [3200, 5400],   // [PDF] J327 - junction
  330: [3200, 5100],   // [PDF] C330 - SG 튜브 (-16...-01)
  333: [3400, 5100],   // [PDF] J333 - junction
  335: [3400, 5400],   // [PDF] C335 - 주증기관 (-01...-13)
  337: [3500, 5600],   // [PDF] V337 - MSIV

  // ================================================================
  // 16. STEAM GENERATOR #3 (PDF 하단)
  //     PDF: C350, C345, V343, C342, V357, C382, C355, J347
  // ================================================================
  342: [2800, 6600],   // [PDF] C342
  343: [2700, 6600],   // [PDF] V343 - MFIV
  345: [2600, 6400],   // [PDF] C345 - FW 파이프
  347: [2600, 6200],   // [PDF] J347 - junction
  350: [2600, 5900],   // [PDF] C350 - SG 튜브 (-16...-01)
  353: [2800, 5900],   // [INF] sl_j3 junction
  355: [2800, 6200],   // [PDF] C355 - 주증기관 (-01...-13)
  357: [2900, 6400],   // [PDF] V357 - MSIV

  // ================================================================
  // 17. STEAM GENERATOR #4 (PDF SG#3 우측)
  //     PDF: C370, C365, V363, C362, V377, C382, C375, J367
  // ================================================================
  362: [3400, 6600],   // [PDF] C362
  363: [3300, 6600],   // [PDF] V363 - MFIV
  365: [3200, 6400],   // [PDF] C365 - FW 파이프
  367: [3200, 6200],   // [PDF] J367 - junction
  370: [3200, 5900],   // [PDF] C370 - SG 튜브 (-16...-01)
  373: [3400, 5900],   // [INF] sl_j4 junction
  375: [3400, 6200],   // [PDF] C375 - 주증기관 (-01...-13)
  377: [3500, 6400],   // [PDF] V377 - MSIV

  // ================================================================
  // 18. MAIN STEAM LINE → 터빈 연결
  //     PDF: C382(증기헤더), C383→C606→C607→C608→TBN610
  // ================================================================
  382: [3000, 5200],   // [PDF] C382 - 증기 헤더 (4개 SG 공통)
  383: [3000, 4900],   // [INF] byps4_1 - 증기라인 junction
  301: [3000, 5400],   // [INF] stbc_j - 증기 BC junction
};

// ================================================================
// 메인 변환 로직
// ================================================================

function main() {
  const inputPath = path.resolve('documents/100%_ICV.json');
  const outputPath = path.resolve('documents/100%_ICV_rearranged.json');

  console.log(`입력: ${inputPath}`);
  console.log(`출력: ${outputPath}\n`);

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const project = JSON.parse(raw);

  const nodes = project.nodes as Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: {
      componentId: string;
      componentName: string;
      componentType: string;
      [key: string]: any;
    };
  }>;

  let mapped = 0;
  let unmapped = 0;
  const unmappedList: string[] = [];
  let htstrCount = 0;
  let htstrMapped = 0;
  let htstrFallback = 0;

  // ============================================================
  // 열구조체 배치 전략:
  // MARS 열구조체의 CCC 번호 = 연결된 수력 컴포넌트의 CCC 번호
  // → 해당 수력 컴포넌트 우측에 오프셋하여 배치
  // 같은 CCC의 여러 열구조체는 수직으로 스택
  // ============================================================

  // 1단계: 수력 컴포넌트 먼저 배치 (위치 참조용)
  for (const node of nodes) {
    if (node.type === 'htstr') continue;
    const componentId = parseInt(node.data.componentId, 10);
    const ccc = Math.floor(componentId / 10000);
    if (POS[ccc]) {
      const [x, y] = POS[ccc];
      node.position = { x, y };
      mapped++;
    } else {
      unmapped++;
      unmappedList.push(`C${ccc} (${node.type} ${node.data.componentName})`);
    }
  }

  // 2단계: 열구조체 → 연결된 수력 컴포넌트 옆에 배치
  // 같은 CCC를 가진 열구조체 카운터 (수직 스택용)
  const htstrCccCount: Record<number, number> = {};

  for (const node of nodes) {
    if (node.type !== 'htstr') continue;
    htstrCount++;

    const componentId = parseInt(node.data.componentId, 10);
    const ccc = Math.floor(componentId / 10000);

    // 연결된 수력 컴포넌트의 위치 찾기
    if (POS[ccc]) {
      const [baseX, baseY] = POS[ccc];
      const stackIdx = htstrCccCount[ccc] || 0;
      htstrCccCount[ccc] = stackIdx + 1;

      // 수력 컴포넌트 우측 +180px, 같은 CCC 열구조체는 아래로 스택
      node.position = {
        x: baseX + 180,
        y: baseY + stackIdx * 160,
      };
      htstrMapped++;
      mapped++;
    } else {
      // 수력 컴포넌트 위치 없음 → 하단 격자 배치
      const col = htstrFallback % 14;
      const row = Math.floor(htstrFallback / 14);
      node.position = {
        x: 200 + col * 250,
        y: 8500 + row * 200,
      };
      htstrFallback++;
      mapped++;
    }
  }

  // 매핑 안 된 수력 컴포넌트 → 별도 격자 배치
  if (unmappedList.length > 0) {
    console.log(`\n⚠️ PDF에서 미확인 수력 컴포넌트 (${unmappedList.length}개):`);
    let idx = 0;
    for (const node of nodes) {
      const componentId = parseInt(node.data.componentId, 10);
      const ccc = Math.floor(componentId / 10000);
      const isHtstr = node.type === 'htstr';

      if (!isHtstr && !POS[ccc]) {
        const col = idx % 10;
        const row = Math.floor(idx / 10);
        node.position = {
          x: 200 + col * 280,
          y: 7600 + row * 220,
        };
        console.log(`  C${ccc} (${node.data.componentName}) → 미매핑 격자 배치`);
        idx++;
      }
    }
  }

  // 열구조체 배치 통계
  console.log(`\n=== 열구조체 배치 상세 ===`);
  for (const [ccc, count] of Object.entries(htstrCccCount).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const hydroPos = POS[Number(ccc)];
    if (hydroPos) {
      console.log(`  S${ccc} (${count}개) → C${ccc} 옆 (x=${hydroPos[0]+180}, y=${hydroPos[1]}~${hydroPos[1]+(count-1)*160})`);
    }
  }

  // JSON 저장
  const jsonStr = JSON.stringify(project, null, 2);
  fs.writeFileSync(outputPath, jsonStr, 'utf-8');

  console.log(`\n=== 재배치 결과 ===`);
  console.log(`총 노드: ${nodes.length}개`);
  console.log(`수력 컴포넌트 매핑: ${mapped}개`);
  console.log(`열구조체: ${htstrCount}개 (연결 수력 옆: ${htstrMapped}, 폴백: ${htstrFallback})`);
  console.log(`미매핑 수력: ${unmappedList.length}개`);
  console.log(`\n출력 파일: ${outputPath}`);
}

main();
