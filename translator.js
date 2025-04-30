// translator.js (전체 코드 - 2025-04-30 세 번째 수정)

// --- 유틸리티: 날짜 기반 나이 계산 함수 ---
function calculateAge(dobStr, departureDateStr) {
    // DDMMMYY 형식을 Date 객체가 이해할 수 있는 형태로 변환
    const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
    try {
        const day = parseInt(dobStr.substring(0, 2), 10);
        const monthStr = dobStr.substring(2, 5).toUpperCase();
        const yearYY = parseInt(dobStr.substring(5, 7), 10);

        if (isNaN(day) || !(monthStr in months) || isNaN(yearYY)) {
            throw new Error("Invalid DOB format");
        }

        const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100; // 예: 2000
        let year = currentCentury + yearYY;
        // 현재 연도의 YY보다 크면 이전 세기(1900년대)로 간주 (간단한 추정)
        if (year > new Date().getFullYear()) {
            year -= 100;
        }

        const dob = new Date(Date.UTC(year, months[monthStr], day)); // UTC 기준으로 생성
        const departureDate = new Date(departureDateStr + "T00:00:00Z"); // UTC 자정 기준

        if (isNaN(dob.getTime()) || isNaN(departureDate.getTime())) {
             throw new Error("Invalid date object created.");
        }

        let age = departureDate.getUTCFullYear() - dob.getUTCFullYear();
        const monthDiff = departureDate.getUTCMonth() - dob.getUTCMonth();
        const dayDiff = departureDate.getUTCDate() - dob.getUTCDate();

        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
            age--;
        }
        return age;

    } catch (e) {
        console.error(`Age calculation error (DOB: ${dobStr}, Dep: ${departureDateStr}): ${e}`);
        return null; // 오류 시 null 반환
    }
}

// --- 번역 로직 클래스 ---
class SelconnectToAbacusTranslatorLogic {
    constructor() {
        // 규칙 정의
        this.rules = [
            // 1. 특수 핸들러 규칙 (가장 먼저 처리)
            { pattern: /^\(INF(?<name_title>.*?)\/(?<dob>\d{2}[A-Z]{3}\d{2})\)/i, handler: this._handleInfant, needsContext: false },
            { pattern: /^NM1(?<prefix>.*?)(?<title>MSTR|MISS|MR|MS)\s*\((CHD\/(?<dob>\d{2}[A-Z]{3}\d{2})\))/i, handler: this._handleChild, needsContext: true },

            // 2. 간단한 치환 규칙 (정규식, 대체 문자열)
            { pattern: /^AN(.*)\/A(.*)/i, handler: '1$1¤$2', needsContext: false }, // /A 처리
            { pattern: /^RT\/(.*)/i, handler: '*- $1', needsContext: false },     // RT/ 처리
            { pattern: /^RT\/?$/i, handler: '*', needsContext: false },            // RT 또는 RT/
            { pattern: /^APE$/i, handler: '9E*', needsContext: false },
            { pattern: /^APM-SEL$/i, handler: '9T*', needsContext: false },
            { pattern: /^FXB$/i, handler: 'WPNCB', needsContext: false },
            { pattern: /^FXP\/R,U$/i, handler: 'WPA', needsContext: false },
            { pattern: /^ER$/i, handler: '*RR', needsContext: false },
            { pattern: /^sp$/i, handler: 'D', needsContext: false },

            // 3. 시작 코드 변환 (위 규칙에 안 걸린 경우)
            { pattern: /^AN(.*)/i, handler: '1$1', needsContext: false },
            { pattern: /^SS(.*)/i, handler: '0$1', needsContext: false },
            { pattern: /^NM1(.*)/i, handler: '-$1', needsContext: false }, // 기본 NM1 처리
        ];
    }

    // --- 규칙 처리 핸들러 함수 ---
    _handleInfant(match, context) {
        const data = match.groups;
        const name_title = data.name_title.trim();
        const dobStr = data.dob;
        try {
            const yearYY = dobStr.slice(-2);
            const result = `-I/${name_title}*I${yearYY}`;
            return result;
        } catch (e) {
            const errorMsg = `오류: 유아(INF) 규칙 처리 중 오류 (${match[0]})`;
            return errorMsg;
        }
    }

    // _handleChild 함수 (.trim() 제거된 버전)
    _handleChild(match, context) {
        const data = match.groups;
        const nm1Content = data.prefix; // .trim() 제거됨
        const titlePart = data.title;
        const dobStr = data.dob;
        const departureDateStr = context ? context.departure_date : null;

        if (!departureDateStr) {
            const errorMsg = `오류: 소아(CHD) 규칙 적용을 위해 출발일이 필요합니다 (${match[0]})`;
            return errorMsg;
        }

        const age = calculateAge(dobStr, departureDateStr);
        if (age === null) {
            const errorMsg = `오류: 나이를 계산할 수 없습니다 (${match[0]}, DOB: ${dobStr}, Dep: ${departureDateStr})`;
            return errorMsg;
        }

        const result = `-${nm1Content}${titlePart}*C${age}`;
        return result;
    }


    // --- 단일 항목 번역 함수 ---
    translateSingleEntry(entry, departure_date = null) {
        const trimmedEntry = entry.trim();
        if (!trimmedEntry) return "";

        const context = { departure_date: departure_date };

        for (const rule of this.rules) {
            const match = trimmedEntry.match(rule.pattern);
            if (match) {
                if (typeof rule.handler === 'function') {
                    if (rule.needsContext && !departure_date && rule.handler === this._handleChild) {
                         const errorMsg = `오류: '${trimmedEntry}' 규칙 적용을 위해 출발일이 필요합니다.`;
                         return errorMsg;
                    }
                    return rule.handler.call(this, match, context);
                } else {
                    const result = trimmedEntry.replace(rule.pattern, rule.handler);
                    return result;
                }
            }
        }
        return trimmedEntry; // 어떤 규칙에도 해당되지 않으면 원본 반환
    }

    // --- 메인 번역 함수 (다중 승객 처리 포함 - 수정됨) ---
    translate(selconnectInput, departure_date = null) {
        const trimmedInput = selconnectInput.trim();
        const multiPassengerPattern = /(?<=(?:MR|MS|MISS|MSTR))\s*1\s*/i; // 이름 타이틀 뒤 공백 포함한 '1'
        const startsWithNM1 = /^NM1/i.test(trimmedInput); // 원본 입력이 NM1으로 시작하는지 확인

        if (multiPassengerPattern.test(trimmedInput)) {
            const parts = trimmedInput.split(multiPassengerPattern);
            const outputSegments = parts.map(part => part.trim()) // 각 부분 공백 제거
                                      .filter(part => part) // 빈 부분 제거
                                      .map(part => this.translateSingleEntry(part, departure_date)); // 일단 각 부분 개별 변환

            // --- 추가된 후처리 로직 (다중 승객 '-' 처리) ---
            if (startsWithNM1 && outputSegments.length > 1) {
                for (let i = 1; i < outputSegments.length; i++) {
                    if (!/^[-\*019W]/.test(outputSegments[i])) {
                        outputSegments[i] = '-' + outputSegments[i];
                    }
                }
            }
            // --- 후처리 로직 끝 ---

            return outputSegments.join('§'); // § 문자로 연결
        } else {
            // 단일 승객 또는 기타 항목 처리
             const result = this.translateSingleEntry(trimmedInput, departure_date);
             return result;
        }
    }
}

// --- DOM 요소 및 이벤트 리스너 (수정됨) ---
document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 가져오기
    const selconnectInput = document.getElementById('selconnectInput');
    const departureDateInput = document.getElementById('departureDate');
    const translateBtn = document.getElementById('translateBtn');
    const outputArea = document.getElementById('outputArea');
    const abacusResult = document.getElementById('abacusResult');

    // 번역 로직 인스턴스 생성
    const translator = new SelconnectToAbacusTranslatorLogic();

    // --- 변환 실행 로직을 별도 함수로 분리 ---
    function performTranslation() {
        const inputText = selconnectInput.value;
        const departureDate = departureDateInput.value; // Matisse-MM-DD 형식

        if (!inputText) {
            abacusResult.textContent = "셀커넥 엔트리를 입력해주세요.";
            outputArea.style.display = 'block';
            return;
        }

        // 번역 실행 (결과는 문자열)
        const translationResult = translator.translate(inputText, departureDate);

        // 결과 표시
        abacusResult.textContent = translationResult;
        outputArea.style.display = 'block'; // 결과 영역 보이기
    }

    // --- 버튼 클릭 이벤트 리스너 ---
    translateBtn.addEventListener('click', performTranslation); // 분리된 함수 호출

    // --- Input 필드에 keydown 이벤트 리스너 추가 (Enter 키 처리) ---
    selconnectInput.addEventListener('keydown', (event) => {
        // Enter 키가 눌렸는지 확인
        if (event.key === 'Enter') {
            event.preventDefault(); // Enter 키의 기본 동작 방지
            performTranslation(); // 분리된 변환 함수 호출
        }
    });
});
