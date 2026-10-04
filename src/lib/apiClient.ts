/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * API base URL helper. Supports static hosting (GitHub Pages, etc.)
 * with a separately deployed Baseera backend.
 */

const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

export const API_BASE_URL = configuredBase;

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
