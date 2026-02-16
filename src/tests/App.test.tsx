import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../Pages/App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/react yey/i);
  expect(linkElement).toBeInTheDocument();
});
