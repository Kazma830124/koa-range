/**
 * Parse a HTTP token list.
 *
 * @param {string} str
 * @private
 */

export default function parseTokenList(str: string) {
  let end = 0;
  let list = [];
  let start = 0;

  // gather tokens
  for (let i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20: /*   */
        if (start === end) {
          end = i + 1;
          start = end;
        }
        break;
      case 0x2c: /* , */
        if (start !== end) {
          list.push(str.substring(start, end));
        }
        end = i + 1;
        start = end;
        break;
      default:
        end = i + 1;
        break;
    }
  }

  // final token
  if (start !== end) {
    list.push(str.substring(start, end));
  }

  return list;
}
