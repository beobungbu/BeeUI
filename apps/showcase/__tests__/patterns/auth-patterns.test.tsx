import { fireEvent, render } from '@testing-library/react-native';
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

const noop = () => undefined;

describe('authentication and onboarding pattern screens', () => {
  it('renders all nine exported screens without router context', () => {
    const renderings = [
      render(<WelcomeScreen onGetStarted={noop} onSignIn={noop} />),
      render(
        <SignInScreen
          email=""
          onCreateAccount={noop}
          onEmailChange={noop}
          onForgotPassword={noop}
          onPasswordChange={noop}
          onSubmit={noop}
          password=""
        />,
      ),
      render(
        <SignUpScreen
          acceptedTerms={false}
          confirmPassword=""
          email=""
          name=""
          onAcceptedTermsChange={noop}
          onConfirmPasswordChange={noop}
          onEmailChange={noop}
          onNameChange={noop}
          onPasswordChange={noop}
          onSignIn={noop}
          onSubmit={noop}
          password=""
        />,
      ),
      render(
        <ForgotPasswordScreen
          email=""
          onBackToSignIn={noop}
          onEmailChange={noop}
          onSubmit={noop}
        />,
      ),
      render(
        <VerifyCodeScreen
          code=""
          destination="you@example.com"
          onChangeDestination={noop}
          onCodeChange={noop}
          onResend={noop}
          onSubmit={noop}
        />,
      ),
      render(
        <ResetPasswordScreen
          confirmPassword=""
          onConfirmPasswordChange={noop}
          onPasswordChange={noop}
          onSubmit={noop}
          password=""
        />,
      ),
      render(<PasswordUpdatedScreen onContinue={noop} />),
      render(
        <InterestsOnboardingScreen
          onContinue={noop}
          onSelectionChange={noop}
          selectedValues={[]}
        />,
      ),
      render(
        <ProfileSetupScreen
          displayName=""
          onDisplayNameChange={noop}
          onSubmit={noop}
        />,
      ),
    ];

    expect(renderings).toHaveLength(9);
    renderings.forEach((screen) => screen.unmount());
  });

  it('preserves welcome and recovery primary callbacks', () => {
    const onGetStarted = jest.fn();
    const onSignIn = jest.fn();
    const welcome = render(<WelcomeScreen onGetStarted={onGetStarted} onSignIn={onSignIn} />);

    fireEvent.press(welcome.getByRole('button', { name: 'Get started' }));
    fireEvent.press(welcome.getByRole('button', { name: 'I already have an account' }));
    expect(onGetStarted).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
    welcome.unmount();

    const onForgotSubmit = jest.fn();
    const forgot = render(
      <ForgotPasswordScreen
        email="lan@example.com"
        onBackToSignIn={noop}
        onEmailChange={noop}
        onSubmit={onForgotSubmit}
      />,
    );
    fireEvent.press(forgot.getByRole('button', { name: 'Send verification code' }));
    expect(onForgotSubmit).toHaveBeenCalledTimes(1);
    forgot.unmount();

    const onResetSubmit = jest.fn();
    const reset = render(
      <ResetPasswordScreen
        confirmPassword="Password1"
        onConfirmPasswordChange={noop}
        onPasswordChange={noop}
        onSubmit={onResetSubmit}
        password="Password1"
      />,
    );
    fireEvent.press(reset.getByRole('button', { name: 'Update password' }));
    expect(onResetSubmit).toHaveBeenCalledTimes(1);
    reset.unmount();

    const onContinue = jest.fn();
    const success = render(<PasswordUpdatedScreen onContinue={onContinue} />);
    fireEvent.press(success.getByRole('button', { name: 'Continue to sign in' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('preserves sign-in controlled values, validation, server error, loading, and callbacks', () => {
    const onEmailChange = jest.fn();
    const onPasswordChange = jest.fn();
    const onSubmit = jest.fn();
    const onForgotPassword = jest.fn();
    const onCreateAccount = jest.fn();

    const props = {
      email: 'lan@example.com',
      onCreateAccount,
      onEmailChange,
      onForgotPassword,
      onPasswordChange,
      onSubmit,
      password: 'secret',
    };
    const screen = render(
      <SignInScreen
        {...props}
        emailError="Enter a valid email"
        error="The account could not be authenticated."
      />,
    );

    expect(screen.getByDisplayValue('lan@example.com')).toBeTruthy();
    expect(screen.getByText('Enter a valid email')).toBeTruthy();
    expect(screen.getByText('The account could not be authenticated.')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'next@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Enter your password'), 'new-secret');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.press(screen.getByRole('link', { name: 'Forgot password?' }));
    fireEvent.press(screen.getByRole('link', { name: 'Create an account' }));

    expect(onEmailChange).toHaveBeenCalledWith('next@example.com');
    expect(onPasswordChange).toHaveBeenCalledWith('new-secret');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onForgotPassword).toHaveBeenCalledTimes(1);
    expect(onCreateAccount).toHaveBeenCalledTimes(1);

    screen.rerender(<SignInScreen {...props} loading />);
    const submit = screen.getByRole('button', { name: 'Sign in' });
    expect(submit.props.accessibilityState.disabled).toBe(true);
    expect(submit.props.accessibilityState.busy).toBe(true);
  });

  it('preserves sign-up callbacks and represents invalid/loading states', () => {
    const onNameChange = jest.fn();
    const onAcceptedTermsChange = jest.fn();
    const onSubmit = jest.fn();
    const props = {
      acceptedTerms: true,
      confirmPassword: 'Password1',
      email: 'lan@example.com',
      name: 'Lan',
      onAcceptedTermsChange,
      onConfirmPasswordChange: noop,
      onEmailChange: noop,
      onNameChange,
      onPasswordChange: noop,
      onSignIn: noop,
      onSubmit,
      password: 'Password1',
    };
    const screen = render(<SignUpScreen {...props} />);

    fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Lan Tran');
    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'I agree to the Terms of Service and Privacy Policy',
      }),
    );
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(onNameChange).toHaveBeenCalledWith('Lan Tran');
    expect(onAcceptedTermsChange).toHaveBeenCalledWith(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    screen.rerender(
      <SignUpScreen
        {...props}
        acceptedTerms={false}
        fieldErrors={{
          confirmPassword: 'Passwords do not match',
          email: 'Enter a valid email',
          name: 'Name is required',
          password: 'Password is too weak',
          terms: 'Accept the terms to continue',
        }}
      />,
    );
    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(screen.getByText('Passwords do not match')).toBeTruthy();
    expect(screen.getByText('Accept the terms to continue')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Create account' }).props.accessibilityState.disabled,
    ).toBe(true);

    screen.rerender(<SignUpScreen {...props} loading />);
    const submit = screen.getByRole('button', { name: 'Create account' });
    expect(submit.props.accessibilityState.disabled).toBe(true);
    expect(submit.props.accessibilityState.busy).toBe(true);
  });

  it('wires OTP callbacks and represents incomplete, error, and verifying states', () => {
    const onCodeChange = jest.fn();
    const onComplete = jest.fn();
    const onResend = jest.fn();
    const props = {
      destination: 'lan@example.com',
      onChangeDestination: noop,
      onCodeChange,
      onComplete,
      onResend,
      onSubmit: noop,
    };
    const screen = render(
      <VerifyCodeScreen
        {...props}
        canResend
        code="123"
        countdownText="Resend available now"
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Verify code' }).props.accessibilityState.disabled,
    ).toBe(true);
    fireEvent.changeText(screen.getByDisplayValue('123'), '123456');
    fireEvent.press(screen.getByRole('link', { name: 'Resend code' }));
    expect(onCodeChange).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Resend available now')).toBeTruthy();

    screen.rerender(<VerifyCodeScreen {...props} code="123456" error="Incorrect code" />);
    expect(screen.getAllByText('Incorrect code').length).toBeGreaterThan(0);

    screen.rerender(<VerifyCodeScreen {...props} code="123456" loading />);
    const submit = screen.getByRole('button', { name: 'Verify code' });
    expect(submit.props.accessibilityState.disabled).toBe(true);
    expect(submit.props.accessibilityState.busy).toBe(true);
  });

  it('keeps onboarding selection controlled for empty and selected states', () => {
    const onSelectionChange = jest.fn();
    const screen = render(
      <InterestsOnboardingScreen
        onContinue={noop}
        onSelectionChange={onSelectionChange}
        selectedValues={[]}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled,
    ).toBe(true);
    fireEvent.press(screen.getByRole('checkbox', { name: 'AI & automation' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['ai']);

    screen.rerender(
      <InterestsOnboardingScreen
        onContinue={noop}
        onSelectionChange={onSelectionChange}
        selectedValues={['ai', 'design']}
      />,
    );
    expect(screen.getByText('2 selected')).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'AI & automation' }).props.accessibilityState.checked,
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Continue' }).props.accessibilityState.disabled,
    ).toBe(false);
  });

  it('preserves profile values and callbacks for empty and populated states', () => {
    const onDisplayNameChange = jest.fn();
    const onChangePhoto = jest.fn();
    const screen = render(
      <ProfileSetupScreen displayName="" onDisplayNameChange={onDisplayNameChange} onSubmit={noop} />,
    );

    expect(
      screen.getByRole('button', { name: 'Finish profile' }).props.accessibilityState.disabled,
    ).toBe(true);

    screen.rerender(
      <ProfileSetupScreen
        bio="Building useful things."
        displayName="Lan Tran"
        onBioChange={noop}
        onChangePhoto={onChangePhoto}
        onDisplayNameChange={onDisplayNameChange}
        onSubmit={noop}
        onUsernameChange={noop}
        username="lan"
      />,
    );
    expect(screen.getByDisplayValue('Lan Tran')).toBeTruthy();
    expect(screen.getByDisplayValue('lan')).toBeTruthy();
    expect(screen.getByDisplayValue('Building useful things.')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('How should we call you?'), 'Lan T.');
    fireEvent.press(screen.getByRole('button', { name: 'Change photo' }));
    expect(onDisplayNameChange).toHaveBeenCalledWith('Lan T.');
    expect(onChangePhoto).toHaveBeenCalledTimes(1);
  });

  it('typechecks the auth pattern pack with its dedicated TypeScript config', () => {
    const { execFileSync } = require('child_process') as typeof import('child_process');
    const path = require('path') as typeof import('path');

    execFileSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['exec', 'tsc', '-p', 'patterns/auth/tsconfig.json', '--noEmit'],
      {
        cwd: path.resolve(__dirname, '../..'),
        env: process.env,
        stdio: 'inherit',
      },
    );
  });

  it('keeps BeeUI imports public inside the pattern pack', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.resolve(__dirname, '../../patterns/auth');

    const readRecursively = (directory: string): string[] =>
      fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const next = path.join(directory, entry.name);
        return entry.isDirectory() ? readRecursively(next) : [next];
      });

    const source = readRecursively(root)
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/packages\/ui\/src\//);
    expect(source).not.toMatch(/packages\/core\/src\//);
    expect(source).not.toMatch(/overlay-runtime/);
  });
});
