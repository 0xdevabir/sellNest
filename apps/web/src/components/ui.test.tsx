import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, ConfirmDialog, Field, Input } from './ui';
import { Pagination } from './ui-core';

describe('Field', () => {
  it('links the label and error to the input', () => {
    render(<Field label="Email" error="Enter a valid email address">{(p) => <Input {...p} />}</Field>);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email address');
  });
});

describe('Button', () => {
  it('is disabled while loading so a form cannot submit twice', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  it('runs the action only on confirm', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open onOpenChange={() => undefined} title="Delete this listing?" description="Gone for good." confirmLabel="Delete" danger onConfirm={onConfirm} />);
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} href={(p) => `/explore?page=${p}`} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('links to the next page', () => {
    render(<Pagination page={1} totalPages={3} href={(p) => `/explore?page=${p}`} />);
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute('href', '/explore?page=2');
  });
});
