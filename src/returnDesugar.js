import { PairValue, StringValue, NumberValue, BooleanValue } from 'r6rs';

// Translates non-R6RS element to R6RS element.
// This is used because writing non-sugared code is too painful.
export default function desugar(element) {
  if (element == null) return new PairValue();
  if (element.type != null) return element;
  if (typeof element === 'string') return new StringValue(element);
  if (typeof element === 'boolean') return new BooleanValue(element);
  if (typeof element === 'number') return new NumberValue(element);
  if (Array.isArray(element)) {
    return PairValue.fromArray(element.map(v => desugar(v)));
  }
  // Unprocessable element
  throw new Error('Unprocessable element: ' + element);
}
