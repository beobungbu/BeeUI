import { ListGroup, Separator } from '@beeui/ui';
import * as React from 'react';
import { PreferenceRow } from '../components/preference-row';
import { SettingsScreenShell } from '../components/settings-screen-shell';
import { SettingsSection } from '../components/settings-section';

export type NotificationSettingsScreenProps = {
  activity: boolean;
  email: boolean;
  enabled: boolean;
  marketing: boolean;
  onActivityChange: (value: boolean) => void;
  onEmailChange: (value: boolean) => void;
  onEnabledChange: (value: boolean) => void;
  onMarketingChange: (value: boolean) => void;
  onPushChange: (value: boolean) => void;
  onRemindersChange: (value: boolean) => void;
  push: boolean;
  reminders: boolean;
};

export function NotificationSettingsScreen({
  activity,
  email,
  enabled,
  marketing,
  onActivityChange,
  onEmailChange,
  onEnabledChange,
  onMarketingChange,
  onPushChange,
  onRemindersChange,
  push,
  reminders,
}: NotificationSettingsScreenProps) {
  return (
    <SettingsScreenShell
      description="Choose delivery channels and activity types without taking ownership of OS notification permissions."
      eyebrow="Preferences"
      testID="notification-settings-screen"
      title="Notifications"
    >
      <SettingsSection title="Master preference">
        <ListGroup>
          <PreferenceRow
            description="When off, channel preferences stay visible but cannot be changed."
            onValueChange={onEnabledChange}
            title="Enable notifications"
            value={enabled}
          />
        </ListGroup>
      </SettingsSection>

      <SettingsSection title="Delivery channels">
        <ListGroup>
          <PreferenceRow
            disabled={!enabled}
            onValueChange={onPushChange}
            title="Push notifications"
            value={push}
          />
          <Separator />
          <PreferenceRow
            disabled={!enabled}
            onValueChange={onEmailChange}
            title="Email notifications"
            value={email}
          />
        </ListGroup>
      </SettingsSection>

      <SettingsSection title="Activity">
        <ListGroup>
          <PreferenceRow
            description="Replies, mentions, shared items, and important account activity."
            disabled={!enabled}
            onValueChange={onActivityChange}
            title="Activity & mentions"
            value={activity}
          />
          <Separator />
          <PreferenceRow
            description="Useful reminders for unfinished or time-sensitive actions."
            disabled={!enabled}
            onValueChange={onRemindersChange}
            title="Reminders"
            value={reminders}
          />
          <Separator />
          <PreferenceRow
            description="Occasional product announcements and feature updates."
            disabled={!enabled}
            onValueChange={onMarketingChange}
            title="Product updates"
            value={marketing}
          />
        </ListGroup>
      </SettingsSection>
    </SettingsScreenShell>
  );
}
