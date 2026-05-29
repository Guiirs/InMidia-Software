import { Request, Response, NextFunction } from 'express';
import jobManager from './jobManager';

// Usa a augmentação global de Express.Request (types/express.d.ts) que já adiciona
// req.user: IUserPayload. Não redefine a interface para evitar conflito de tipos.
type AuthenticatedRequest = Request;

// Controller functions for express routes.
// Retornam Promise<void> conforme esperado pelo Express 5 — res.xxx() sem return.
async function postGenerate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { contratoId, background = true } = req.body;
    const empresaId = req.user?.empresaId || '';
    // IUserPayload é compatível com UserData — cast seguro (ambos têm as mesmas propriedades).
    const user = (req.user || null) as Parameters<typeof jobManager.startJobGeneratePDF>[2];

    if (!contratoId) {
      res.status(400).json({ error: 'contratoId is required' });
      return;
    }

    const jobId = await jobManager.startJobGeneratePDF(contratoId, empresaId, user);

    if (background) {
      res.status(202).json({ ok: true, jobId });
      return;
    }

    // If foreground, wait until job finishes
    const checkFinished = () => new Promise<void>((resolve) => {
      const handler = (id: string) => {
        if (id !== jobId) return;
        jobManager.ee.removeListener('done', handler);
        jobManager.ee.removeListener('failed', handler);
        resolve();
      };
      jobManager.ee.on('done', handler);
      jobManager.ee.on('failed', handler);
    });

    await checkFinished();
    const job = await jobManager.getJob(String(jobId), empresaId);
    if (job && job.status === 'done') {
      if (job.resultPath) { res.sendFile(job.resultPath); return; }
      if (job.resultUrl) { res.redirect(job.resultUrl); return; }
      res.status(500).json({ ok: false, error: 'result missing' });
      return;
    }
    res.status(500).json({ ok: false, error: job?.error || 'unknown' });

  } catch (err) {
    next(err);
  }
}

async function getStatus(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  const empresaId = (req as AuthenticatedRequest).user?.empresaId || '';
  const job = await jobManager.getJob(String(jobId), empresaId);
  if (!job) { res.status(404).json({ error: 'job not found' }); return; }
  res.json({ ok: true, job });
}

export { postGenerate, getStatus };
