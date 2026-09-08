import { extractPlaceholderKeys, interpolatePlaceholders } from './placeholders';

describe('placeholders', () => {
  it('interpolates variables', () => {
    expect(
      interpolatePlaceholders('Hi {{name}}, amount ₹{{amount}}', {
        name: 'Alex',
        amount: '499',
      }),
    ).toBe('Hi Alex, amount ₹499');
  });

  it('extracts keys', () => {
    expect(extractPlaceholderKeys('{{name}} paid {{amount}} on {{date}}')).toEqual([
      'name',
      'amount',
      'date',
    ]);
  });
});