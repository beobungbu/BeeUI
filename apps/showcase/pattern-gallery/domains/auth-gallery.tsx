import { useToast } from '@beeui/ui';
import * as React from 'react';
import {
  ForgotPasswordScreen,
  InterestsOnboardingScreen,
  PasswordUpdatedScreen,
  ProfileSetupScreen,
  ResetPasswordScreen,
  SignInScreen,
  SignUpScreen,
  VerifyCodeScreen,
  WelcomeScreen,
} from '../../patterns/auth';
import type { PatternDemoProps, PatternDomain } from '../types';

function WelcomeDemo() {
  const toast = useToast();
  return (
    <WelcomeScreen
      onGetStarted={() => toast.show({ title: 'Get started', description: 'Demo navigation stays inside Pattern Gallery.' })}
      onSignIn={() => toast.show({ title: 'Sign in', description: 'Open the Sign In pattern from the gallery list.' })}
    />
  );
}

function SignInDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const [email, setEmail] = React.useState('lan@example.com');
  const [password, setPassword] = React.useState('Password1');

  return (
    <SignInScreen
      email={email}
      emailError={stateId === 'invalid' ? 'Enter a valid email' : undefined}
      error={stateId === 'server-error' ? 'The account could not be authenticated.' : undefined}
      loading={stateId === 'loading'}
      onCreateAccount={() => toast.show({ title: 'Create account' })}
      onEmailChange={setEmail}
      onForgotPassword={() => toast.show({ title: 'Forgot password' })}
      onPasswordChange={setPassword}
      onSubmit={() => toast.show({ title: 'Signed in', variant: 'success' })}
      password={password}
    />
  );
}

function SignUpDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const [acceptedTerms, setAcceptedTerms] = React.useState(true);
  const [confirmPassword, setConfirmPassword] = React.useState('Password1');
  const [email, setEmail] = React.useState('lan@example.com');
  const [name, setName] = React.useState('Lan Tran');
  const [password, setPassword] = React.useState('Password1');

  return (
    <SignUpScreen
      acceptedTerms={acceptedTerms}
      confirmPassword={confirmPassword}
      email={email}
      fieldErrors={stateId === 'invalid' ? {
        confirmPassword: 'Passwords do not match',
        email: 'Enter a valid email',
        name: 'Name is required',
        password: 'Password is too weak',
        terms: 'Accept the terms to continue',
      } : undefined}
      loading={stateId === 'loading'}
      name={name}
      onAcceptedTermsChange={setAcceptedTerms}
      onConfirmPasswordChange={setConfirmPassword}
      onEmailChange={setEmail}
      onNameChange={setName}
      onPasswordChange={setPassword}
      onSignIn={() => toast.show({ title: 'Sign in instead' })}
      onSubmit={() => toast.show({ title: 'Account created', variant: 'success' })}
      password={password}
    />
  );
}

function ForgotPasswordDemo() {
  const toast = useToast();
  const [email, setEmail] = React.useState('lan@example.com');
  return (
    <ForgotPasswordScreen
      email={email}
      onBackToSignIn={() => toast.show({ title: 'Back to sign in' })}
      onEmailChange={setEmail}
      onSubmit={() => toast.show({ title: 'Verification code sent', variant: 'success' })}
    />
  );
}

function VerifyCodeDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const [code, setCode] = React.useState('123456');
  return (
    <VerifyCodeScreen
      canResend
      code={code}
      destination="lan@example.com"
      error={stateId === 'invalid' ? 'Incorrect code' : undefined}
      loading={stateId === 'loading'}
      onChangeDestination={() => toast.show({ title: 'Change destination' })}
      onCodeChange={setCode}
      onResend={() => toast.show({ title: 'Code resent', variant: 'success' })}
      onSubmit={() => toast.show({ title: 'Code verified', variant: 'success' })}
    />
  );
}

function ResetPasswordDemo({ stateId }: PatternDemoProps) {
  const toast = useToast();
  const [confirmPassword, setConfirmPassword] = React.useState('Password1');
  const [password, setPassword] = React.useState('Password1');
  return (
    <ResetPasswordScreen
      confirmPassword={confirmPassword}
      loading={stateId === 'loading'}
      onConfirmPasswordChange={setConfirmPassword}
      onPasswordChange={setPassword}
      onSubmit={() => toast.show({ title: 'Password updated', variant: 'success' })}
      password={password}
    />
  );
}

function PasswordUpdatedDemo() {
  const toast = useToast();
  return <PasswordUpdatedScreen onContinue={() => toast.show({ title: 'Continue to sign in' })} />;
}

function InterestsDemo() {
  const toast = useToast();
  const [selectedValues, setSelectedValues] = React.useState<string[]>(['ai', 'design']);
  return (
    <InterestsOnboardingScreen
      onContinue={() => toast.show({ title: 'Interests saved', variant: 'success' })}
      onSelectionChange={setSelectedValues}
      selectedValues={selectedValues}
    />
  );
}

function ProfileSetupDemo() {
  const toast = useToast();
  const [bio, setBio] = React.useState('Building useful things.');
  const [displayName, setDisplayName] = React.useState('Lan Tran');
  const [username, setUsername] = React.useState('lan');
  return (
    <ProfileSetupScreen
      bio={bio}
      displayName={displayName}
      onBioChange={setBio}
      onChangePhoto={() => toast.show({ title: 'Photo picker simulated' })}
      onDisplayNameChange={setDisplayName}
      onSubmit={() => toast.show({ title: 'Profile completed', variant: 'success' })}
      onUsernameChange={setUsername}
      username={username}
    />
  );
}

export const authPatternDomain: PatternDomain = {
  id: 'auth-onboarding',
  title: 'Authentication & Onboarding',
  description: 'Account entry, recovery, verification, onboarding, and initial profile setup.',
  screens: [
    { id: 'welcome', title: 'Welcome', description: 'Entry point with sign-up and sign-in actions.', source: WelcomeScreen, component: WelcomeDemo },
    {
      id: 'sign-in',
      title: 'Sign In',
      description: 'Controlled credentials with validation, loading, and server feedback.',
      source: SignInScreen,
      component: SignInDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'invalid', title: 'Invalid' },
        { id: 'server-error', title: 'Server error' },
        { id: 'loading', title: 'Loading' },
      ],
    },
    {
      id: 'sign-up',
      title: 'Sign Up',
      description: 'Controlled account creation form and terms acceptance.',
      source: SignUpScreen,
      component: SignUpDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'invalid', title: 'Invalid' },
        { id: 'loading', title: 'Loading' },
      ],
    },
    { id: 'forgot-password', title: 'Forgot Password', description: 'Email-based password recovery entry.', source: ForgotPasswordScreen, component: ForgotPasswordDemo },
    {
      id: 'verify-code',
      title: 'Verify Code / OTP',
      description: 'Controlled one-time-code entry with resend feedback.',
      source: VerifyCodeScreen,
      component: VerifyCodeDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'invalid', title: 'Invalid' },
        { id: 'loading', title: 'Verifying' },
      ],
    },
    {
      id: 'reset-password',
      title: 'Reset Password',
      description: 'Controlled new-password confirmation flow.',
      source: ResetPasswordScreen,
      component: ResetPasswordDemo,
      defaultState: 'default',
      states: [
        { id: 'default', title: 'Default' },
        { id: 'loading', title: 'Updating' },
      ],
    },
    { id: 'password-updated', title: 'Password Updated', description: 'Recovery success confirmation.', source: PasswordUpdatedScreen, component: PasswordUpdatedDemo },
    { id: 'interests-onboarding', title: 'Interests Onboarding', description: 'Multi-select onboarding preference step.', source: InterestsOnboardingScreen, component: InterestsDemo },
    { id: 'profile-setup', title: 'Profile Setup', description: 'Initial display name, username, bio, and photo setup.', source: ProfileSetupScreen, component: ProfileSetupDemo },
  ],
};
