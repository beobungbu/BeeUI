import type { PasswordRequirement } from '../components/auth-shared';

export const authInterestOptions = [
  { id: 'design', label: 'Product design' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'startups', label: 'Startups' },
  { id: 'ai', label: 'AI & automation' },
  { id: 'writing', label: 'Writing' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'finance', label: 'Personal finance' },
  { id: 'travel', label: 'Travel' },
] as const;

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One number', met: /\d/.test(password) },
  ];
}
