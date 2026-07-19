export type EditorTabResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export const applyEditorCompletion = (value: string, selectionStart: number, selectionEnd: number, insertText: string): EditorTabResult => {
  const cursor = Math.min(value.length, Math.max(0, selectionStart));
  const end = Math.min(value.length, Math.max(cursor, selectionEnd));
  const prefix = value.slice(0, cursor).match(/[_A-Za-z][_0-9A-Za-z]*$/)?.[0] ?? '';
  const start = cursor - prefix.length;
  const selection = start + insertText.length;
  return { value: `${value.slice(0, start)}${insertText}${value.slice(end)}`, selectionStart: selection, selectionEnd: selection };
};

const boundedIndentSize = (value: number) => Math.min(16, Math.max(1, Math.trunc(value) || 2));

export const applyEditorTab = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  indentWithTabs: boolean,
  indentSize: number,
  outdent = false,
): EditorTabResult => {
  const start = Math.min(value.length, Math.max(0, selectionStart));
  const end = Math.min(value.length, Math.max(start, selectionEnd));
  const indent = indentWithTabs ? '\t' : ' '.repeat(boundedIndentSize(indentSize));
  if (!outdent && start === end) {
    return {
      value: `${value.slice(0, start)}${indent}${value.slice(end)}`,
      selectionStart: start + indent.length,
      selectionEnd: start + indent.length,
    };
  }

  const blockStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextNewline = value.indexOf('\n', end);
  const blockEnd = nextNewline === -1 ? value.length : nextNewline;
  const lines = value.slice(blockStart, blockEnd).split('\n');
  if (!outdent) {
    const replacement = lines.map((line) => `${indent}${line}`).join('\n');
    return {
      value: `${value.slice(0, blockStart)}${replacement}${value.slice(blockEnd)}`,
      selectionStart: start + indent.length,
      selectionEnd: end + indent.length * lines.length,
    };
  }

  const removals = lines.map((line) => {
    if (line.startsWith('\t')) return 1;
    return Math.min(boundedIndentSize(indentSize), line.length - line.trimStart().length);
  });
  const replacement = lines.map((line, index) => line.slice(removals[index])).join('\n');
  const firstRemovalBeforeStart = Math.min(removals[0], start - blockStart);
  const removedBeforeEnd = removals.reduce((total, removal, index) => {
    if (index === 0) return total + firstRemovalBeforeStart;
    const lineStart = blockStart + lines.slice(0, index).reduce((length, line) => length + line.length + 1, 0);
    return total + (lineStart < end ? removal : 0);
  }, 0);
  return {
    value: `${value.slice(0, blockStart)}${replacement}${value.slice(blockEnd)}`,
    selectionStart: start - firstRemovalBeforeStart,
    selectionEnd: Math.max(start - firstRemovalBeforeStart, end - removedBeforeEnd),
  };
};
