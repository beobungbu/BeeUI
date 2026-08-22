import * as React from 'react';
import { Pressable, View } from 'react-native';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  type DialogCloseProps,
  type DialogContentProps,
  type DialogDescriptionProps,
  type DialogFooterProps,
  type DialogProps,
  type DialogTitleProps,
  type DialogTriggerProps,
} from './dialog';

export type AlertDialogProps = DialogProps;

export function AlertDialog(props: AlertDialogProps) {
  return <Dialog {...props} />;
}

AlertDialog.displayName = 'AlertDialog';

export type AlertDialogTriggerProps = DialogTriggerProps;

export const AlertDialogTrigger = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  AlertDialogTriggerProps
>((props, ref) => <DialogTrigger ref={ref} {...props} />);

AlertDialogTrigger.displayName = 'AlertDialogTrigger';

export type AlertDialogContentProps = Omit<
  DialogContentProps,
  'closeOnBackdropPress' | 'dismissOnRequestClose'
> & {
  /**
   * Whether native request-close paths (Android hardware back and accessibility escape)
   * should behave like cancellation. Backdrop presses never dismiss an AlertDialog.
   */
  cancelOnRequestClose?: boolean;
};

export const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof View>,
  AlertDialogContentProps
>(({ cancelOnRequestClose = true, ...props }, ref) => (
  <DialogContent
    ref={ref}
    {...props}
    closeOnBackdropPress={false}
    dismissOnRequestClose={cancelOnRequestClose}
  />
));

AlertDialogContent.displayName = 'AlertDialogContent';

export type AlertDialogTitleProps = DialogTitleProps;

export const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogTitle>,
  AlertDialogTitleProps
>((props, ref) => <DialogTitle ref={ref} {...props} />);

AlertDialogTitle.displayName = 'AlertDialogTitle';

export type AlertDialogDescriptionProps = DialogDescriptionProps;

export const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogDescription>,
  AlertDialogDescriptionProps
>((props, ref) => <DialogDescription ref={ref} {...props} />);

AlertDialogDescription.displayName = 'AlertDialogDescription';

export type AlertDialogFooterProps = DialogFooterProps;

export const AlertDialogFooter = React.forwardRef<
  React.ComponentRef<typeof View>,
  AlertDialogFooterProps
>((props, ref) => <DialogFooter ref={ref} {...props} />);

AlertDialogFooter.displayName = 'AlertDialogFooter';

export type AlertDialogCancelProps = DialogCloseProps;

export const AlertDialogCancel = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  AlertDialogCancelProps
>(({ variant, ...props }, ref) => (
  <DialogClose ref={ref} {...props} variant={variant ?? 'outline'} />
));

AlertDialogCancel.displayName = 'AlertDialogCancel';

export type AlertDialogActionProps = DialogCloseProps;

export const AlertDialogAction = React.forwardRef<
  React.ComponentRef<typeof Pressable>,
  AlertDialogActionProps
>(({ variant, ...props }, ref) => (
  <DialogClose ref={ref} {...props} variant={variant ?? 'destructive'} />
));

AlertDialogAction.displayName = 'AlertDialogAction';
