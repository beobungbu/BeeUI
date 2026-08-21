import { cn } from '@beeui/core';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import {
  Image,
  View,
  type ImageProps,
  type ImageSourcePropType,
  type ViewProps,
} from 'react-native';
import { Text } from './text';

const avatarVariants = cva(
  'items-center justify-center overflow-hidden rounded-full bg-muted',
  {
    variants: {
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

const avatarFallbackVariants = cva('font-semibold text-muted-foreground', {
  variants: {
    size: {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type EngineImageProps = ImageProps & {
  className?: string;
};

const EngineImage = Image as unknown as React.ComponentType<EngineImageProps>;

type AvatarImageProps = Omit<ImageProps, 'source'> & {
  className?: string;
};

export type AvatarProps = Omit<ViewProps, 'children'> &
  VariantProps<typeof avatarVariants> & {
    className?: string;
    fallback?: string;
    fallbackClassName?: string;
    imageClassName?: string;
    imageProps?: AvatarImageProps;
    source?: ImageSourcePropType;
  };

export const Avatar = React.forwardRef<React.ComponentRef<typeof View>, AvatarProps>(
  (
    {
      className,
      fallback,
      fallbackClassName,
      imageClassName,
      imageProps,
      size,
      source,
      ...props
    },
    ref,
  ) => {
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
      setFailed(false);
    }, [source]);

    const {
      className: imagePropsClassName,
      onError: imageOnError,
      resizeMode = 'cover',
      ...restImageProps
    } = imageProps ?? {};

    const showImage = source !== undefined && !failed;

    return (
      <View ref={ref} className={cn(avatarVariants({ size }), className)} {...props}>
        {showImage ? (
          <EngineImage
            {...restImageProps}
            accessible={false}
            className={cn('h-full w-full', imageClassName, imagePropsClassName)}
            onError={(event) => {
              setFailed(true);
              imageOnError?.(event);
            }}
            resizeMode={resizeMode}
            source={source}
          />
        ) : fallback ? (
          <Text
            className={cn(avatarFallbackVariants({ size }), fallbackClassName)}
            variant="label"
          >
            {fallback}
          </Text>
        ) : null}
      </View>
    );
  },
);

Avatar.displayName = 'Avatar';

export { avatarFallbackVariants, avatarVariants };
