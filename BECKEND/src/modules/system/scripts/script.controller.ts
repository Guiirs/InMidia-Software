/**
 * Script Controller
 * Endpoints de scripts
 */
// src/modules/system/scripts/script.controller.ts
import { Request, Response } from 'express';
import { validationResult, body } from 'express-validator';
import scriptRunner from './script-runner.service';
import path from 'path';

// Allowed scripts whitelist (relative to scripts/)
const ALLOWED_SCRIPTS = new Set([
  'conversion/test_excel_to_pdf.js',
  'template-tools/analyze_contrato_template.js',
  'template-tools/add_placeholders_to_contrato.js',
  // add more allowed scripts here
]);

// Validation rules
export const runValidation = [
  body('script').isString().notEmpty(),
  body('args').optional().isArray(),
  body('background').optional().isBoolean(),
];

async function run(req: Request, res: Response): Promise<void> {
  // simple validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { script, args = [], background = false } = req.body;

  if (!script) {
    res.status(400).json({ error: 'script is required' });
    return;
  }

  // Normalize path and enforce whitelist
  const normalized = path.normalize(script).replace(/^\.\.[/\\]/, '');
  if (!ALLOWED_SCRIPTS.has(normalized)) {
    res.status(403).json({ error: 'script not allowed' });
    return;
  }

  try {
    const result = await scriptRunner.runScript(normalized, { args, background });
    res.json({ ok: true, result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export { run };

