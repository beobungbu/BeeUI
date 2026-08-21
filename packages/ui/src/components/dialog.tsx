import { cn } from '@beeui/core';
import * as React from 'react';
import {
  Modal,
  Pressable,
  View,
  type ModalProps,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { Button, type ButtonProps } from './button';
import { Text, type TextProps } from './text';

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error('Dialog components must be used inside Dialog.');
  return context;
}

type DialogContentAccessibilityContextValue = {
  defaultDescriptionNativeID: string;
  defaultTitleNativeID: string;
  registerDescription: (nativeID?: string, text?: string) => void;
  registerTitle: (nativeID?: string, text?: string) => void;
};

const DialogContentAccessibilityContext =
  React.createContext<DialogContentAccessibilityContextValue | null>(null);

function getPrimitiveText(children: React.ReactNode) {
  const values = React.Children.toArray(children);
  if (!values.every((value) => typeof value === 'string' || typeof value === 'number')) {
    return undefined;
  }
  return values.map(String).join('');
}

type DialogBaseProps = {
  children?: React.ReactNode;
};

type DialogControlledProps = DialogBaseProps & {
  defaultOpen?: never;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type DialogUncontrolledProps = DialogBaseProps & {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: undefined;
};

export type DialogProps = DialogControlledProps | DialogUncontrolledProps;

export function Dialog(props: DialogProps) {
  const { children, defaultOpen = false, onOpenChange, open } = props;
  const hasOpenProp = open !== undefined;
  const controlled = hasOpenProp && typeof onOpenChange === 'function';
  const [internalOpen, setInternalOpen] = React.useState(open ?? defaultOpen);
  const resolvedOpen = controlled && open !== undefined ? open : internalOpen;

  React.useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && hasOpenProp && !onOpenChange) {
      console.warn(
        'BeeUI Dialog: `open` requires `onOpenChange`. Falling back to dismissable uncontrolled behavior.',
      );
    }
  }, [hasOpenProp, onOpenChange]);

  React.useEffect(() => {
    if (!controlled && hasOpenProp && open !== undefined) {
      setInternalOpen(open);
    }
  }, [controlled, hasOpenProp, open]);

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!controlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlled, onOpenChange],
  );

  const context = React.useMemo(
    () => ({ open: resolvedOpen, setOpen }),
    [resolvedOpen, setOpen],
  );

  return <DialogContext.Provider value={context}>{children}</DialogContext.Provider>;
}

Dialog.displayName = 'Dialog';

export type DialogTriggerProps = ButtonProps;

export const DialogTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  DialogTriggerProps
>(({ accessibilityState, onPress, ...props }, ref) => {
  const { setOpen } = useDialogContext();

  return (
    <Button
      ref={ref}
      {...props}
      accessibilityState={accessibilityState}
      onPress={(event) => {
        onPress?.(event);
        setOpen(true);
      }}
    />
  );
});

DialogTrigger.displayName = 'DialogTrigger';

type DialogModalProps = Omit<
  ModalProps,
  'children' | 'onRequestClose' | 'transparent' | 'visible'
>;

export type DialogContentProps = Omit<
  ViewProps,
  'accessibilityRole' | 'accessibilityViewIsModal' | 'role'
> & {
  closeOnBackdropPress?: boolean;
  containerClassName?: string;
  modalProps?: DialogModalProps;
  onRequestClose?: () => void;
  overlayClassName?: string;
  overlayProps?: Omit<PressableProps, 'children' | 'onPress'>;
  overlayTestID?: string;
};

export const DialogContent = React.forwardRef<React.ComponentRef<typeof View>, DialogContentProps>(
  (
    {
      accessibilityHint,
      accessibilityLabel,
      accessibilityLabelledBy,
      children,
      className,
      closeOnBackdropPress = true,
      containerClassName,
      modalProps,
      onAccessibilityEscape,
      onRequestClose,
      overlayClassName,
      overlayProps,
      overlayTestID,
      ...props
    },
    ref,
  ) => {
    const { open, setOpen } = useDialogContext();
    const reactID = React.useId().replace(/:/g, '');
    const defaultTitleNativeID = `beeui-dialog-title-${reactID}`;
    const defaultDescriptionNativeID = `beeui-dialog-description-${reactID}`;
    const [titleNativeID, setTitleNativeID] = React.useState<string>();
    const [titleText, setTitleText] = React.useState<string>();
    const [descriptionText, setDescriptionText] = React.useState<string>();
    const { animationType = 'fade', presentationStyle = 'overFullScreen', ...restModalProps } =
      modalProps ?? {};

    const requestClose = React.useCallback(() => {
      onRequestClose?.();
      setOpen(false);
    }, [onRequestClose, setOpen]);

    const registerTitle = React.useCallback((nativeID?: string, text?: string) => {
      setTitleNativeID(nativeID);
      setTitleText(text);
    }, []);
    const registerDescription = React.useCallback((_nativeID?: string, text?: string) => {
      setDescriptionText(text);
    }, []);
    const accessibilityContext = React.useMemo(
      () => ({
        defaultDescriptionNativeID,
        defaultTitleNativeID,
        registerDescription,
        registerTitle,
      }),
      [defaultDescriptionNativeID, defaultTitleNativeID, registerDescription, registerTitle],
    );

    return (
      <Modal
        {...restModalProps}
        animationType={animationType}
        onRequestClose={requestClose}
        presentationStyle={presentationStyle}
        transparent
        visible={open}
      >
        <View
          className={cn(
            'flex-1 items-center justify-center px-4 py-8',
            containerClassName,
          )}
        >
          <Pressable
            {...overlayProps}
            accessible={false}
            aria-hidden
            className={cn('absolute inset-0 bg-overlay', overlayClassName)}
            onPress={() => {
              if (closeOnBackdropPress) requestClose();
            }}
            testID={overlayTestID}
          />
          <DialogContentAccessibilityContext.Provider value={accessibilityContext}>
            <View
              ref={ref}
              {...props}
              accessibilityHint={accessibilityHint ?? descriptionText}
              accessibilityLabel={accessibilityLabel ?? titleText}
              accessibilityLabelledBy={accessibilityLabelledBy ?? titleNativeID}
              accessibilityViewIsModal
              aria-modal
              className={cn(
                'w-full max-w-lg gap-4 rounded-xl border border-border bg-surface p-5',
                className,
              )}
              onAccessibilityEscape={() => {
                onAccessibilityEscape?.();
                requestClose();
              }}
              role="dialog"
            >
              {children}
            </View>
          </DialogContentAccessibilityContext.Provider>
        </View>
      </Modal>
    );
  },
);

DialogContent.displayName = 'DialogContent';

export type DialogTitleProps = Omit<TextProps, 'accessibilityRole' | 'role' | 'variant'>;

export const DialogTitle = React.forwardRef<React.ComponentRef<typeof Text>, DialogTitleProps>(
  ({ accessibilityLabel, children, className, nativeID, ...props }, ref) => {
    const context = React.useContext(DialogContentAccessibilityContext);
    const resolvedNativeID = nativeID ?? context?.defaultTitleNativeID;
    const resolvedText = accessibilityLabel ?? getPrimitiveText(children);

    React.useEffect(() => {
      context?.registerTitle(resolvedNativeID, resolvedText);
      return () => context?.registerTitle(undefined, undefined);
    }, [context, resolvedNativeID, resolvedText]);

    return (
      <Text
        ref={ref}
        {...props}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="header"
        className={cn('pr-8', className)}
        nativeID={resolvedNativeID}
        variant="heading"
      >
        {children}
      </Text>
    );
  },
);

DialogTitle.displayName = 'DialogTitle';

export type DialogDescriptionProps = Omit<TextProps, 'tone' | 'variant'>;

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof Text>,
  DialogDescriptionProps
>(({ accessibilityLabel, children, className, nativeID, ...props }, ref) => {
  const context = React.useContext(DialogContentAccessibilityContext);
  const resolvedNativeID = nativeID ?? context?.defaultDescriptionNativeID;
  const resolvedText = accessibilityLabel ?? getPrimitiveText(children);

  React.useEffect(() => {
    context?.registerDescription(resolvedNativeID, resolvedText);
    return () => context?.registerDescription(undefined, undefined);
  }, [context, resolvedNativeID, resolvedText]);

  return (
    <Text
      ref={ref}
      {...props}
      accessibilityLabel={accessibilityLabel}
      className={className}
      nativeID={resolvedNativeID}
      tone="muted"
      variant="body"
    >
      {children}
    </Text>
  );
});

DialogDescription.displayName = 'DialogDescription';

export type DialogFooterProps = ViewProps & {
  className?: string;
};

export const DialogFooter = React.forwardRef<React.ComponentRef<typeof View>, DialogFooterProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn('flex-row flex-wrap items-center justify-end gap-3 pt-1', className)}
      {...props}
    />
  ),
);

DialogFooter.displayName = 'DialogFooter';

export type DialogCloseProps = ButtonProps;

export const DialogClose = React.forwardRef<React.ComponentRef<typeof Pressable>, DialogCloseProps>(
  ({ onPress, ...props }, ref) => {
    const { setOpen } = useDialogContext();

    return (
      <Button
        ref={ref}
        {...props}
        onPress={(event) => {
          onPress?.(event);
          setOpen(false);
        }}
      />
    );
  },
);

DialogClose.displayName = 'DialogClose';
