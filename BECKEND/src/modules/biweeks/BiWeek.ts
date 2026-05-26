import mongoose, { Model } from 'mongoose';
import { IBiWeek } from '../../types/models.d';
import { biWeekSchema } from '@database/schemas/bi-week.schema';

// Static methods
biWeekSchema.statics.findByDate = function (date: Date) {
  return this.findOne({
    dataInicio: { $lte: date },
    dataFim: { $gte: date },
    ativo: true,
  }).exec();
};

biWeekSchema.statics.findByYear = function (year: number) {
  return this.find({ ano: year, ativo: true }).sort({ numero: 1 }).exec();
};

biWeekSchema.statics.generateCalendar = function (year: number, customStartDate: Date | null = null) {
  const biWeeks: any[] = [];

  let startOfYear: Date;
  if (customStartDate) {
    startOfYear = new Date(customStartDate);
    startOfYear.setUTCHours(0, 0, 0, 0);
  } else {
    startOfYear = new Date(Date.UTC(year, 0, 1));
  }

  for (let i = 0; i < 26; i++) {
    const startDate = new Date(startOfYear);
    startDate.setUTCDate(startOfYear.getUTCDate() + i * 14);

    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 13);
    endDate.setUTCHours(23, 59, 59, 999);

    const numero = (i + 1) * 2;
    const bi_week_id = `${year}-${String(numero).padStart(2, '0')}`;

    biWeeks.push({
      bi_week_id,
      ano: year,
      numero,
      dataInicio: startDate,
      dataFim: endDate,
      descricao: `Bi-Semana ${numero} de ${year}`,
      ativo: true,
    });
  }

  return biWeeks;
};

// Instance methods
biWeekSchema.methods.getFormattedPeriod = function (): string {
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const start = this.dataInicio.toLocaleDateString('pt-BR', options);
  const end = this.dataFim.toLocaleDateString('pt-BR', options);
  return `${start} até ${end}`;
};

const BiWeek: Model<IBiWeek> = mongoose.models.BiWeek || mongoose.model<IBiWeek>('BiWeek', biWeekSchema);

export default BiWeek;
