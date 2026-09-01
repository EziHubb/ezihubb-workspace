import type { ArgumentMetadata } from '@nestjs/common';
import { ScopedValidationPipe } from '../../../common/pipes/scoped-validation.pipe';
import { CreateProductDetailDto } from './create-product-detail.dto';

const BODY_METADATA: ArgumentMetadata = {
  type: 'body',
  metatype: CreateProductDetailDto,
  data: '',
};

describe('CreateProductDetailDto customOptions', () => {
  const pipe = new ScopedValidationPipe();

  it('preserves every supported custom-option field through body validation', async () => {
    const customOption = {
      id: 'local-option-1',
      productId: '',
      type: 'TEXT_BOX',
      label: 'Name on ornament',
      required: true,
      instructionText: 'Enter the name exactly as it should appear.',
      placeholder: 'e.g. Taylor',
      maxLength: 40,
      isMultiline: false,
      allowFileUpload: true,
      choices: [],
      allowMultiSelect: false,
      acceptedFileTypes: ['image/*', 'application/pdf'],
      maxFileSizeMB: 10,
      sortOrder: 0,
    };

    const result = await pipe.transform(
      { customOptions: [customOption] },
      BODY_METADATA,
    ) as CreateProductDetailDto;

    expect(result.customOptions).toEqual([customOption]);
  });

  it('rejects unknown nested fields instead of silently persisting partial data', async () => {
    await expect(pipe.transform({
      customOptions: [{
        id: 'local-option-1',
        type: 'TEXT_BOX',
        label: 'Name',
        misspelledPlaceholder: 'This must not be silently dropped',
      }],
    }, BODY_METADATA)).rejects.toThrow();
  });
});
