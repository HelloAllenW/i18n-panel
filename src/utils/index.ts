export * from './Log'
export * from './Message'
export * from './Languages'
export * from './Webview'

export function convertToCamelCase(input: string): string {
  const words = input.split(/\s+|-|_/); // 分割字符串，考虑空格、连字符和下划线
  if (words.length === 0) {
    return '';
  }

  const camelCaseWords = words.map((word, index) => {
    if (index === 0) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return camelCaseWords.join('');
}