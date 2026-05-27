// src/hooks/useWhatsApp.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import whatsappService from '../services/whatsappService';
import { useToast } from '../components/ToastNotification/ToastNotification';
import { API_V1_BASE_URL } from '../utils/config';

export function useWhatsApp() {
  const [sseConnection, setSseConnection] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    conectado: false,
    numero_conectado: null,
    qr_code: null,
    grupo_configurado: false,
    grupo_id: null,
    tentativas_reconexao: 0,
    max_tentativas_reconexao: 5
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastStatusUpdate, setLastStatusUpdate] = useState(null);

  const showToast = useToast();
  const reconnectTimeoutRef = useRef(null);
  const connectedRef = useRef(connectionStatus.conectado);

  // Query para obter status do WhatsApp
  const {
    data: statusData,
    isLoading: isLoadingStatus,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ['whatsappStatus'],
    queryFn: () => whatsappService.getStatus(),
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    staleTime: 10000,
  });

  // Mutation para reconectar
  const reconnectMutation = useMutation({
    mutationFn: () => whatsappService.reconnect(),
    onSuccess: () => {
      showToast('Reconexão do WhatsApp iniciada!', 'info');
      setIsConnecting(true);
      // Refetch status após 5 segundos
      setTimeout(() => {
        refetchStatus();
        setIsConnecting(false);
      }, 5000);
    },
    onError: (error) => {
      showToast(`Erro na reconexão: ${error.message}`, 'error');
      setIsConnecting(false);
    }
  });

  useEffect(() => {
    connectedRef.current = connectionStatus.conectado;
  }, [connectionStatus.conectado]);

  // Conecta ao SSE
  const connectSSE = useCallback(() => {
    if (sseConnection) return;

    try {
      // Build SSE URL without new URL() — it throws when API_BASE_URL is a
      // same-origin relative path ('/api/v1') because new URL() requires an
      // absolute base. EventSource accepts relative URLs natively.
      const base = API_V1_BASE_URL.replace(/\/$/, '');
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (token) params.set('token', token);
      const sseUrl = `${base}/sse/stream?${params.toString()}`;

      const eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'whatsapp_qr') {
            const newQrCode = data.data.qrCode;
            setQrCode(newQrCode);
            setConnectionStatus(prev => ({
              ...prev,
              qr_code: newQrCode
            }));
            setLastStatusUpdate(Date.now());
            showToast('QR Code gerado! Escaneie com seu WhatsApp.', 'info');
          }

          if (data.type === 'whatsapp_status') {
            const newStatus = data.data;
            const isConnected = newStatus.status === 'connected';

            setConnectionStatus(prev => ({
              ...prev,
              conectado: isConnected,
              numero_conectado: newStatus.connectedNumber || prev.numero_conectado,
              qr_code: newStatus.qrCode || prev.qr_code
            }));

            setLastStatusUpdate(Date.now());

            // Só mostra toast se o status realmente mudou
            if (isConnected && !connectedRef.current) {
              showToast(`WhatsApp conectado! Número: ${newStatus.connectedNumber || 'N/A'}`, 'success');
              setQrCode(null);
              setIsConnecting(false);
            } else if (!isConnected && connectedRef.current) {
              if (newStatus.status === 'disconnected') {
                showToast('WhatsApp desconectado. Tentando reconectar...', 'warning');
                setIsConnecting(true);
              } else if (newStatus.status === 'auth_failure') {
                showToast('Falha na autenticação do WhatsApp. Novo QR Code será gerado.', 'error');
                setQrCode(null);
                setIsConnecting(true);
              }
            }

            // Refetch status em background
            refetchStatus();
          }
        } catch (error) {
          console.error('Erro ao processar evento SSE:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Erro na conexão SSE:', error);
        setSseConnection(null);
        // Tenta reconectar SSE após 5 segundos
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE();
        }, 5000);
      };

      setSseConnection(eventSource);
    } catch (error) {
      console.error('Erro ao conectar SSE:', error);
    }
  }, [sseConnection, showToast, refetchStatus]);

  // Desconecta SSE
  const disconnectSSE = useCallback(() => {
    if (sseConnection) {
      sseConnection.close();
      setSseConnection(null);
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, [sseConnection]);

  // Atualiza status quando os dados da query mudam
  useEffect(() => {
    if (statusData?.status && (!lastStatusUpdate || Date.now() - lastStatusUpdate > 5000)) {
      const newStatus = statusData.status;
      setConnectionStatus(prev => ({
        ...prev,
        conectado: newStatus.conectado || false,
        numero_conectado: newStatus.numero_conectado || prev.numero_conectado,
        qr_code: newStatus.qr_code || prev.qr_code,
        grupo_configurado: newStatus.grupo_configurado || false,
        grupo_id: newStatus.grupo_id || prev.grupo_id,
        tentativas_reconexao: newStatus.tentativas_reconexao || 0,
        max_tentativas_reconexao: newStatus.max_tentativas_reconexao || 5
      }));

      if (newStatus.qr_code && !qrCode) {
        setQrCode(newStatus.qr_code);
      }
    }
  }, [statusData, lastStatusUpdate, qrCode]);

  // Conecta SSE quando o componente monta
  useEffect(() => {
    connectSSE();
    return () => {
      disconnectSSE();
    };
  }, [connectSSE, disconnectSSE]);

  // Função para reconectar manualmente
  const handleReconnect = useCallback(() => {
    reconnectMutation.mutate();
  }, [reconnectMutation]);

  return {
    // Estado
    qrCode,
    connectionStatus,
    isLoadingStatus,
    isConnecting: isConnecting || reconnectMutation.isPending,

    // Ações
    handleReconnect,

    // SSE
    sseConnected: !!sseConnection,

    // Dados da query
    statusData
  };
}
