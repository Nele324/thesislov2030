import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../Pages/App';

test('renders Choose Mode header', () => {
  render(<App />);
  const headerElement = screen.getByText(/Kies een Test Scenario/i);
  expect(headerElement).toBeInTheDocument();
});
