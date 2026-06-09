import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../lib/retention', () => ({
  fetchNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

import { SettingsNotificationsPage } from '../SettingsNotificationsPage';
import { fetchNotificationPreferences, updateNotificationPreferences } from '../../lib/retention';

const PREFS = { score_updates: true, reassessment_reminders: true, product_tips: false };

beforeEach(() => {
  vi.mocked(fetchNotificationPreferences).mockResolvedValue(PREFS as any);
});

describe('SettingsNotificationsPage error handling', () => {
  it('reverts the toggle and shows an error when the save fails', async () => {
    vi.mocked(updateNotificationPreferences).mockResolvedValue(false);
    render(<SettingsNotificationsPage onBack={() => {}} />);

    const firstToggle = (await screen.findAllByRole('switch'))[0] as HTMLInputElement;
    expect(firstToggle.checked).toBe(true);

    fireEvent.click(firstToggle);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(firstToggle.checked).toBe(true); // reverted
  });

  it('keeps the new value and shows no error when the save succeeds', async () => {
    vi.mocked(updateNotificationPreferences).mockResolvedValue(true);
    render(<SettingsNotificationsPage onBack={() => {}} />);

    const firstToggle = (await screen.findAllByRole('switch'))[0] as HTMLInputElement;
    fireEvent.click(firstToggle);

    await waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(firstToggle.checked).toBe(false);
  });
});
