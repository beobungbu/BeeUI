import { SettingsItem, Switch } from '@beeui/ui';
import * as React from 'react';

export type PreferenceRowProps = {
  description?: string;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
};

export function PreferenceRow({
  description,
  disabled = false,
  onValueChange,
  title,
  value,
}: PreferenceRowProps) {
  return (
    <SettingsItem
      description={description}
      title={title}
      trailing={
        <Switch
          accessibilityLabel={title}
          disabled={disabled}
          onValueChange={onValueChange}
          value={value}
        />
      }
    />
  );
}
