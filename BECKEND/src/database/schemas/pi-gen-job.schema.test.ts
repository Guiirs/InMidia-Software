import { Types } from 'mongoose';
import PiGenJob from '../../models/PiGenJob';

describe('PiGenJob schema — empresaId', () => {
  it('fails validation when empresaId is missing', () => {
    const job = new PiGenJob({
      jobId: 'job_test_1',
      type: 'generate_pdf',
      status: 'queued',
    });

    const error = job.validateSync();

    expect(error).toBeDefined();
    expect(error?.errors.empresaId).toBeDefined();
  });

  it('passes validation when empresaId is provided', () => {
    const job = new PiGenJob({
      jobId: 'job_test_2',
      type: 'generate_pdf',
      status: 'queued',
      empresaId: new Types.ObjectId(),
    });

    const error = job.validateSync();

    expect(error?.errors.empresaId).toBeUndefined();
  });
});
