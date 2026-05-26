// src/pages/ApiStatus/ApiStatusPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../utils/config'; //
import { useAuth } from '../../context/AuthContext'; //
import './ApiStatus.css'; //

// --- Chaves do UptimeRobot ---
const UPTIMEROBOT_API_KEY = import.meta.env.VITE_UPTIMEROBOT_READONLY_KEY || null; //
const UPTIMEROBOT_MONITOR_ID = import.meta.env.VITE_UPTIMEROBOT_MONITOR_ID || null; //
const UPTIMEROBOT_API_URL = "https://api.uptimerobot.com/v2/getMonitors"; //

// --- Função de simulação ---
const fetchMockMonitorData = () => { //
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        uptime: "99.98%",
        averageLatency: "145ms",
        status: "success",
      });
    }, 500);
  });
};


function ApiStatusPage() {
  const [apiStatus, setApiStatus] = useState('loading'); //
  const [apiMessage, setApiMessage] = useState('A verificar estado da API...'); //
  const [monitorData, setMonitorData] = useState(null); //
  const [isLoadingMonitor, setIsLoadingMonitor] = useState(true); //
  const { isAuthenticated } = useAuth();

  // Efeito 1: Health Check (inalterado)
  useEffect(() => { //
    const healthCheckUrl = `${API_BASE_URL}/health`; // usar endpoint explícito de health
    if (import.meta.env.DEV) {
      console.info(`[ApiStatusPage] Health check URL: ${healthCheckUrl}`);
    }
    
    fetch(healthCheckUrl)
      .then(response => {
        if (!response.ok) throw new Error(`Servidor respondeu com ${response.status}`);
        return response.json();
      })
      .then(data => {
        const isHealthy = data?.status === 'ok' || data?.status === 'healthy';
        if (isHealthy) {
          setApiStatus('online');
          setApiMessage(data.message || 'A API está operacional.');
        } else {
          throw new Error(`Resposta da API inválida. status=${data?.status || 'desconhecido'}`);
        }
      })
      .catch(error => {
        console.error("[ApiStatusPage] Erro no Health Check:", error);
        setApiStatus('offline');
        setApiMessage('Não foi possível conectar à API.');
      });
  }, []);

  // Efeito 2: Buscar Dados Históricos (CORRIGIDO)
  useEffect(() => { //
    setIsLoadingMonitor(true);

    const fetchMonitorData = async () => {
      // Valida se temos key + monitor id numérico (UptimeRobot espera IDs numéricos)
      const monitorIdIsNumeric = /^[0-9]+$/.test(String(UPTIMEROBOT_MONITOR_ID));
      if (!UPTIMEROBOT_API_KEY || !UPTIMEROBOT_MONITOR_ID || !monitorIdIsNumeric) { //
        console.warn("[ApiStatusPage] Chaves UptimeRobot ausentes ou Monitor ID inválido. Usando dados simulados."); //
        const data = await fetchMockMonitorData(); //
        setMonitorData(data);
        setIsLoadingMonitor(false);
        return;
      }

      try { //
        console.log("[ApiStatusPage] Buscando dados reais do UptimeRobot..."); //
        
        const response = await fetch(UPTIMEROBOT_API_URL, { //
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // --- CORREÇÃO: Linha Cache-Control removida ---
            // 'Cache-Control': 'no-cache' //
          },
          body: JSON.stringify({
            api_key: UPTIMEROBOT_API_KEY, //
            monitors: UPTIMEROBOT_MONITOR_ID, //
            custom_uptime_ratios: "30", //
            response_times: "1", //
            response_times_limit: 1 //
          })
        });

        if (!response.ok) { //
          throw new Error(`Erro na rede UptimeRobot: ${response.statusText}`);
        }

        const data = await response.json(); //

        if (data.stat !== 'ok') { //
          throw new Error(`Erro da API UptimeRobot: ${data.error?.message || 'Erro desconhecido'}`);
        }
        if (!data.monitors || data.monitors.length === 0) { //
          throw new Error(`Monitor ID (${UPTIMEROBOT_MONITOR_ID}) não encontrado na conta UptimeRobot.`);
        }

        const monitor = data.monitors[0]; //
        
        setMonitorData({ //
          uptime: `${monitor.custom_uptime_ratios}%`,
          averageLatency: `${monitor.average_response_time}ms`,
          status: monitor.status === 2 ? 'success' : 'down'
        });
        
      } catch (error) { //
        console.error("[ApiStatusPage] Erro ao buscar dados reais do monitor:", error.message); //
        setMonitorData(null);
      } finally { //
        setIsLoadingMonitor(false);
      }
    };

    fetchMonitorData();
  }, []);

  // Define os links de navegação (inalterado)
  const primaryLink = isAuthenticated ? "/dashboard" : "/login"; //
  const primaryLinkText = isAuthenticated ? "Ir para o Dashboard" : "Aceder ao Login"; //

  return (
    <div className={`api-status-page status-${apiStatus}`}> {/* */}
      <div className="api-status-container"> {/* */}
        <div className="api-status-logo"> {/* */}
          <img src="/assets/img/logo 244.png" alt="InMidia Logo" /> {/* */}
          <span>InMidia</span> {/* */}
        </div>
        
        <h1 className="api-status-title">Status do Sistema</h1> {/* */}
        
        {/* Box 1: Status da Conexão */}
        <div className="api-status-box"> {/* */}
          <div className="api-status-header"> {/* */}
            <span>Status da Conexão (Agora)</span> {/* */}
          </div>
          <div className="api-status-indicator"> {/* */}
            <div className="api-status-dot"></div> {/* */}
            {apiStatus === 'loading' && <span>Verificando...</span>} {/* */}
            {apiStatus === 'online' && <span className="status-online-text">Operacional</span>} {/* */}
            {apiStatus === 'offline' && <span className="status-offline-text">Offline</span>} {/* */}
          </div>
          <p className="api-status-message"> {/* */}
            {apiMessage}
          </p>
        </div>

        {/* Box 2: Indicadores Históricos */}
        <div className="api-status-box"> {/* */}
           <div className="api-status-header"> {/* */}
            <span>Performance (Últimos 30 dias)</span> {/* */}
          </div>
          {isLoadingMonitor ? ( //
            <div className="api-status-loading-metrics">A carregar métricas...</div> //
          ) : monitorData ? ( //
            <div className="api-status-metrics-grid"> {/* */}
              <div className="api-status-metric-item"> {/* */}
                <span className="metric-value">{monitorData.uptime}</span> {/* */}
                <span className="metric-label">Uptime</span> {/* */}
              </div>
              <div className="api-status-metric-item"> {/* */}
                <span className="metric-value">{monitorData.averageLatency}</span> {/* */}
                <span className="metric-label">Latência Média</span> {/* */}
              </div>
            </div>
          ) : (
            <p className="api-status-message" style={{minHeight: 0}}>Não foi possível carregar dados históricos.</p> //
          )}
        </div>
        
        {/* Ações (inalterado) */}
        <div className="api-status-actions"> {/* */}
          <Link to={primaryLink} className="api-status-link primary"> {/* */}
            {primaryLinkText}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ApiStatusPage;
