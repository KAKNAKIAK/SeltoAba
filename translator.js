// translator.js (전체 코드 - 2025-04-30 네 번째 수정: 복사 기능 추가)

// --- 유틸리티: 날짜 기반 나이 계산 함수 ---
function calculateAge(dobStr, departureDateStr) {
    // (이전 코드와 동일)
    const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
    try {
        const day = parseInt(dobStr.substring(0, 2), 10);
        const monthStr = dobStr.substring(2, 5).toUpperCase();
        const yearYY = parseInt(dobStr.substring(5, 7), 10);
        if (isNaN(day) || !(monthStr in months) || isNaN(yearYY)) throw new Error("Invalid DOB format");
        const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100;
        let year = currentCentury + yearYY;
        if (year > new Date().getFullYear()) year -= 100;
        const dob = new Date(Date.UTC(year, months[monthStr], day));
        const departureDate = new Date(departureDateStr + "T00:00:00Z");
        if (isNaN(dob.getTime()) || isNaN(departureDate.getTime())) throw new Error("Invalid date object created.");
        let age = departureDate.getUTCFullYear() - dob.getUTCFullYear();
        const monthDiff = departureDate.getUTCMonth() - dob.getUTCMonth();
        const dayDiff = departureDate.getUTCDate() - dob.getUTCDate();
        if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
        return age;
    } catch (e) {
        console.error(`Age calculation error (DOB: ${dobStr}, Dep: ${departureDateStr}): ${e}`);
        return null;
    }
}

// --- 번역 로직 클래스 ---
class SelconnectToAbacusTranslatorLogic {
    constructor() {
        // (규칙 정의는 이전과 동일)
        this.rules = [
            { pattern: /^\(INF(?<name_title>.*?)\/(?<dob>\d{2}[A-Z]{3}\d{2})\)/i, handler: this._handleInfant, needsContext: false },
            { pattern: /^NM1(?<prefix>.*?)(?<title>MSTR|MISS|MR|MS)\s*\((CHD\/(?<dob>\d{2}[A-Z]{3}\d{2})\))/i, handler: this._handleChild, needsContext: true },
            { pattern: /^AN(.*)\/A(.*)/i, handler: '1$1¤$2', needsContext: false },
            { pattern: /^RT\/(.*)/i, handler: '*- $1', needsContext: false },
            { pattern: /^RT\/?$/i, handler: '*', needsContext: false },
            { pattern: /^APE$/i, handler: '9E*', needsContext: false },
            { pattern: /^APM-SEL$/i, handler: '9T*', needsContext: false },
            { pattern: /^FXB$/i, handler: 'WPNCB', needsContext: false },
            { pattern: /^FXP\/R,U$/i, handler: 'WPA', needsContext: false },
            { pattern: /^ER$/i, handler: '*RR', needsContext: false },
            { pattern: /^sp$/i, handler: 'D', needsContext: false },
            { pattern: /^AN(.*)/i, handler: '1$1', needsContext: false },
            { pattern: /^SS(.*)/i, handler: '0$1', needsContext: false },
            { pattern: /^NM1(.*)/i, handler: '-$1', needsContext: false },
        ];
    }

    _handleInfant(match, context) {
        // (이전 코드와 동일)
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

    _handleChild(match, context) {
        // (이전 코드와 동일 - .trim() 제거됨)
        const data = match.groups;
        const nm1Content = data.prefix;
        const titlePart = data.title;
        const dobStr = data.dob;
        const departureDateStr = context ? context.departure_date : null;
        if (!departureDateStr) return `오류: 소아(CHD) 규칙 적용을 위해 출발일이 필요합니다 (${match[0]})`;
        const age = calculateAge(dobStr, departureDateStr);
        if (age === null) return `오류: 나이를 계산할 수 없습니다 (${match[0]}, DOB: ${dobStr}, Dep: ${departureDateStr})`;
        const result = `-${nm1Content}${titlePart}*C${age}`;
        return result;
    }

    translateSingleEntry(entry, departure_date = null) {
        // (이전 코드와 동일)
        const trimmedEntry = entry.trim();
        if (!trimmedEntry) return "";
        const context = { departure_date: departure_date };
        for (const rule of this.rules) {
            const match = trimmedEntry.match(rule.pattern);
            if (match) {
                if (typeof rule.handler === 'function') {
                    if (rule.needsContext && !departure_date && rule.handler === this._handleChild) {
                         return `오류: '${trimmedEntry}' 규칙 적용을 위해 출발일이 필요합니다.`;
                    }
                    return rule.handler.call(this, match, context);
                } else {
                    return trimmedEntry.replace(rule.pattern, rule.handler);
                }
            }
        }
        return trimmedEntry;
    }

    translate(selconnectInput, departure_date = null) {
        // (이전 코드와 동일 - 다중 승객 처리 포함)
        const trimmedInput = selconnectInput.trim();
        const multiPassengerPattern = /(?<=(?:MR|MS|MISS|MSTR))\s*1\s*/i;
        const startsWithNM1 = /^NM1/i.test(trimmedInput);
        if (multiPassengerPattern.test(trimmedInput)) {
            const parts = trimmedInput.split(multiPassengerPattern);
            const outputSegments = parts.map(part => part.trim())
                                      .filter(part => part)
                                      .map(part => this.translateSingleEntry(part, departure_date));
            if (startsWithNM1 && outputSegments.length > 1) {
                for (let i = 1; i < outputSegments.length; i++) {
                    if (!/^[-\*019W]/.test(outputSegments[i])) {
                        outputSegments[i] = '-' + outputSegments[i];
                    }
                }
            }
            return outputSegments.join('§');
        } else {
             return this.translateSingleEntry(trimmedInput, departure_date);
        }
    }
}

// --- DOM 요소 및 이벤트 리스너 (수정됨: 복사 버튼 로직 추가) ---
document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 가져오기
    const selconnectInput = document.getElementById('selconnectInput');
    const departureDateInput = document.getElementById('departureDate');
    const translateBtn = document.getElementById('translateBtn');
    const outputArea = document.getElementById('outputArea');
    const abacusResult = document.getElementById('abacusResult');
    const copyBtn = document.getElementById('copyBtn'); // 복사 버튼 추가

    // 번역 로직 인스턴스 생성
    const translator = new SelconnectToAbacusTranslatorLogic();

    // --- 변환 실행 로직 함수 ---
    function performTranslation() {
        const inputText = selconnectInput.value;
        const departureDate = departureDateInput.value;

        if (!inputText) {
            abacusResult.textContent = "셀커넥 엔트리를 입력해주세요.";
            outputArea.style.display = 'block';
            copyBtn.style.display = 'none'; // 오류 시 복사 버튼 숨김
            return;
        }

        const translationResult = translator.translate(inputText, departureDate);
        abacusResult.textContent = translationResult;
        outputArea.style.display = 'block';

        // 결과가 오류 메시지인지 확인 (간단한 체크)
        if (translationResult.startsWith("오류:")) {
             copyBtn.style.display = 'none'; // 오류 시 복사 버튼 숨김
        } else {
             copyBtn.style.display = 'inline-block'; // 정상 결과 시 복사 버튼 표시
             copyBtn.textContent = '복사'; // 버튼 텍스트 초기화
        }
    }

    // --- 버튼 클릭 이벤트 리스너 ---
    translateBtn.addEventListener('click', performTranslation);

    // --- Input 필드 keydown 이벤트 리스너 (Enter 키 처리) ---
    selconnectInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            performTranslation();
        }
    });

    // --- 복사 버튼 클릭 이벤트 리스너 추가 ---
    copyBtn.addEventListener('click', () => {
        const textToCopy = abacusResult.textContent;
        if (textToCopy && !textToCopy.startsWith("오류:") && !textToCopy.startsWith("셀커넥")) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                // 복사 성공 피드백
                copyBtn.textContent = '복사 완료!';
                setTimeout(() => {
                    copyBtn.textContent = '복사'; // 1.5초 후 텍스트 원래대로
                }, 1500);
            }).catch(err => {
                console.error('클립보드 복사 실패:', err);
                // 사용자에게 실패 알림 (선택적)
                // copyBtn.textContent = '복사 실패';
            });
        }
    });
});
