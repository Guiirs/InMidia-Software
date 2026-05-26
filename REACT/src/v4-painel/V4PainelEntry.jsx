// Ponto de entrada do V4Painel com suporte a página inicial por rota canônica.
// Usado pelo App.jsx para montar o painel V4 na página correta sem alterar
// o componente V4Painel original.
import V4Painel from './V4Painel.jsx';

export default function V4PainelEntry({ initialPage = 'dashboard', density = 'default' }) {
  return <V4Painel initialPage={initialPage} density={density} />;
}
