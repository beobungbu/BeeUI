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

export type DialogProps = {
  children?: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

export function Dialog({ children, defaultOpen = false, onOpenChange, open }: DialogProps) {
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const resolvedOpen = controlled ? open : internalOpen;

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
  const { open, setOpen } = useDialogContext();

  return (
    <Button
      ref={ref}
      {...props}
      accessibilityState={{ ...accessibilityState, expanded: open }}
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
    const { animationType = 'fade', presentationStyle = 'overFullScreen', ...restModalProps } =
      modalProps ?? {};

    const requestClose = React.useCallback(() => {
      onRequestClose?.();
      setOpen(false);
    }, [onRequestClose, setOpen]);

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
          <View
            ref={ref}
            {...props}
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
        </View>
      </Modal>
    );
  },
);

DialogContent.displayName = 'DialogContent';

export type DialogTitleProps = Omit<TextProps, 'accessibilityRole' | 'role' | 'variant'>;

export const DialogTitle = React.forwardRef<React.ComponentRef<typeof Text>, DialogTitleProps>(
  ({ className, ...props }, ref) => (
    <Text ref={ref} accessibilityRole="header" className={cn('pr-8', className)} variant="heading" {...props} />
  ),
);

DialogTitle.displayName = 'DialogTitle';

export type DialogDescriptionProps = Omit<TextProps, 'tone' | 'variant'>;

export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof Text>,
  DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <Text ref={ref} className={className} tone="muted" variant="body" {...props} />
));

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
