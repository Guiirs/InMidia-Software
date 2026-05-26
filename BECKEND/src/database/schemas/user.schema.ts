import { Schema } from 'mongoose';
import { IUser } from '../../types/models';
import bcrypt from 'bcryptjs';

export const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username é obrigatório'],
      unique: true,
      index: true,
      trim: true,
      minlength: [3, 'Username deve ter pelo menos 3 caracteres'],
      maxlength: [50, 'Username deve ter no máximo 50 caracteres'],
    },
    email: {
      type: String,
      required: [true, 'Email é obrigatório'],
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email inválido'],
    },
    senha: {
      type: String,
      minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
      select: false, // Não retornar por padrão
    },
    password: {
      type: String,
      select: false, // Campo legado para compatibilidade
    },
    nome: {
      type: String,
      required: [true, 'Nome é obrigatório'],
      trim: true,
      maxlength: [100, 'Nome deve ter no máximo 100 caracteres'],
    },
    telefone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      default: 'user',
      enum: {
        values: [
          'user',
          'admin',
          'superadmin',
          'admin_empresa',
          'gestor',
          'vendedor',
          'financeiro',
          'visualizador',
        ],
        message: '{VALUE} não é uma role válida',
      },
    },
    ativo: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    resetToken: {
      type: String,
      select: false,
    },
    tokenExpiry: {
      type: Date,
      index: { expires: 0 },
    },
    empresa: {
      type: Schema.Types.ObjectId,
      ref: 'Empresa',
      required: [true, 'Empresa é obrigatória'],
      index: true,
      alias: 'empresaId', // Alias para compatibilidade com código novo
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Hash password before saving (suporta ambos os campos)
userSchema.pre('save', async function (next) {
  // Verificar qual campo foi modificado
  const senhaModified = this.isModified('senha');
  const passwordModified = this.isModified('password');
  
  if (!senhaModified && !passwordModified) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    const doc = this as any;
    
    if (senhaModified && doc.senha) {
      doc.senha = await bcrypt.hash(doc.senha, salt);
    }
    
    if (passwordModified && doc.password) {
      doc.password = await bcrypt.hash(doc.password, salt);
    }
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Virtual id
userSchema.virtual('id').get(function () {
  return (this._id as any).toHexString();
});
