import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ALIB public shell', () => {
  it('renders the core navigation and a path into discovery', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API offline')));
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /ALIB home/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Explore the library/i })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Creator Studio/i }).length).toBeGreaterThan(0);
  });
});
