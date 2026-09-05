import { cn } from '@beemvp/beeui-core';
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
        sm: 'h-avatar-sm w-avatar-sm',
        md: 'h-avatar-md w-avatar-md',
        lg: 'h-avatar-lg w-avatar-lg',
        xl: 'h-avatar-xl w-avatar-xl',
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
      sm: 'text-caption',
      md: 'text-label',
      lg: 'text-body',
      xl: 'text-heading',
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

function getAvatarSourceKey(source?: ImageSourcePropType) {
  if (source === undefined) return 'none';
  if (typeof source === 'number') return `asset:${source}`;

  const sources = Array.isArray(source) ? source : [source];

  return sources
    .map((item) => {
      const headers = item.headers
        ? Object.entries(item.headers)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, value]) => `${key}:${value}`)
            .join(',')
        : '';

      return [
        item.uri ?? '',
        item.method ?? '',
        item.body ?? '',
        item.cache ?? '',
        item.width ?? '',
        item.height ?? '',
        item.scale ?? '',
        headers,
      ].join('|');
    })
    .join('||');
}

export type AvatarProps = Omit<ViewProps, 'children'> &
  VariantProps<typeof avatarVariants> & {
    className?: string;
    /** Text shown when `source` is omitted or the image fails to load (e.g. initials). Renders nothing if also omitted. */
    fallback?: string;
    /** Applied to the fallback `Text` when it is shown; has no effect while the image is showing. */
    fallbackClassName?: string;
    /** Applied to the underlying `Image` when it is shown; has no effect while the fallback is showing. */
    imageClassName?: string;
    /** Forwarded to the underlying `Image`, minus `source` and `className`/`onError`, which this component owns to detect load failures and fall back to `fallback`. */
    imageProps?: AvatarImageProps;
    /** The image to display. If it fails to load, or is omitted, `fallback` is shown instead. */
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
    const sourceKey = getAvatarSourceKey(source);

    React.useEffect(() => {
      setFailed(false);
    }, [sourceKey]);

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
