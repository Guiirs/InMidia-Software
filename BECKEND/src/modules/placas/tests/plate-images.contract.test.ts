import { PlacaImageSchema, UploadPlateImageSchema } from '../dtos/placa.dto';

describe('Plate image contract', () => {
  it('aceita upload MAIN com source UPLOAD e campos futuros de geracao', () => {
    const result = UploadPlateImageSchema.parse({
      category: 'MAIN',
      setAsMain: 'true',
      templateId: 'plate-default',
      generationSource: 'canvas',
      generatedBy: 'future-generator',
      version: '2',
    });

    expect(result).toEqual(expect.objectContaining({
      category: 'MAIN',
      setAsMain: true,
      source: 'UPLOAD',
      templateId: 'plate-default',
      generationSource: 'canvas',
      generatedBy: 'future-generator',
      version: 2,
    }));
  });

  it('valida arquivo de imagem e bloqueia mime invalido', () => {
    expect(() => PlacaImageSchema.parse({
      mimetype: 'application/pdf',
      size: 10,
      filename: 'doc.pdf',
    })).toThrow();
  });

  it('bloqueia imagem acima de 5MB', () => {
    expect(() => PlacaImageSchema.parse({
      mimetype: 'image/png',
      size: 6 * 1024 * 1024,
      filename: 'large.png',
    })).toThrow();
  });
});
