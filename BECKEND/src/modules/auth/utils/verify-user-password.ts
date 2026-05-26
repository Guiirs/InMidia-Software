import bcrypt from 'bcrypt';

type PasswordField = 'senha' | 'password';

type PasswordVerificationResult = {
  isMatch: boolean;
  fieldUsed: PasswordField | null;
  availableFields: PasswordField[];
};

function getAvailablePasswordFields(user: unknown): PasswordField[] {
  const source = user as Record<string, unknown> | null | undefined;
  const fields: PasswordField[] = [];

  if (typeof source?.senha === 'string' && source.senha.length > 0) {
    fields.push('senha');
  }

  if (typeof source?.password === 'string' && source.password.length > 0) {
    fields.push('password');
  }

  return fields;
}

export async function verifyUserPassword(
  user: unknown,
  plainPassword: string,
): Promise<PasswordVerificationResult> {
  const source = user as Record<string, unknown> | null | undefined;
  const availableFields = getAvailablePasswordFields(source);
  const fieldUsed = availableFields[0] ?? null;

  if (!fieldUsed) {
    return {
      isMatch: false,
      fieldUsed: null,
      availableFields,
    };
  }

  const hashedPassword = source?.[fieldUsed];
  if (typeof hashedPassword !== 'string' || hashedPassword.length === 0) {
    return {
      isMatch: false,
      fieldUsed,
      availableFields,
    };
  }

  const isMatch = await bcrypt.compare(plainPassword, hashedPassword);

  return {
    isMatch,
    fieldUsed,
    availableFields,
  };
}
