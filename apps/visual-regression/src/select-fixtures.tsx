import {
  Box,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@beemvp/beeui-ui';
import * as React from 'react';

const longOptions = Array.from({ length: 20 }, (_, index) => `Option ${index + 1}`);
const shortOptions = longOptions.slice(0, 5);

function PlainSelect({ id, options }: { id: string; options: readonly string[] }) {
  const [value, setValue] = React.useState<string | undefined>(undefined);
  return (
    <Box className="gap-2">
      <Select onValueChange={setValue} value={value}>
        <SelectTrigger accessibilityLabel={`${id} select`} testID={`${id}-trigger`}>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent testID={`${id}-content`}>
          {options.map((option) => (
            <SelectItem key={option} testID={`${id}-${option.replace(/\s+/g, '-').toLowerCase()}`} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Text testID={`${id}-value`}>{value ?? 'none'}</Text>
    </Box>
  );
}

/**
 * A bare route with no app shell, scroll container, or showcase chrome: the Select sits
 * directly in the document, as a consumer's minimal probe page renders it. The long list
 * (20 options of 40 pt under the default 320 pt cap) overflows; the short list does not.
 */
export function SelectMinimalRouteFixture() {
  return (
    <Box className="gap-6 p-6" testID="select-minimal-route-fixture">
      <PlainSelect id="select-long" options={longOptions} />
      <PlainSelect id="select-short" options={shortOptions} />
      <BareValueSelect id="select-bare-default" />
      <BareValueSelect id="select-bare-vi" locale="vi-VN" />
    </Box>
  );
}

// A trigger with a bare `<SelectValue />` (no placeholder) shows the built-in copy.
function BareValueSelect({ id, locale }: { id: string; locale?: string }) {
  return (
    <Select locale={locale}>
      <SelectTrigger testID={`${id}-trigger`}>
        <SelectValue testID={`${id}-value`} />
      </SelectTrigger>
      <SelectContent>
        {shortOptions.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldSelect({
  description,
  error,
  id,
  invalid,
  label,
  required,
}: {
  description?: string;
  error?: string;
  id: string;
  invalid?: boolean;
  label: string;
  required?: boolean;
}) {
  const [value, setValue] = React.useState<string | undefined>(undefined);
  return (
    <Field
      description={description}
      error={error}
      invalid={invalid}
      label={label}
      labelNativeID={`${id}-label`}
      required={required}
    >
      <Select onValueChange={setValue} value={value}>
        <SelectTrigger testID={`${id}-trigger`}>
          <SelectValue placeholder="Chọn cửa hàng" />
        </SelectTrigger>
        <SelectContent>
          {shortOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/**
 * A Select inside a Field next to an Input in the same Field layout, so the Select's
 * label/description/required/invalid wiring can be compared against the Input's.
 */
export function SelectFieldFixture() {
  return (
    <Box className="gap-6 p-6" testID="select-field-fixture">
      <Field
        description="Tên hiển thị trên hóa đơn"
        label="Tên sản phẩm"
        labelNativeID="field-input-label"
        required
      >
        <Input testID="field-input" />
      </Field>
      <Field error="Nhập mã vạch" invalid label="Mã vạch" labelNativeID="field-input-invalid-label">
        <Input testID="field-input-invalid" />
      </Field>
      <FieldSelect
        description="Cửa hàng giao hàng cho đơn này"
        id="field-select"
        label="Cửa hàng nhận"
        required
      />
      <FieldSelect
        error="Chọn một cửa hàng"
        id="field-select-invalid"
        invalid
        label="Kho xuất"
      />
      <FieldSelect id="field-select-plain" label="Kho nhập" />
    </Box>
  );
}
