/**
 * SVG Sanitizer
 * 외부 SVG 파일의 XSS 벡터를 제거하고 안전한 마크업을 반환
 */

// 제거 대상 태그
const DANGEROUS_TAGS = new Set([
  'script', 'foreignobject', 'iframe', 'object', 'embed',
  'applet', 'base', 'form', 'input', 'textarea', 'button', 'select',
]);

// 제거 대상 속성 패턴
const DANGEROUS_ATTR_PATTERNS = [
  /^on/i,             // onclick, onload 등 모든 이벤트 핸들러
  /^xlink:href$/i,    // 외부 리소스 링크 (data: URI 허용 제외)
  /^href$/i,          // SVG 2.0 href
  /^formaction$/i,
];

export interface SanitizeResult {
  sanitizedMarkup: string;
  viewBox: string;
  warnings: string[];
}

const DEFAULT_VIEWBOX = '0 0 100 100';
const MAX_SVG_SIZE = 1024 * 1024; // 1MB

/**
 * SVG 파일 크기 검증
 */
export function validateSvgSize(file: File): string | null {
  if (file.size > MAX_SVG_SIZE) {
    return `SVG 파일 크기가 1MB를 초과합니다 (${(file.size / 1024).toFixed(0)}KB)`;
  }
  return null;
}

/**
 * SVG 문자열을 파싱하고 위험 요소를 제거
 */
export function sanitizeSvg(rawSvg: string): SanitizeResult {
  const warnings: string[] = [];

  // DOMParser로 SVG 파싱
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');

  // 파싱 에러 체크
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return {
      sanitizedMarkup: '',
      viewBox: DEFAULT_VIEWBOX,
      warnings: ['SVG 파싱 실패: 유효하지 않은 SVG 파일입니다.'],
    };
  }

  const svgElement = doc.querySelector('svg');
  if (!svgElement) {
    return {
      sanitizedMarkup: '',
      viewBox: DEFAULT_VIEWBOX,
      warnings: ['SVG 루트 요소를 찾을 수 없습니다.'],
    };
  }

  // viewBox 추출
  let viewBox = svgElement.getAttribute('viewBox') || '';
  if (!viewBox) {
    // width/height에서 viewBox 유추
    const w = svgElement.getAttribute('width');
    const h = svgElement.getAttribute('height');
    if (w && h) {
      const wNum = parseFloat(w);
      const hNum = parseFloat(h);
      if (!isNaN(wNum) && !isNaN(hNum)) {
        viewBox = `0 0 ${wNum} ${hNum}`;
      }
    }
    if (!viewBox) {
      viewBox = DEFAULT_VIEWBOX;
    }
  }

  // 재귀적으로 위험 요소 제거
  removeDangerousElements(svgElement, warnings);

  // SVG 루트 속성 정리: width/height 제거 (CSS로 스케일링)
  svgElement.removeAttribute('width');
  svgElement.removeAttribute('height');
  svgElement.setAttribute('viewBox', viewBox);

  // 직렬화
  const serializer = new XMLSerializer();
  const sanitizedMarkup = serializer.serializeToString(svgElement);

  return { sanitizedMarkup, viewBox, warnings };
}

/**
 * 재귀적으로 위험 태그/속성 제거
 */
function removeDangerousElements(element: Element, warnings: string[]): void {
  // 자식 요소를 역순으로 순회 (삭제 시 인덱스 변동 방지)
  const children = Array.from(element.children);
  for (const child of children) {
    const tagName = child.tagName.toLowerCase();

    if (DANGEROUS_TAGS.has(tagName)) {
      warnings.push(`제거됨: <${tagName}> 태그`);
      child.remove();
      continue;
    }

    // 속성 검사
    const attrsToRemove: string[] = [];
    for (const attr of Array.from(child.attributes)) {
      if (DANGEROUS_ATTR_PATTERNS.some(p => p.test(attr.name))) {
        attrsToRemove.push(attr.name);
      }
    }
    for (const attrName of attrsToRemove) {
      warnings.push(`제거됨: ${child.tagName} 요소의 ${attrName} 속성`);
      child.removeAttribute(attrName);
    }

    // 재귀
    removeDangerousElements(child, warnings);
  }
}

/**
 * SVG 파일을 읽어서 문자열로 반환
 */
export function readSvgFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('SVG 파일 읽기 실패'));
    reader.readAsText(file);
  });
}
