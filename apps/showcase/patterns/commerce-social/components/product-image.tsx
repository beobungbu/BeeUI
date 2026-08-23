import { Box, Text, VStack } from '@beeui/ui';
import * as React from 'react';
import { Image, type StyleProp, type ViewStyle } from 'react-native';

export type ProductImageProps = {
  alt: string;
  aspectRatio?: number;
  className?: string;
  imageUri: string;
  style?: StyleProp<ViewStyle>;
};

export function ProductImage({ alt, aspectRatio = 1, className, imageUri, style }: ProductImageProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => setFailed(false), [imageUri]);

  return (
    <Box
      accessibilityLabel={alt}
      className={`w-full overflow-hidden rounded-2xl bg-muted ${className ?? ''}`}
      style={[{ aspectRatio }, style]}
    >
      {failed ? (
        <VStack align="center" className="h-full justify-center px-4" gap="xs">
          <Text className="text-2xl">✦</Text>
          <Text className="text-center" tone="muted" variant="caption">Image unavailable</Text>
        </VStack>
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          onError={() => setFailed(true)}
          resizeMode="cover"
          source={{ uri: imageUri }}
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </Box>
  );
}
