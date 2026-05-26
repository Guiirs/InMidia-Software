import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from '../../components/Modal/Modal';

const STATUS_OPTS = [
  { value: 'ACTIVE',   label: 'Ativo' },
  { value: 'INACTIVE', label: 'Inativo' },
  { value: 'BLOCKED',  label: 'Bloqueado' },
];

export default function ClientFormModal({ isOpen, onClose, onSubmit, initialData, isSubmitting }) {
  const isEdit = !!initialData;

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      tipoPessoa:   'PJ',
      nome:         '',
      documento:    '',
      nomeFantasia: '',
      responsavel:  '',
      email:        '',
      telefone:     '',
      whatsapp:     '',
      endereco:     '',
      cidade:       '',
      estado:       '',
      observacoes:  '',
      status:       'ACTIVE',
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset(
        initialData
          ? {
              tipoPessoa:   initialData.tipoPessoa   ?? 'PJ',
              nome:         initialData.nome          ?? '',
              documento:    initialData.documento     ?? '',
              nomeFantasia: initialData.nomeFantasia  ?? '',
              responsavel:  initialData.responsavel   ?? '',
              email:        initialData.email         ?? '',
              telefone:     initialData.telefone      ?? '',
              whatsapp:     initialData.whatsapp      ?? '',
              endereco:     initialData.endereco       ?? '',
              cidade:       initialData.cidade        ?? '',
              estado:       initialData.estado        ?? '',
              observacoes:  initialData.observacoes   ?? '',
              status:       initialData.status        ?? 'ACTIVE',
            }
          : {
              tipoPessoa: 'PJ', nome: '', documento: '', nomeFantasia: '',
              responsavel: '', email: '', telefone: '', whatsapp: '',
              endereco: '', cidade: '', estado: '', observacoes: '', status: 'ACTIVE',
            }
      );
    }
  }, [isOpen, initialData, reset]);

  const I = (name, label, opts = {}) => (
    <div className={`modal-form__input-group ${opts.full ? 'modal-form__input-group--full' : ''}`}>
      <label htmlFor={name}>{label}{opts.required && ' *'}</label>
      <input
        type={opts.type ?? 'text'}
        id={name}
        placeholder={opts.placeholder}
        className={`modal-form__input ${errors[name] ? 'input-error' : ''}`}
        disabled={isSubmitting}
        {...register(name, {
          required: opts.required ? `${label} é obrigatório` : false,
          minLength: opts.minLength,
          maxLength: opts.maxLength,
          pattern:   opts.pattern,
        })}
      />
      {errors[name] && <div className="modal-form__error-message">{errors[name].message}</div>}
    </div>
  );

  return (
    <Modal
      title={isEdit ? 'Editar Cliente' : 'Novo Cliente'}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="modal-form__grid">

          {/* Tipo pessoa */}
          <div className="modal-form__input-group">
            <label htmlFor="tipoPessoa">Tipo de Pessoa *</label>
            <select
              id="tipoPessoa"
              className="modal-form__input"
              disabled={isSubmitting || isEdit}
              {...register('tipoPessoa', { required: 'Tipo de pessoa obrigatório' })}
            >
              <option value="PJ">Pessoa Jurídica</option>
              <option value="PF">Pessoa Física</option>
            </select>
            {errors.tipoPessoa && <div className="modal-form__error-message">{errors.tipoPessoa.message}</div>}
          </div>

          {/* Status (only in edit mode) */}
          {isEdit && (
            <div className="modal-form__input-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                className="modal-form__input"
                disabled={isSubmitting}
                {...register('status')}
              >
                {STATUS_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {I('nome', 'Razão Social / Nome', { required: true, full: true })}
          {I('documento', 'CPF / CNPJ', { required: !isEdit, placeholder: 'Somente números' })}
          {I('nomeFantasia', 'Nome Fantasia')}
          {I('responsavel', 'Responsável')}
          {I('email', 'Email', { type: 'email' })}
          {I('telefone', 'Telefone')}
          {I('whatsapp', 'WhatsApp')}
          {I('endereco', 'Endereço')}
          {I('cidade', 'Cidade')}
          {I('estado', 'Estado (UF)', { placeholder: 'SP', maxLength: { value: 2, message: 'Máx 2 caracteres' } })}

          {/* Observações full-width */}
          <div className="modal-form__input-group modal-form__input-group--full">
            <label htmlFor="observacoes">Observações</label>
            <textarea
              id="observacoes"
              rows={3}
              className="modal-form__input"
              disabled={isSubmitting}
              {...register('observacoes')}
            />
          </div>
        </div>

        <div className="modal-form__actions">
          <button
            type="button"
            className="modal-form__button modal-form__button--cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="modal-form__button modal-form__button--confirm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : isEdit ? 'Guardar Alterações' : 'Criar Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
