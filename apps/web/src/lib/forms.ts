import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, errorMessage } from './api';

/** Shows server validation errors beside their fields, and returns anything left for a form-level notice. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>, fields: readonly string[]): string | null {
  if (e instanceof ApiError && e.details?.length) {
    const unmatched = e.details.filter((d) => {
      if (!fields.includes(d.path)) return true;
      setError(d.path as Path<T>, { message: d.message });
      return false;
    });
    return unmatched.length ? (unmatched[0]?.message ?? e.message) : null;
  }
  return errorMessage(e);
}
