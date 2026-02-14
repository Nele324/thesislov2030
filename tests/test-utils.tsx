import { render as rtlRender, fireEvent as rtlFireEvent, RenderAPI } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import React from 'react';

export async function render(ui: React.ReactElement): Promise<RenderAPI> {
  const result = rtlRender(ui);
  // let microtasks and one macrotask settle so effects run
  await Promise.resolve();
  await new Promise((res) => setTimeout(res, 0));
  return result;
}

export async function fireEvent(callback: () => void) {
  await act(async () => {
    callback();
    // allow any immediate microtasks to run
    await Promise.resolve();
  });
}

export { screen } from '@testing-library/react-native';
export const rtl = { render: rtlRender, fireEvent: rtlFireEvent };
