import { UploadMediaSchema, validateUploadFile } from '../media.dto';

describe('Media Core DTO', () => {
  it('normalizes upload payload for plate main image', () => {
    const dto = UploadMediaSchema.parse({
      ownerType: 'PLATE',
      ownerId: '665f1f2e8f1f2e8f1f2e8f1f',
      category: 'MAIN',
      setAsMain: 'true',
      source: 'UPLOAD',
    });

    expect(dto.ownerType).toBe('PLATE');
    expect(dto.category).toBe('MAIN');
    expect(dto.setAsMain).toBe(true);
  });

  it('rejects invalid mime type', () => {
    const file = {
      mimetype: 'image/gif',
      size: 10,
      originalname: 'placa.gif',
    } as Express.Multer.File;

    expect(() => validateUploadFile(file)).toThrow('Use uma imagem JPG, PNG ou WebP.');
  });

  it('rejects oversized uploads', () => {
    const file = {
      mimetype: 'image/webp',
      size: 6 * 1024 * 1024,
      originalname: 'placa.webp',
    } as Express.Multer.File;

    expect(() => validateUploadFile(file)).toThrow('Imagem muito grande');
  });
});
