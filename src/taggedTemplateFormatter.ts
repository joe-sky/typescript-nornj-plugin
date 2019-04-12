import { TextDocument, Range, TextEdit, Position } from 'vscode-languageserver-types';
import { repeat } from './utils/strings';
import format from './format';

const REGEX_EXTERNAL = /\$\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*\})*\})*[^{}]*\}[^{}]*)*[^{}]*\}[^{}]*)*[^{}]*\}[^{}]*)*[^{}]*\}/g;
const REGEX_EXTERNAL_CHAR = /_njEx(\d+)_/g;

export function taggedTemplateFormat(document: TextDocument, range: Range | undefined, options: any): TextEdit[] {
  let value = document.getText();
  let includesEnd = true;
  let initialIndentLevel = 0;
  const tabSize = options.tabSize || 4;
  const externals: string[] = [];

  if (range) {
    let startOffset = document.offsetAt(range.start);

    // include all leading whitespace iff at the beginning of the line
    let extendedStart = startOffset;
    while (extendedStart > 0 && isWhitespace(value, extendedStart - 1)) {
      extendedStart--;
    }
    if (extendedStart === 0 || isEOL(value, extendedStart - 1)) {
      startOffset = extendedStart;
    } else {
      // else keep at least one whitespace
      if (extendedStart < startOffset) {
        startOffset = extendedStart + 1;
      }
    }

    // include all following whitespace until the end of the line
    let endOffset = document.offsetAt(range.end);
    let extendedEnd = endOffset;
    while (extendedEnd < value.length && isWhitespace(value, extendedEnd)) {
      extendedEnd++;
    }
    if (extendedEnd === value.length || isEOL(value, extendedEnd)) {
      endOffset = extendedEnd;
    }
    range = Range.create(document.positionAt(startOffset), document.positionAt(endOffset));

    // Do not modify if substring starts in inside an element
    // Ending inside an element is fine as it doesn't cause formatting errors
    const firstHalf = value.substring(0, startOffset);
    if (new RegExp(/.*[<][^>]*$/).test(firstHalf)) {
      //return without modification
      value = value.substring(startOffset, endOffset);
      return [
        {
          range: range,
          newText: value
        }
      ];
    }

    includesEnd = endOffset === value.length;
    value = value.substring(startOffset, endOffset);

    if (startOffset !== 0) {
      const startOfLineOffset = document.offsetAt(Position.create(range.start.line, 0));
      initialIndentLevel = computeIndentLevel(document.getText(), startOfLineOffset, options);
    }
  } else {
    range = Range.create(Position.create(0, 0), document.positionAt(value.length));
  }
  //   const htmlOptions: IBeautifyHTMLOptions = {
  //     indent_size: tabSize,
  //     indent_char: options.insertSpaces ? ' ' : '\t',
  //     indent_empty_lines: getFormatOption(options, 'indentEmptyLines', false),
  //     wrap_line_length: getFormatOption(options, 'wrapLineLength', 120),
  //     unformatted: getTagsFormatOption(options, 'unformatted', void 0),
  //     content_unformatted: getTagsFormatOption(options, 'contentUnformatted', void 0),
  //     indent_inner_html: getFormatOption(options, 'indentInnerHtml', false),
  //     preserve_newlines: getFormatOption(options, 'preserveNewLines', true),
  //     max_preserve_newlines: getFormatOption(options, 'maxPreserveNewLines', 32786),
  //     indent_handlebars: getFormatOption(options, 'indentHandlebars', false),
  //     end_with_newline: includesEnd && getFormatOption(options, 'endWithNewline', false),
  //     extra_liners: getTagsFormatOption(options, 'extraLiners', void 0),
  //     wrap_attributes: getFormatOption(options, 'wrapAttributes', 'auto'),
  //     wrap_attributes_indent_size: getFormatOption(options, 'wrapAttributesIndentSize', void 0),
  //     eol: '\n'
  //   };

  value = value.replace(REGEX_EXTERNAL, all => {
    externals.push(all);
    return '_njEx' + (externals.length - 1) + '_';
  });

  let result = format(trimLeft(value));
  if (initialIndentLevel > 0) {
    const indent = options.insertSpaces ? repeat(' ', tabSize * initialIndentLevel) : repeat('\t', initialIndentLevel);
    result = result.split('\n').join('\n' + indent);
    if (range.start.character === 0) {
      result = indent + result; // keep the indent
    }
  }
  result = result.replace(REGEX_EXTERNAL_CHAR, (all, g1) => externals[g1]);

  return [
    {
      range: range,
      newText: result
    }
  ];
}

function trimLeft(str: string) {
  return str.replace(/^\s+/, '');
}

function computeIndentLevel(content: string, offset: number, options: any): number {
  let i = offset;
  let nChars = 0;
  const tabSize = options.tabSize || 4;
  while (i < content.length) {
    const ch = content.charAt(i);
    if (ch === ' ') {
      nChars++;
    } else if (ch === '\t') {
      nChars += tabSize;
    } else {
      break;
    }
    i++;
  }
  return Math.floor(nChars / tabSize);
}

function isEOL(text: string, offset: number) {
  return '\r\n'.indexOf(text.charAt(offset)) !== -1;
}

function isWhitespace(text: string, offset: number) {
  return ' \t'.indexOf(text.charAt(offset)) !== -1;
}
