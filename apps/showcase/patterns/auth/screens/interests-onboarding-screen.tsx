import { Button, Card, Chip, ChipGroup, HStack, Link, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { AuthShell, OnboardingProgress } from '../components/auth-shared';
import { authInterestOptions } from '../fixtures/auth-fixtures';

export type InterestOption = {
  id: string;
  label: string;
};

export type InterestsOnboardingScreenProps = {
  currentStep?: number;
  disabled?: boolean;
  loading?: boolean;
  onContinue: () => void;
  onSelectionChange: (value: string[]) => void;
  onSkip?: () => void;
  options?: readonly InterestOption[];
  selectedValues: string[];
  totalSteps?: number;
};

export function InterestsOnboardingScreen({
  currentStep = 1,
  disabled = false,
  loading = false,
  onContinue,
  onSelectionChange,
  onSkip,
  options = authInterestOptions,
  selectedValues,
  totalSteps = 2,
}: InterestsOnboardingScreenProps) {
  const blocked = disabled || loading;
  const nothingSelected = selectedValues.length === 0;

  return (
    <AuthShell testID="interests-onboarding-screen">
      <OnboardingProgress current={currentStep} label="Personalize your experience" total={totalSteps} />

      <VStack gap="sm">
        <Text className="text-3xl leading-10" variant="title">
          What are you into?
        </Text>
        <Text tone="muted" variant="body">
          Pick a few topics so the experience can start closer to what matters to you.
        </Text>
      </VStack>

      <Card padding="lg" variant="raised">
        <VStack gap="lg">
          <ChipGroup
            disabled={blocked}
            onValueChange={(value) => onSelectionChange(Array.isArray(value) ? value : value ? [value] : [])}
            selectionMode="multiple"
            value={selectedValues}
          >
            {options.map((option) => (
              <Chip key={option.id} value={option.id}>
                {option.label}
              </Chip>
            ))}
          </ChipGroup>

          <Text tone="muted" variant="caption">
            {nothingSelected
              ? 'Choose at least one interest to continue.'
              : `${selectedValues.length} selected`}
          </Text>

          <Button
            disabled={disabled || nothingSelected}
            loading={loading}
            onPress={onContinue}
            size="lg"
          >
            Continue
          </Button>
        </VStack>
      </Card>

      {onSkip ? (
        <HStack justify="center">
          <Link disabled={blocked} onPress={onSkip}>
            Skip for now
          </Link>
        </HStack>
      ) : null}
    </AuthShell>
  );
}
