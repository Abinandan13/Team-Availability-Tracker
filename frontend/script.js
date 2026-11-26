/**
 * Team Availability Tracker - Frontend UI Logic
 * Vanilla JavaScript (ES6+)
 * 
 * Module 4: Full integration with FastAPI REST API & SQLite Database.
 * Live data fetching, asynchronous availability toggling, optimistic rollback,
 * search, filters, error handling, and toast notifications.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. Configuration & API Endpoints
  // ==========================================================================
  const API_BASE_URL = window.API_BASE_URL || 'http://127.0.0.1:8000';

  // Preset avatar gradients for visual polish
  const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #6366f1, #4338ca)',
    'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'linear-gradient(135deg, #ec4899, #be185d)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #10b981, #047857)',
    'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    'linear-gradient(135deg, #06b6d4, #0e7490)',
    'linear-gradient(135deg, #64748b, #334155)',
    'linear-gradient(135deg, #14b8a6, #0f766e)',
    'linear-gradient(135deg, #f43f5e, #be123c)'
  ];

  // ==========================================================================
  // 2. Application State Management
  // ==========================================================================
  const state = {
    teamMembers: [],
    currentFilter: 'all', // 'all' | 'available' | 'unavailable'
    searchQuery: '',
    isLoading: true,
    updatingUserIds: new Set() // Tracks users with active PATCH requests in flight
  };

  // ==========================================================================
  // 3. DOM Elements Cache
  // ==========================================================================
  const DOM = {
    // Metric Cards
    totalMembersCount: document.getElementById('totalMembersCount'),
    availableMembersCount: document.getElementById('availableMembersCount'),
    unavailableMembersCount: document.getElementById('unavailableMembersCount'),
    availableRateBadge: document.getElementById('availableRateBadge'),
    unavailableRateBadge: document.getElementById('unavailableRateBadge'),
    navTeamCount: document.getElementById('navTeamCount'),

    // Search and Filter Controls
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    filterCountAll: document.getElementById('filterCountAll'),
    filterCountAvailable: document.getElementById('filterCountAvailable'),
    filterCountUnavailable: document.getElementById('filterCountUnavailable'),
    resultsCountText: document.getElementById('resultsCountText'),
    clearAllFiltersBtn: document.getElementById('clearAllFiltersBtn'),

    // Table & States
    teamTable: document.getElementById('teamTable'),
    teamTableBody: document.getElementById('teamTableBody'),
    tableLoadingState: document.getElementById('tableLoadingState'),
    tableErrorState: document.getElementById('tableErrorState'),
    tableErrorMessage: document.getElementById('tableErrorMessage'),
    retryFetchBtn: document.getElementById('retryFetchBtn'),
    emptyState: document.getElementById('emptyState'),
    emptyStateResetBtn: document.getElementById('emptyStateResetBtn'),

    // Header Actions
    refreshDataBtn: document.getElementById('refreshDataBtn'),
    resetDataBtn: document.getElementById('resetDataBtn'),
    currentDateDisplay: document.getElementById('currentDateDisplay'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer'),

    // Mobile Sidebar Elements
    mobileToggleBtn: document.getElementById('mobileToggleBtn'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop')
  };

  // ==========================================================================
  // 4. Helper Functions
  // ==========================================================================

  /**
   * Generates initials from a full name (e.g., "Sarah Jenkins" -> "SJ")
   */
  function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Assign consistent avatar gradient based on user id or index
   */
  function getAvatarGradient(userId, index) {
    if (index !== undefined && index < AVATAR_GRADIENTS.length) {
      return AVATAR_GRADIENTS[index];
    }
    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % AVATAR_GRADIENTS.length;
    return AVATAR_GRADIENTS[idx];
  }

  /**
   * Format and display today's date in header
   */
  function setupCurrentDate() {
    if (!DOM.currentDateDisplay) return;
    try {
      const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      const today = new Date().toLocaleDateString('en-US', options);
      DOM.currentDateDisplay.textContent = today;
    } catch (e) {
      DOM.currentDateDisplay.textContent = 'Today';
    }
  }

  // ==========================================================================
  // 5. Dashboard Summary Calculations
  // ==========================================================================

  /**
   * Recalculates and updates the 3 summary metric cards and counters
   */
  function updateDashboardMetrics() {
    const total = state.teamMembers.length;
    const available = state.teamMembers.filter(m => m.is_available).length;
    const unavailable = total - available;

    const availablePct = total > 0 ? Math.round((available / total) * 100) : 0;
    const unavailablePct = total > 0 ? Math.round((unavailable / total) * 100) : 0;

    // Update DOM counts
    if (DOM.totalMembersCount) DOM.totalMembersCount.textContent = total;
    if (DOM.availableMembersCount) DOM.availableMembersCount.textContent = available;
    if (DOM.unavailableMembersCount) DOM.unavailableMembersCount.textContent = unavailable;

    // Update percentage badges
    if (DOM.availableRateBadge) DOM.availableRateBadge.textContent = `${availablePct}%`;
    if (DOM.unavailableRateBadge) DOM.unavailableRateBadge.textContent = `${unavailablePct}%`;

    // Update Filter Tab Badges
    if (DOM.filterCountAll) DOM.filterCountAll.textContent = total;
    if (DOM.filterCountAvailable) DOM.filterCountAvailable.textContent = available;
    if (DOM.filterCountUnavailable) DOM.filterCountUnavailable.textContent = unavailable;

    // Update Sidebar Navigation Count
    if (DOM.navTeamCount) DOM.navTeamCount.textContent = total;
  }

  // ==========================================================================
  // 6. Filtering & Searching Logic
  // ==========================================================================

  /**
   * Filters the master team members list based on currentFilter and searchQuery
   */
  function getFilteredMembers() {
    const query = state.searchQuery.trim().toLowerCase();

    return state.teamMembers.filter(member => {
      // Status filter check
      if (state.currentFilter === 'available' && !member.is_available) {
        return false;
      }
      if (state.currentFilter === 'unavailable' && member.is_available) {
        return false;
      }

      // Search query check (search by name, role, or email)
      if (query) {
        const matchesName = (member.name || '').toLowerCase().includes(query);
        const matchesRole = (member.role || '').toLowerCase().includes(query);
        const matchesEmail = (member.email || '').toLowerCase().includes(query);
        return matchesName || matchesRole || matchesEmail;
      }

      return true;
    });
  }

  /**
   * Updates the informational text below search & filter controls
   */
  function updateResultsStatusText(filteredCount, totalCount) {
    if (!DOM.resultsCountText) return;

    const query = state.searchQuery.trim();
    const hasFilter = state.currentFilter !== 'all';
    const hasSearch = query.length > 0;

    let text = `Showing ${filteredCount} of ${totalCount} team members`;

    if (hasFilter && hasSearch) {
      text = `Found ${filteredCount} ${state.currentFilter} member${filteredCount === 1 ? '' : 's'} matching "${query}"`;
    } else if (hasFilter) {
      text = `Showing ${filteredCount} ${state.currentFilter} member${filteredCount === 1 ? '' : 's'}`;
    } else if (hasSearch) {
      text = `Found ${filteredCount} member${filteredCount === 1 ? '' : 's'} matching "${query}"`;
    }

    DOM.resultsCountText.textContent = text;

    // Toggle visibility of "Reset filters" link
    if (DOM.clearAllFiltersBtn) {
      if (hasFilter || hasSearch) {
        DOM.clearAllFiltersBtn.classList.remove('hidden');
      } else {
        DOM.clearAllFiltersBtn.classList.add('hidden');
      }
    }
  }

  // ==========================================================================
  // 7. Team Table Rendering
  // ==========================================================================

  /**
   * Creates a single table row HTML string for a team member
   */
  function createMemberRowHTML(member, index) {
    const initials = getInitials(member.name);
    const statusText = member.is_available ? 'Available' : 'Unavailable';
    const statusClass = member.is_available ? 'status-available' : 'status-unavailable';
    const isChecked = member.is_available ? 'checked' : '';
    const avatarBg = getAvatarGradient(member.id, index);
    const isUpdating = state.updatingUserIds.has(member.id);
    const disabledAttr = isUpdating ? 'disabled' : '';
    const pendingClass = isUpdating ? 'pending' : '';

    return `
      <tr data-member-id="${escapeHTML(member.id)}">
        <!-- Member Profile -->
        <td>
          <div class="member-cell">
            <div class="member-avatar" style="background: ${avatarBg};" aria-hidden="true">
              ${escapeHTML(initials)}
            </div>
            <div class="member-info">
              <span class="member-name">${escapeHTML(member.name)}</span>
              <span class="member-subtext">${escapeHTML(member.department || 'Engineering')}</span>
            </div>
          </div>
        </td>

        <!-- Email Address -->
        <td>
          <span class="email-text">${escapeHTML(member.email)}</span>
        </td>

        <!-- Job Role -->
        <td>
          <span class="role-badge">${escapeHTML(member.role)}</span>
        </td>

        <!-- Availability Status Indicator -->
        <td>
          <div class="status-pill ${statusClass}" id="status-pill-${escapeHTML(member.id)}">
            <span class="status-indicator-dot"></span>
            <span class="status-text">${statusText}</span>
          </div>
        </td>

        <!-- Availability Toggle Switch -->
        <td class="text-right">
          <div class="toggle-switch-wrapper">
            <label class="switch ${pendingClass}" id="switch-wrap-${escapeHTML(member.id)}" aria-label="Toggle availability for ${escapeHTML(member.name)}">
              <input 
                type="checkbox" 
                class="member-toggle" 
                data-id="${escapeHTML(member.id)}" 
                ${isChecked}
                ${disabledAttr}
              >
              <span class="slider"></span>
            </label>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Renders the team table body or appropriate state
   */
  function renderTeamTable() {
    // If still in initial load, display loading state
    if (state.isLoading) {
      if (DOM.tableLoadingState) DOM.tableLoadingState.classList.remove('hidden');
      if (DOM.tableErrorState) DOM.tableErrorState.classList.add('hidden');
      if (DOM.emptyState) DOM.emptyState.classList.add('hidden');
      if (DOM.teamTable) DOM.teamTable.classList.add('hidden');
      return;
    }

    if (DOM.tableLoadingState) DOM.tableLoadingState.classList.add('hidden');
    if (DOM.tableErrorState) DOM.tableErrorState.classList.add('hidden');

    const filteredMembers = getFilteredMembers();
    const totalMembers = state.teamMembers.length;

    // Update result status text
    updateResultsStatusText(filteredMembers.length, totalMembers);

    if (filteredMembers.length === 0) {
      // Show empty state, hide table
      if (DOM.teamTable) DOM.teamTable.classList.add('hidden');
      if (DOM.emptyState) DOM.emptyState.classList.remove('hidden');
      if (DOM.teamTableBody) DOM.teamTableBody.innerHTML = '';
      return;
    }

    // Show table, hide empty state
    if (DOM.teamTable) DOM.teamTable.classList.remove('hidden');
    if (DOM.emptyState) DOM.emptyState.classList.add('hidden');

    const html = filteredMembers.map((m, idx) => createMemberRowHTML(m, idx)).join('');
    if (DOM.teamTableBody) DOM.teamTableBody.innerHTML = html;
  }

  // ==========================================================================
  // 8. Backend API Operations (GET, PATCH, POST)
  // ==========================================================================

  /**
   * Fetches all team members from SQLite via FastAPI GET /api/users
   */
  async function fetchTeamMembers(isManualSync = false) {
    state.isLoading = !isManualSync;
    if (!isManualSync) renderTeamTable();

    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const users = await response.json();
      state.teamMembers = users;
      state.isLoading = false;

      updateDashboardMetrics();
      renderTeamTable();

      if (isManualSync) {
        showToast('Synchronized', 'Team members reloaded from database.', 'info');
      }
    } catch (error) {
      console.error('Failed to fetch team members from backend:', error);
      state.isLoading = false;

      // Show table error state
      if (DOM.teamTable) DOM.teamTable.classList.add('hidden');
      if (DOM.emptyState) DOM.emptyState.classList.add('hidden');
      if (DOM.tableLoadingState) DOM.tableLoadingState.classList.add('hidden');
      if (DOM.tableErrorState) DOM.tableErrorState.classList.remove('hidden');
      if (DOM.tableErrorMessage) {
        DOM.tableErrorMessage.textContent = `Could not reach ${API_BASE_URL}/api/users. Please verify the FastAPI backend is running. (${error.message})`;
      }

      showToast('Connection Error', 'Could not load team members from database.', 'error');
    }
  }

  /**
   * Handles asynchronous availability toggle changes
   * Sends PATCH request, rolls back on failure, updates SQLite
   */
  async function handleToggleChange(memberId, desiredStatus, checkboxElement) {
    const member = state.teamMembers.find(m => m.id === memberId);
    if (!member) return;

    // Prevent duplicate simultaneous requests on same user
    if (state.updatingUserIds.has(memberId)) return;

    // Store previous status for rollback if request fails
    const previousStatus = member.is_available;

    // Set updating lock & UI pending state
    state.updatingUserIds.add(memberId);
    if (checkboxElement) checkboxElement.disabled = true;
    const switchLabel = document.getElementById(`switch-wrap-${memberId}`);
    if (switchLabel) switchLabel.classList.add('pending');

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(memberId)}/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ is_available: desiredStatus })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned HTTP ${response.status}`);
      }

      const updatedUser = await response.json();

      // Update in-memory state with confirmed database value
      member.is_available = updatedUser.is_available;

      // Update row visual indicators
      const statusPill = document.getElementById(`status-pill-${memberId}`);
      if (statusPill) {
        const statusText = statusPill.querySelector('.status-text');
        if (updatedUser.is_available) {
          statusPill.className = 'status-pill status-available';
          if (statusText) statusText.textContent = 'Available';
        } else {
          statusPill.className = 'status-pill status-unavailable';
          if (statusText) statusText.textContent = 'Unavailable';
        }
      }

      // Recalculate summary metrics & filter counts
      updateDashboardMetrics();

      // If active filter would now exclude this member, re-render
      if (
        (state.currentFilter === 'available' && !updatedUser.is_available) ||
        (state.currentFilter === 'unavailable' && updatedUser.is_available)
      ) {
        renderTeamTable();
      } else {
        const filtered = getFilteredMembers();
        updateResultsStatusText(filtered.length, state.teamMembers.length);
      }

      // Display success toast notification
      const actionText = updatedUser.is_available ? 'marked as Available' : 'marked as Unavailable';
      showToast(member.name, actionText, updatedUser.is_available ? 'available' : 'unavailable');

    } catch (err) {
      console.error(`Failed to update availability for ${member.name}:`, err);

      // Rollback toggle switch in DOM
      if (checkboxElement) {
        checkboxElement.checked = previousStatus;
      }

      // Restore status pill
      const statusPill = document.getElementById(`status-pill-${memberId}`);
      if (statusPill) {
        const statusText = statusPill.querySelector('.status-text');
        if (previousStatus) {
          statusPill.className = 'status-pill status-available';
          if (statusText) statusText.textContent = 'Available';
        } else {
          statusPill.className = 'status-pill status-unavailable';
          if (statusText) statusText.textContent = 'Unavailable';
        }
      }

      // Display meaningful error notification
      showToast('Update Failed', `Could not update ${member.name}. Restored previous status. (${err.message})`, 'error');

    } finally {
      // Remove lock and restore interactive toggle
      state.updatingUserIds.delete(memberId);
      if (checkboxElement) checkboxElement.disabled = false;
      if (switchLabel) switchLabel.classList.remove('pending');
    }
  }

  /**
   * Resets all team members in SQLite back to initial defaults with user confirmation
   */
  async function handleResetData() {
    const confirmed = window.confirm(
      'Are you sure you want to reset all team members to their default availability values in the database?\n\nThis will update records in SQLite.'
    );
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/reset`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to reset database.`);
      }

      const users = await response.json();
      state.teamMembers = users;
      updateDashboardMetrics();
      renderTeamTable();

      showToast('Database Restored', 'All team members reset to initial default states in SQLite.', 'info');
    } catch (err) {
      console.error('Reset request failed:', err);
      showToast('Reset Failed', `Could not reset database: ${err.message}`, 'error');
    }
  }

  // ==========================================================================
  // 9. Toast Notification System
  // ==========================================================================

  /**
   * Displays an animated toast notification
   * @param {string} title
   * @param {string} message
   * @param {'available' | 'unavailable' | 'info' | 'error'} type
   */
  function showToast(title, message, type = 'info') {
    if (!DOM.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'available') {
      iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
    } else if (type === 'unavailable') {
      iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
    } else if (type === 'error') {
      iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `;
    } else {
      iconSvg = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      `;
    }

    toast.innerHTML = `
      <div class="toast-icon" aria-hidden="true">${iconSvg}</div>
      <div class="toast-content">
        <span class="toast-title">${escapeHTML(title)}</span>
        <span class="toast-message">${escapeHTML(message)}</span>
      </div>
      <button class="toast-close-btn" aria-label="Dismiss notification">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Dismiss logic
    const closeBtn = toast.querySelector('.toast-close-btn');
    const dismiss = () => {
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 250);
    };

    closeBtn.addEventListener('click', dismiss);

    // Auto dismiss after 3.8 seconds
    const timeout = setTimeout(dismiss, 3800);
    toast.addEventListener('mouseenter', () => clearTimeout(timeout));
    toast.addEventListener('mouseleave', () => setTimeout(dismiss, 2000));

    DOM.toastContainer.appendChild(toast);
  }

  // ==========================================================================
  // 10. Event Listeners Setup
  // ==========================================================================
  function setupEventListeners() {
    // A. Toggle switch delegation on table body
    if (DOM.teamTableBody) {
      DOM.teamTableBody.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('member-toggle')) {
          const memberId = e.target.getAttribute('data-id');
          const desiredStatus = e.target.checked;
          handleToggleChange(memberId, desiredStatus, e.target);
        }
      });
    }

    // B. Search Input
    if (DOM.searchInput) {
      DOM.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;

        if (DOM.searchClearBtn) {
          if (state.searchQuery.length > 0) {
            DOM.searchClearBtn.classList.add('visible');
          } else {
            DOM.searchClearBtn.classList.remove('visible');
          }
        }

        renderTeamTable();
      });
    }

    // C. Search Clear Button
    if (DOM.searchClearBtn) {
      DOM.searchClearBtn.addEventListener('click', () => {
        state.searchQuery = '';
        DOM.searchInput.value = '';
        DOM.searchClearBtn.classList.remove('visible');
        DOM.searchInput.focus();
        renderTeamTable();
      });
    }

    // D. Filter Tab Buttons
    DOM.filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');
        if (state.currentFilter === filter) return;

        state.currentFilter = filter;

        DOM.filterButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        renderTeamTable();
      });
    });

    // E. Reset Filters Buttons
    const resetFiltersHandler = () => {
      state.searchQuery = '';
      state.currentFilter = 'all';

      if (DOM.searchInput) DOM.searchInput.value = '';
      if (DOM.searchClearBtn) DOM.searchClearBtn.classList.remove('visible');

      DOM.filterButtons.forEach(b => {
        const isAll = b.getAttribute('data-filter') === 'all';
        b.classList.toggle('active', isAll);
        b.setAttribute('aria-selected', isAll ? 'true' : 'false');
      });

      renderTeamTable();
    };

    if (DOM.clearAllFiltersBtn) {
      DOM.clearAllFiltersBtn.addEventListener('click', resetFiltersHandler);
    }
    if (DOM.emptyStateResetBtn) {
      DOM.emptyStateResetBtn.addEventListener('click', resetFiltersHandler);
    }

    // F. Sync / Reload Data Button
    if (DOM.refreshDataBtn) {
      DOM.refreshDataBtn.addEventListener('click', () => {
        fetchTeamMembers(true);
      });
    }

    // G. Reset Data Button (calls backend POST /api/reset with confirmation)
    if (DOM.resetDataBtn) {
      DOM.resetDataBtn.addEventListener('click', handleResetData);
    }

    // H. Retry Fetch Button in Error State
    if (DOM.retryFetchBtn) {
      DOM.retryFetchBtn.addEventListener('click', () => {
        fetchTeamMembers();
      });
    }

    // I. Mobile Sidebar Drawer & Backdrop
    if (DOM.mobileToggleBtn && DOM.sidebar && DOM.sidebarBackdrop) {
      const openSidebar = () => {
        DOM.sidebar.classList.add('open');
        DOM.sidebarBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
      };

      const closeSidebar = () => {
        DOM.sidebar.classList.remove('open');
        DOM.sidebarBackdrop.classList.remove('active');
        document.body.style.overflow = '';
      };

      DOM.mobileToggleBtn.addEventListener('click', openSidebar);
      if (DOM.sidebarCloseBtn) {
        DOM.sidebarCloseBtn.addEventListener('click', closeSidebar);
      }
      DOM.sidebarBackdrop.addEventListener('click', closeSidebar);
    }
  }

  // ==========================================================================
  // 11. Application Initialization
  // ==========================================================================
  function init() {
    setupCurrentDate();
    setupEventListeners();
    fetchTeamMembers(); // Loads live data from FastAPI & SQLite
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
