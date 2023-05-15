/**
 * Parse an HTTP Date into a number.
 *
 * @param {string} date
 * @private
 */

export default function parseHttpDate(date: string) {
  let timestamp = date && Date.parse(date);

  // istanbul ignore next: guard against date.js Date.parse patching
  return typeof timestamp === 'number' ? timestamp : NaN;
}
