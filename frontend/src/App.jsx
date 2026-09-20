import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import TicketDashboard from './components/TicketDashboard';
import TicketDetail from './components/TicketDetail';
import ResponsiblePanel from './components/ResponsiblePanel';
import OwnerPanel from './components/OwnerPanel';
import ConsumerModal from './components/ConsumerModal';
import SetupModal from './components/SetupModal';
import Toast from './components/Toast';
import api from './services/api';

export function App() {
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'ticket-detail' | 'responsible' | 'owner'
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Authenticated user sessions
  const [ownerUser, setOwnerUser] = useState(() => {
    try {
      const saved = localStorage.getItem('owner_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [responsibleUser, setResponsibleUser] = useState(() => {
    try {
      const saved = localStorage.getItem('responsible_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const showToast = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  };

  // Check health and setup status
  const checkHealth = useCallback(async () => {
    try {
      const health = await api.checkHealth();
      setSystemHealth(health);
      if (health.setup_required) {
        setSetupRequired(true);
      } else {
        setSetupRequired(false);
      }
    } catch (err) {
      if (err.status === 428) {
        setSetupRequired(true);
      }
      console.warn('Backend probe:', err.message);
    }
  }, []);

  // Fetch tickets list
  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const data = await api.listTickets();
      setTickets(data);
    } catch (err) {
      if (err.status === 428) {
        setSetupRequired(true);
      } else {
        console.error('Failed to load tickets:', err);
      }
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    fetchTickets();
  }, [checkHealth, fetchTickets]);

  const handleSelectTicket = (ticketId) => {
    setSelectedTicketId(ticketId);
    setActiveView('ticket-detail');
  };

  const handleTicketCreated = (newTicket) => {
    fetchTickets();
    showToast(
      `Ticket #${newTicket.id} created & routed to ${newTicket.category}!`,
      'success'
    );
  };

  const handleTicketUpdated = (updatedTicket) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t))
    );
    showToast(`Status updated to ${updatedTicket.status}`, 'info');
  };

  const handleTicketDeleted = (deletedId) => {
    setTickets((prev) => prev.filter((t) => t.id !== deletedId));
    showToast(`Ticket #${deletedId} deleted`, 'info');
  };

  const handleOwnerLogin = (user) => {
    setOwnerUser(user);
    try {
      localStorage.setItem('owner_session', JSON.stringify(user));
    } catch (e) {
      // ignore
    }
  };

  const handleOwnerLogout = () => {
    setOwnerUser(null);
    try {
      localStorage.removeItem('owner_session');
    } catch (e) {
      // ignore
    }
    showToast('Owner session locked.', 'info');
  };

  const handleResponsibleLogin = (user) => {
    setResponsibleUser(user);
    try {
      localStorage.setItem('responsible_session', JSON.stringify(user));
    } catch (e) {
      // ignore
    }
  };

  const handleResponsibleLogout = () => {
    setResponsibleUser(null);
    try {
      localStorage.removeItem('responsible_session');
    } catch (e) {
      // ignore
    }
    showToast('Logged out from Lead Portal.', 'info');
  };

  const handleResetSuccess = () => {
    setTickets([]);
    setSelectedTicketId(null);
    handleOwnerLogout();
    handleResponsibleLogout();
    setActiveView('dashboard');
    setSetupRequired(true);
    showToast('Factory reset successful. System requires setup.', 'warning');
  };

  const handleSetupComplete = () => {
    setSetupRequired(false);
    checkHealth();
    fetchTickets();
    showToast('System setup initialized successfully!', 'success');
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Navigation */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        systemHealth={systemHealth}
        responsibleUser={responsibleUser}
        ownerUser={ownerUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'dashboard' && (
          <TicketDashboard
            tickets={tickets}
            loading={loadingTickets}
            onRefresh={fetchTickets}
            onSelectTicket={handleSelectTicket}
            onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
          />
        )}

        {activeView === 'ticket-detail' && selectedTicketId && (
          <TicketDetail
            ticketId={selectedTicketId}
            onBack={() => setActiveView('dashboard')}
            onTicketUpdated={handleTicketUpdated}
            onTicketDeleted={handleTicketDeleted}
          />
        )}

        {activeView === 'responsible' && (
          <ResponsiblePanel
            currentUser={responsibleUser}
            onLogin={handleResponsibleLogin}
            onLogout={handleResponsibleLogout}
            showToast={showToast}
          />
        )}

        {activeView === 'owner' && (
          <OwnerPanel
            currentUser={ownerUser}
            onLogin={handleOwnerLogin}
            onLogout={handleOwnerLogout}
            onResetSuccess={handleResetSuccess}
            showToast={showToast}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <p>AI-Supported Ticket System &bull; Powered by Google Gemini &amp; React 19</p>
      </footer>

      {/* Consumer Ticket Submission Modal (Without Auth) */}
      <ConsumerModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onTicketCreated={handleTicketCreated}
      />

      {/* First-time Setup Modal */}
      <SetupModal
        isOpen={setupRequired}
        onSetupComplete={handleSetupComplete}
      />

      {/* Feedback Toast */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;
