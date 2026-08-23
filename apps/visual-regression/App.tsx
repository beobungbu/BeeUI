import './global.css';

import { BeeUIProvider } from '@beeui/ui';
import * as React from 'react';
import { Uniwind } from 'uniwind';
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
} from '../showcase/patterns/auth';

const noop = () => undefined;
const noopValue = (_value: string) => undefined;
const noopBool = (_value: boolean) => undefined;
const noopValues = (_value: string[]) => undefined;

const longError =
  'We could not complete this request because the account service returned an unexpected response. Check your connection and try again. If the problem continues, contact support and include the time this happened.';

const longTermsCopy =
  'Please review and accept the Terms of Service and Privacy Policy before creating an account. This acknowledgement is required so we can continue safely and explain how your account data is handled.';

const longInterestOptions = [
  { id: 'design-systems', label: 'Design systems and cross-platform component architecture' },
  { id: 'mobile-performance', label: 'Mobile performance, accessibility, and interaction design' },
  { id: 'product-strategy', label: 'Product strategy for developer tools and technical platforms' },
  { id: 'ai-workflows', label: 'Applied AI workflows, automation, and developer productivity' },
] as const;

const longBio =
  'I build thoughtful product experiences across mobile and web, with a focus on accessibility, design systems, developer tooling, and reliable delivery for teams that care about small details.';

function readQuery() {
  if (typeof window === 'undefined') {
    return { scenario: 'welcome-default', theme: 'light' as const };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    scenario: params.get('authScenario') ?? 'welcome-default',
    theme: params.get('theme') === 'dark' ? ('dark' as const) : ('light' as const),
  };
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function useVisualReadiness(scenario: string, theme: 'light' | 'dark') {
  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    let cancelled = false;
    document.documentElement.removeAttribute('data-visual-ready');
    document.documentElement.dataset.visualScenario = scenario;
    document.documentElement.dataset.visualTheme = theme;
    Uniwind.setTheme(theme);

    async function settle() {
      if ('fonts' in document) await document.fonts.ready;
      await nextFrame();
      await nextFrame();
      await nextFrame();
      if (!cancelled) document.documentElement.dataset.visualReady = 'true';
    }

    void settle();
    return () => {
      cancelled = true;
    };
  }, [scenario, theme]);
}

function AuthScenario({ id }: { id: string }) {
  switch (id) {
    case 'welcome-default':
      return <WelcomeScreen onGetStarted={noop} onSignIn={noop} />;

    case 'sign-in-default':
      return (
        <SignInScreen
          email=""
          onAppleSignIn={noop}
          onCreateAccount={noop}
          onEmailChange={noopValue}
          onForgotPassword={noop}
          onGoogleSignIn={noop}
          onPasswordChange={noopValue}
          onSubmit={noop}
          password=""
        />
      );
    case 'sign-in-invalid':
      return (
        <SignInScreen
          email="not-an-email"
          emailError="Enter a valid email address."
          onCreateAccount={noop}
          onEmailChange={noopValue}
          onForgotPassword={noop}
          onPasswordChange={noopValue}
          onSubmit={noop}
          password="short"
          passwordError="Password must be at least 8 characters."
        />
      );
    case 'sign-in-loading':
      return (
        <SignInScreen
          email="hello@beeui.dev"
          loading
          onCreateAccount={noop}
          onEmailChange={noopValue}
          onForgotPassword={noop}
          onPasswordChange={noopValue}
          onSubmit={noop}
          password="BeeUI123"
        />
      );
    case 'sign-in-server-error':
      return (
        <SignInScreen
          email="hello@beeui.dev"
          error="The account could not be authenticated."
          onCreateAccount={noop}
          onEmailChange={noopValue}
          onForgotPassword={noop}
          onPasswordChange={noopValue}
          onSubmit={noop}
          password="BeeUI123"
        />
      );
    case 'sign-in-long-error':
      return (
        <SignInScreen
          email="hello@beeui.dev"
          error={longError}
          onCreateAccount={noop}
          onEmailChange={noopValue}
          onForgotPassword={noop}
          onPasswordChange={noopValue}
          onSubmit={noop}
          password="BeeUI123"
        />
      );

    case 'sign-up-default':
      return (
        <SignUpScreen
          acceptedTerms={false}
          confirmPassword=""
          email=""
          name=""
          onAcceptedTermsChange={noopBool}
          onAppleSignIn={noop}
          onConfirmPasswordChange={noopValue}
          onEmailChange={noopValue}
          onGoogleSignIn={noop}
          onNameChange={noopValue}
          onPasswordChange={noopValue}
          onSignIn={noop}
          onSubmit={noop}
          password=""
        />
      );
    case 'sign-up-validation':
      return (
        <SignUpScreen
          acceptedTerms={false}
          confirmPassword="different"
          email="bad-email"
          fieldErrors={{
            confirmPassword: 'Passwords do not match.',
            email: 'Enter a valid email address.',
            name: 'Enter your name.',
            password: 'Choose a stronger password.',
            terms: 'Accept the terms before continuing.',
          }}
          name=""
          onAcceptedTermsChange={noopBool}
          onConfirmPasswordChange={noopValue}
          onEmailChange={noopValue}
          onNameChange={noopValue}
          onPasswordChange={noopValue}
          onSignIn={noop}
          onSubmit={noop}
          password="weak"
        />
      );
    case 'sign-up-loading':
      return (
        <SignUpScreen
          acceptedTerms
          confirmPassword="BeeUI123"
          email="hello@beeui.dev"
          loading
          name="BeeUI Builder"
          onAcceptedTermsChange={noopBool}
          onConfirmPasswordChange={noopValue}
          onEmailChange={noopValue}
          onNameChange={noopValue}
          onPasswordChange={noopValue}
          onSignIn={noop}
          onSubmit={noop}
          password="BeeUI123"
        />
      );
    case 'sign-up-long-copy':
      return (
        <SignUpScreen
          acceptedTerms={false}
          confirmPassword="BeeUI123"
          email="hello@beeui.dev"
          fieldErrors={{ terms: longTermsCopy }}
          name="BeeUI Builder"
          onAcceptedTermsChange={noopBool}
          onConfirmPasswordChange={noopValue}
          onEmailChange={noopValue}
          onNameChange={noopValue}
          onPasswordChange={noopValue}
          onSignIn={noop}
          onSubmit={noop}
          password="BeeUI123"
        />
      );

    case 'forgot-default':
      return (
        <ForgotPasswordScreen
          email=""
          onBackToSignIn={noop}
          onEmailChange={noopValue}
          onSubmit={noop}
        />
      );
    case 'forgot-error':
      return (
        <ForgotPasswordScreen
          email="missing@beeui.dev"
          emailError="Enter the email used for your BeeUI account."
          error="We could not find an account for that email."
          onBackToSignIn={noop}
          onEmailChange={noopValue}
          onSubmit={noop}
        />
      );
    case 'forgot-submitting':
      return (
        <ForgotPasswordScreen
          email="hello@beeui.dev"
          loading
          onBackToSignIn={noop}
          onEmailChange={noopValue}
          onSubmit={noop}
        />
      );

    case 'verify-empty':
      return (
        <VerifyCodeScreen
          canResend={false}
          code=""
          countdownText="Resend in 0:42"
          destination="hello@beeui.dev"
          onChangeDestination={noop}
          onCodeChange={noopValue}
          onComplete={noopValue}
          onResend={noop}
          onSubmit={noop}
        />
      );
    case 'verify-incomplete':
      return (
        <VerifyCodeScreen
          canResend={false}
          code="123"
          countdownText="Resend in 0:18"
          destination="hello@beeui.dev"
          onChangeDestination={noop}
          onCodeChange={noopValue}
          onComplete={noopValue}
          onResend={noop}
          onSubmit={noop}
        />
      );
    case 'verify-complete':
      return (
        <VerifyCodeScreen
          canResend
          code="123456"
          countdownText="Resend available now"
          destination="hello@beeui.dev"
          onChangeDestination={noop}
          onCodeChange={noopValue}
          onComplete={noopValue}
          onResend={noop}
          onSubmit={noop}
        />
      );
    case 'verify-error':
      return (
        <VerifyCodeScreen
          canResend
          code="123456"
          error="That code has expired. Request a new code and try again."
          destination="hello@beeui.dev"
          onChangeDestination={noop}
          onCodeChange={noopValue}
          onComplete={noopValue}
          onResend={noop}
          onSubmit={noop}
        />
      );
    case 'verify-verifying':
      return (
        <VerifyCodeScreen
          canResend={false}
          code="123456"
          destination="hello@beeui.dev"
          loading
          onChangeDestination={noop}
          onCodeChange={noopValue}
          onComplete={noopValue}
          onResend={noop}
          onSubmit={noop}
        />
      );

    case 'reset-default':
      return (
        <ResetPasswordScreen
          confirmPassword=""
          onConfirmPasswordChange={noopValue}
          onPasswordChange={noopValue}
          onSubmit={noop}
          password=""
        />
      );
    case 'reset-validation':
      return (
        <ResetPasswordScreen
          confirmPassword="BeeUI124"
          confirmPasswordError="Passwords do not match."
          onConfirmPasswordChange={noopValue}
          onPasswordChange={noopValue}
          onSubmit={noop}
          password="weak"
          passwordError="Use at least 8 characters with an uppercase letter and a number."
        />
      );
    case 'reset-loading':
      return (
        <ResetPasswordScreen
          confirmPassword="BeeUI123"
          loading
          onConfirmPasswordChange={noopValue}
          onPasswordChange={noopValue}
          onSubmit={noop}
          password="BeeUI123"
        />
      );

    case 'password-updated-success':
      return <PasswordUpdatedScreen onContinue={noop} />;

    case 'interests-none':
      return (
        <InterestsOnboardingScreen
          onContinue={noop}
          onSelectionChange={noopValues}
          onSkip={noop}
          selectedValues={[]}
        />
      );
    case 'interests-one':
      return (
        <InterestsOnboardingScreen
          onContinue={noop}
          onSelectionChange={noopValues}
          onSkip={noop}
          selectedValues={['design']}
        />
      );
    case 'interests-many':
      return (
        <InterestsOnboardingScreen
          onContinue={noop}
          onSelectionChange={noopValues}
          onSkip={noop}
          selectedValues={['design', 'engineering', 'startups', 'ai', 'writing', 'travel']}
        />
      );
    case 'interests-long-labels':
      return (
        <InterestsOnboardingScreen
          onContinue={noop}
          onSelectionChange={noopValues}
          onSkip={noop}
          options={longInterestOptions}
          selectedValues={['design-systems', 'ai-workflows']}
        />
      );

    case 'profile-empty':
      return (
        <ProfileSetupScreen
          displayName=""
          onBack={noop}
          onBioChange={noopValue}
          onChangePhoto={noop}
          onDisplayNameChange={noopValue}
          onSkip={noop}
          onSubmit={noop}
          onUsernameChange={noopValue}
        />
      );
    case 'profile-populated':
      return (
        <ProfileSetupScreen
          bio="Building useful things with BeeUI."
          displayName="BeeUI Builder"
          onBack={noop}
          onBioChange={noopValue}
          onChangePhoto={noop}
          onDisplayNameChange={noopValue}
          onSkip={noop}
          onSubmit={noop}
          onUsernameChange={noopValue}
          username="beeui-builder"
        />
      );
    case 'profile-long-name':
      return (
        <ProfileSetupScreen
          bio="Building useful things with BeeUI."
          displayName="Alexandra Catherine Montgomery-Wellington"
          onBack={noop}
          onBioChange={noopValue}
          onChangePhoto={noop}
          onDisplayNameChange={noopValue}
          onSkip={noop}
          onSubmit={noop}
          onUsernameChange={noopValue}
          username="alexandra-montgomery-wellington"
        />
      );
    case 'profile-long-bio':
      return (
        <ProfileSetupScreen
          bio={longBio}
          displayName="BeeUI Builder"
          onBack={noop}
          onBioChange={noopValue}
          onChangePhoto={noop}
          onDisplayNameChange={noopValue}
          onSkip={noop}
          onSubmit={noop}
          onUsernameChange={noopValue}
          username="beeui-builder"
        />
      );
    case 'profile-validation':
      return (
        <ProfileSetupScreen
          bio={longBio}
          displayName=""
          fieldErrors={{
            bio: 'Keep the bio concise and remove unsupported characters.',
            displayName: 'Enter a display name.',
            username: 'This username is already in use.',
          }}
          onBack={noop}
          onBioChange={noopValue}
          onChangePhoto={noop}
          onDisplayNameChange={noopValue}
          onSkip={noop}
          onSubmit={noop}
          onUsernameChange={noopValue}
          username="beeui"
        />
      );
    case 'profile-saving':
      return (
        <ProfileSetupScreen
          bio="Building useful things with BeeUI."
          displayName="BeeUI Builder"
          loading
          onBack={noop}
          onBioChange={noopValue}
          onChangePhoto={noop}
          onDisplayNameChange={noopValue}
          onSkip={noop}
          onSubmit={noop}
          onUsernameChange={noopValue}
          username="beeui-builder"
        />
      );

    default:
      return <WelcomeScreen onGetStarted={noop} onSignIn={noop} />;
  }
}

export default function App() {
  const [{ scenario, theme }] = React.useState(readQuery);
  useVisualReadiness(scenario, theme);

  return (
    <BeeUIProvider>
      <AuthScenario id={scenario} />
    </BeeUIProvider>
  );
}
