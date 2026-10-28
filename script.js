
"use strict";

const API_BASE = "https://pshs-requirements-backend.onrender.com";

const SUBJECTS = [
  "Earth Science 1",
  "Biology 1",
  "Chemistry 1",
  "Physics 1",
  "Mathematics 2A",
  "Mathematics 2B",
  "Computer Science 2",
  "ADTech 2",
  "English 2",
  "Filipino 2",
  "Social Science 2",
  "Values Education 2",
  "Physical Education 2",
  "Health 2",
  "Music 2"
];

const SUBJECT_COLORS = [
  "#77b7ff", "#6ee7c1", "#ffb86b", "#a99bff", "#83a9ff",
  "#b6a0ff", "#66d9e8", "#f3a7d7", "#ffcf70", "#ff9eac",
  "#8cd9a7", "#c0a4ff", "#f2a879", "#71d9e6", "#f0a2d0"
];

const SUBJECT_ICONS = [
  "ES", "BI", "CH", "PH", "2A",
  "2B", "CS", "AD", "EN", "FI",
  "SS", "VE", "PE", "HE", "MU"
];

const state = {
  requirements: Object.fromEntries(SUBJECTS.map(subject => [subject, []])),
  activeSubject: "",
  search: "",
  adminMode: false,
  loading: false,
  pendingDeletion: null,
  lastUpdated: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const elements = {
  connectionDot: $("#connectionDot"),
  connectionText: $("#connectionText"),
  totalStat: $("#totalStat"),
  activeSubjectsStat: $("#activeSubjectsStat"),
  lastUpdatedStat: $("#lastUpdatedStat"),
  refreshCaption: $("#refreshCaption"),
  dashboardSubjectGrid: $("#dashboardSubjectGrid"),
  recentRequirements: $("#recentRequirements"),
  subjectNav: $("#subjectNav"),
  searchInput: $("#searchInput"),
  subjectFilter: $("#subjectFilter"),
  resultsCount: $("#resultsCount"),
  requirementsGrid: $("#requirementsGrid"),
  browseFooter: $("#browseFooter"),
  submissionForm: $("#submissionForm"),
  formSubject: $("#formSubject"),
  formLabel: $("#formLabel"),
  formDetails: $("#formDetails"),
  formDueDate: $("#formDueDate"),
  detailsCounter: $("#detailsCounter"),
  submitButton: $("#submitButton"),
  submitFeedback: $("#submitFeedback"),
  adminPassword: $("#adminPassword"),
  adminFeedback: $("#adminFeedback"),
  adminRequirements: $("#adminRequirements"),
  confirmModal: $("#confirmModal"),
  modalTitle: $("#modalTitle"),
  modalMessage: $("#modalMessage"),
  confirmDeleteButton: $("#confirmDeleteButton"),
  toastContainer: $("#toastContainer"),
  sidebar: $("#sidebar")
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function subjectIndex(subject) {
  return SUBJECTS.indexOf(subject);
}

function subjectColor(subject) {
  const index = subjectIndex(subject);
  return SUBJECT_COLORS[index >= 0 ? index : 0];
}

function subjectIcon(subject) {
  const index = subjectIndex(subject);
  return SUBJECT_ICONS[index >= 0 ? index : 0];
}

function allRequirements() {
  return SUBJECTS.flatMap(subject =>
    (state.requirements[subject] || []).map(requirement => ({
      ...requirement,
      subject
    }))
  );
}

function formatDate(value) {
  if (!value) return "No due date";

  // Avoid timezone shifts for ISO date-only values.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function setFeedback(element, message, type = "info") {
  element.textContent = message;
  element.className = `form-feedback feedback-${type}`;
}

function clearFeedback(element) {
  element.textContent = "";
  element.className = "form-feedback";
}

function showToast(title, message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = type === "error" ? "!" : "✓";

  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;

  const description = document.createElement("p");
  description.textContent = message;

  content.append(heading, description);
  toast.append(icon, content);
  elements.toastContainer.appendChild(toast);

  window.setTimeout(() => toast.remove(), 5000);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed with HTTP ${response.status}.`
    );
  }

  return data;
}

function setConnection(online, message) {
  elements.connectionDot.classList.toggle("online", online);
  elements.connectionDot.classList.toggle("offline", !online);
  elements.connectionText.textContent = message;
}

function renderSubjectControls() {
  elements.subjectNav.innerHTML = SUBJECTS.map((subject, index) => `
    <button class="nav-link subject-nav-link"
      data-subject="${escapeHTML(subject)}"
      style="--subject-color:${SUBJECT_COLORS[index]}">
      <span class="subject-dot"></span>
      <span>${escapeHTML(subject)}</span>
    </button>
  `).join("");

  const options = SUBJECTS.map(subject =>
    `<option value="${escapeHTML(subject)}">${escapeHTML(subject)}</option>`
  ).join("");

  elements.subjectFilter.insertAdjacentHTML("beforeend", options);
  elements.formSubject.insertAdjacentHTML("beforeend", options);
}

function updateStats() {
  const requirements = allRequirements();
  const activeSubjects = SUBJECTS.filter(subject =>
    (state.requirements[subject] || []).length > 0
  ).length;

  elements.totalStat.textContent = requirements.length;
  elements.activeSubjectsStat.innerHTML =
    `${activeSubjects} <span class="stat-unit">/ 15</span>`;

  if (state.lastUpdated) {
    elements.lastUpdatedStat.textContent =
      state.lastUpdated.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
    elements.refreshCaption.textContent = "Last successful sync";
  }
}

function renderDashboardSubjects() {
  elements.dashboardSubjectGrid.innerHTML = SUBJECTS.map((subject, index) => {
    const count = (state.requirements[subject] || []).length;
    const color = SUBJECT_COLORS[index];

    return `
      <button class="subject-card"
        data-subject="${escapeHTML(subject)}"
        style="--subject-color:${color}">
        <span class="subject-card-icon">${SUBJECT_ICONS[index]}</span>
        <span class="subject-card-copy">
          <strong>${escapeHTML(subject)}</strong>
          <small>${count} ${count === 1 ? "requirement" : "requirements"}</small>
        </span>
        <span class="subject-card-arrow">↗</span>
      </button>
    `;
  }).join("");
}

function requirementTitle(requirement) {
  return requirement.label || requirement.filename || "Untitled requirement";
}

function requirementDetails(requirement) {
  return requirement.details || "No additional details provided.";
}

function getFilteredRequirements() {
  const search = state.search.trim().toLowerCase();

  return allRequirements().filter(requirement => {
    if (state.activeSubject && requirement.subject !== state.activeSubject) {
      return false;
    }

    if (!search) return true;

    const searchable = [
      requirement.label,
      requirement.details,
      requirement.subject,
      requirement.dueDate
    ].join(" ").toLowerCase();

    return searchable.includes(search);
  });
}

function emptyState(title, description, button = false) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">⌕</div>
      <strong>${escapeHTML(title)}</strong>
      <p>${escapeHTML(description)}</p>
      ${button ? `
        <button class="button button-primary" data-view="submit" style="margin-top:15px">
          + Submit the first requirement
        </button>
      ` : ""}
    </div>
  `;
}

function requirementRow(requirement, includeAction = false) {
  const label = requirementTitle(requirement);
  const filename = requirement.filename ||
    `${label.trim().replace(/\s+/g, "-")}.json`;

  return `
    <tr>
      <td>
        <div class="requirement-name">
          <span class="file-icon">JSON</span>
          <div>
            <strong>${escapeHTML(label)}</strong>
            <small>${escapeHTML((requirement.details || "No details").slice(0, 75))}</small>
          </div>
        </div>
      </td>
      <td><span class="subject-tag">${escapeHTML(requirement.subject)}</span></td>
      <td>${escapeHTML(formatDate(requirement.dueDate))}</td>
      <td><span class="status-tag ${requirement.dueDate ? "" : "no-date"}">${requirement.dueDate ? "● Scheduled" : "○ No date"}</span></td>
      ${includeAction ? `
        <td>
          <button class="row-delete" title="Delete requirement"
            aria-label="Delete ${escapeHTML(label)}"
            data-delete-subject="${escapeHTML(requirement.subject)}"
            data-delete-filename="${escapeHTML(filename)}">✕</button>
        </td>
      ` : ""}
    </tr>
  `;
}

function renderRecentRequirements() {
  // The current backend does not store a creation timestamp, so this is
  // a directory preview, not a guaranteed chronological list.
  const requirements = allRequirements().slice(0, 6);

  if (!requirements.length) {
    elements.recentRequirements.innerHTML = `
      <tr><td colspan="5" class="table-message">
        No requirements yet. Submit the first one to get started.
      </td></tr>
    `;
    return;
  }

  elements.recentRequirements.innerHTML = requirements
    .map(requirement => requirementRow(requirement, true))
    .join("");
}

function renderBrowse() {
  const requirements = getFilteredRequirements();

  elements.resultsCount.textContent = requirements.length;

  if (!requirements.length) {
    const hasRequirements = allRequirements().length > 0;
    elements.requirementsGrid.innerHTML = emptyState(
      hasRequirements ? "No matching requirements" : "No requirements yet",
      hasRequirements
        ? "Try a different search or clear your filters."
        : "This directory is empty. Be the first to submit a requirement.",
      !hasRequirements
    );
  } else {
    elements.requirementsGrid.innerHTML = requirements.map(requirement => `
      <article class="requirement-card">
        <div class="requirement-card-top">
          <div>
            <h3 class="requirement-card-title">${escapeHTML(requirementTitle(requirement))}</h3>
            <div class="requirement-card-subject">${escapeHTML(requirement.subject)}</div>
          </div>
          <span class="file-icon">JSON</span>
        </div>
        <p class="requirement-card-details">${escapeHTML(requirementDetails(requirement))}</p>
        <div class="requirement-card-bottom">
          <span class="due-label">Due: ${escapeHTML(formatDate(requirement.dueDate))}</span>
          ${state.adminMode ? `
            <button class="row-delete"
              aria-label="Delete ${escapeHTML(requirementTitle(requirement))}"
              title="Delete requirement"
              data-delete-subject="${escapeHTML(requirement.subject)}"
              data-delete-filename="${escapeHTML(requirement.filename || `${requirementTitle(requirement).trim().replace(/\s+/g, "-")}.json`)}">✕</button>
          ` : ""}
        </div>
      </article>
    `).join("");
  }

  elements.browseFooter.textContent = requirements.length
    ? `Showing ${requirements.length} of ${allRequirements().length} requirements`
    : "";
}

function renderAdminRequirements() {
  if (!state.adminMode) return;

  const requirements = allRequirements();

  if (!requirements.length) {
    elements.adminRequirements.innerHTML = `
      <tr><td colspan="4" class="table-message">There are no requirements to manage.</td></tr>
    `;
    return;
  }

  elements.adminRequirements.innerHTML = requirements.map(requirement => {
    const label = requirementTitle(requirement);
    const filename = requirement.filename ||
      `${label.trim().replace(/\s+/g, "-")}.json`;

    return `
      <tr>
        <td>
          <div class="requirement-name">
            <span class="file-icon">JSON</span>
            <div><strong>${escapeHTML(label)}</strong>
              <small>${escapeHTML(filename)}</small></div>
          </div>
        </td>
        <td><span class="subject-tag">${escapeHTML(requirement.subject)}</span></td>
        <td>${escapeHTML(formatDate(requirement.dueDate))}</td>
        <td>
          <button class="row-delete"
            aria-label="Delete ${escapeHTML(label)}"
            title="Delete requirement"
            data-delete-subject="${escapeHTML(requirement.subject)}"
            data-delete-filename="${escapeHTML(filename)}">✕</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderAll() {
  updateStats();
  renderDashboardSubjects();
  renderRecentRequirements();
  renderBrowse();
  renderAdminRequirements();
  updateNavigation();
}

function updateNavigation() {
  const currentView = $$(".page-view").find(view => view.classList.contains("active"));
  const currentId = currentView?.id || "dashboardView";

  const viewNames = {
    dashboardView: "Dashboard",
    browseView: "Browse requirements",
    submitView: "Submit requirement",
    adminView: "Admin controls"
  };

  $("#breadcrumbCurrent").textContent = viewNames[currentId] || "Dashboard";

  $$(".main-nav [data-view]").forEach(button => {
    const isActive = button.dataset.view === currentId.replace("View", "");
    button.classList.toggle("active", isActive);
  });

  $$(".subject-nav-link").forEach(button => {
    button.classList.toggle(
      "active",
      currentId === "browseView" && button.dataset.subject === state.activeSubject
    );
  });

  $("#adminModeButton").classList.toggle("active", currentId === "adminView");
}

function showView(name) {
  const view = $(`#${name}View`);
  if (!view) return;

  $$(".page-view").forEach(item => item.classList.remove("active"));
  view.classList.add("active");

  elements.sidebar.classList.remove("open");
  updateNavigation();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectSubject(subject) {
  state.activeSubject = SUBJECTS.includes(subject) ? subject : "";
  elements.subjectFilter.value = state.activeSubject;
  showView("browse");
  renderBrowse();
  updateNavigation();
}

async function loadRequirements({ quiet = false } = {}) {
  if (state.loading) return;
  state.loading = true;

  const refreshButton = $("#refreshButton");
  refreshButton.disabled = true;
  refreshButton.innerHTML = "<span>↻</span> Loading";

  if (!quiet) {
    elements.recentRequirements.innerHTML =
      `<tr><td colspan="5" class="table-message">Loading requirements...</td></tr>`;
  }

  try {
    const data = await apiRequest("/requirements");
    const incoming = data.requirements;

    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      throw new Error("The backend returned an unexpected response format.");
    }

    const nextRequirements = {};

    for (const subject of SUBJECTS) {
      const list = incoming[subject];

      if (list !== undefined && !Array.isArray(list)) {
        throw new Error(`Unexpected data format for ${subject}.`);
      }

      nextRequirements[subject] = (list || []).filter(item =>
        item && typeof item === "object" && !Array.isArray(item)
      );
    }

    state.requirements = nextRequirements;
    state.lastUpdated = new Date();

    setConnection(true, "Connected");
    renderAll();

    if (!quiet) {
      showToast("Requirements updated", "The directory has been refreshed.");
    }
  } catch (error) {
    console.error("Failed to load requirements:", error);
    setConnection(false, "Connection failed");

    if (!quiet) {
      showToast(
        "Unable to load requirements",
        `${error.message} Check the backend URL and Render service status.`,
        "error"
      );
    }

    if (!state.lastUpdated) {
      elements.recentRequirements.innerHTML =
        `<tr><td colspan="5" class="table-message">Unable to load data. Use Refresh to try again.</td></tr>`;
      elements.dashboardSubjectGrid.innerHTML = emptyState(
        "Could not connect",
        "Check that your backend is deployed and online."
      );
      elements.requirementsGrid.innerHTML = emptyState(
        "Could not load requirements",
        "Check your connection and try refreshing."
      );
    }
  } finally {
    state.loading = false;
    refreshButton.disabled = false;
    refreshButton.innerHTML = "<span>↻</span> Refresh";
  }
}

function setSubmitBusy(busy) {
  elements.submitButton.disabled = busy;
  elements.submitButton.innerHTML = busy
    ? '<span class="loading-spinner"></span> Submitting...'
    : "<span>↑</span> Submit requirement";
}

async function submitRequirement(event) {
  event.preventDefault();
  clearFeedback(elements.submitFeedback);

  const payload = {
    subject: elements.formSubject.value,
    label: elements.formLabel.value.trim(),
    details: elements.formDetails.value.trim(),
    dueDate: elements.formDueDate.value
  };

  if (!payload.subject || !SUBJECTS.includes(payload.subject)) {
    setFeedback(elements.submitFeedback, "Please select a valid subject.", "error");
    return;
  }

  if (!payload.label) {
    setFeedback(elements.submitFeedback, "Please enter a requirement label.", "error");
    elements.formLabel.focus();
    return;
  }

  setSubmitBusy(true);
  setFeedback(elements.submitFeedback, "Sending your submission to the server...", "info");

  try {
    const result = await apiRequest("/submit", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    setFeedback(
      elements.submitFeedback,
      result.message || "Requirement submitted successfully.",
      "success"
    );

    showToast("Submission successful", `${payload.label} was submitted to ${payload.subject}.`);

    elements.submissionForm.reset();
    elements.detailsCounter.textContent = "0 / 5000";

    await loadRequirements({ quiet: true });
    showView("browse");
    state.activeSubject = payload.subject;
    elements.subjectFilter.value = payload.subject;
    renderBrowse();
    updateNavigation();
  } catch (error) {
    console.error("Submission failed:", error);

    const message = error.message.includes("Failed to fetch")
      ? "Could not reach the backend. It may be waking up, or the service may be unavailable. Please try again."
      : error.message;

    setFeedback(elements.submitFeedback, message, "error");
    showToast("Submission failed", message, "error");
  } finally {
    setSubmitBusy(false);
  }
}

function enterAdminMode() {
  state.adminMode = true;
  document.body.classList.add("admin-enabled");
  showView("admin");
  clearFeedback(elements.adminFeedback);
  renderBrowse();
  renderAdminRequirements();
  elements.adminPassword.focus();
}

function exitAdminMode() {
  state.adminMode = false;
  document.body.classList.remove("admin-enabled");

  // The password is never stored in localStorage or sessionStorage.
  elements.adminPassword.value = "";
  clearFeedback(elements.adminFeedback);
  closeDeleteModal();

  showView("dashboard");
  renderBrowse();
  renderRecentRequirements();
}

function requestDeletion(subject, filename) {
  if (!state.adminMode) {
    showToast("Admin access required", "Enter admin mode to delete requirements.", "error");
    return;
  }

  if (!elements.adminPassword.value) {
    setFeedback(elements.adminFeedback, "Enter the admin password before deleting.", "error");
    elements.adminPassword.focus();
    return;
  }

  if (!SUBJECTS.includes(subject) || typeof filename !== "string") {
    showToast("Invalid selection", "The selected requirement is invalid.", "error");
    return;
  }

  state.pendingDeletion = { subject, filename };

  const requirement = (state.requirements[subject] || []).find(item =>
    item.filename === filename
  );

  elements.modalTitle.textContent = "Delete requirement?";
  elements.modalMessage.textContent =
    `You are about to permanently delete "${requirementTitle(requirement || { label: filename })}" from ${subject}. This action cannot be undone.`;

  elements.confirmModal.hidden = false;
  elements.confirmDeleteButton.focus();
}

function closeDeleteModal() {
  elements.confirmModal.hidden = true;
  state.pendingDeletion = null;
}

async function confirmDeletion() {
  if (!state.pendingDeletion) return;

  if (!elements.adminPassword.value) {
    closeDeleteModal();
    setFeedback(elements.adminFeedback, "Enter the admin password before deleting.", "error");
    return;
  }

  const { subject, filename } = state.pendingDeletion;
  const password = elements.adminPassword.value;

  elements.confirmDeleteButton.disabled = true;
  elements.confirmDeleteButton.textContent = "Deleting...";

  try {
    const result = await apiRequest("/delete", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${password}`
      },
      body: JSON.stringify({ subject, filename })
    });

    closeDeleteModal();
    setFeedback(
      elements.adminFeedback,
      result.message || "Requirement deleted successfully.",
      "success"
    );

    showToast("Requirement deleted", `${filename} was removed from ${subject}.`);
    await loadRequirements({ quiet: true });
  } catch (error) {
    console.error("Deletion failed:", error);

    const message = error.message.includes("Failed to fetch")
      ? "Could not reach the backend. Check the service and try again."
      : error.message;

    closeDeleteModal();
    setFeedback(elements.adminFeedback, message, "error");
    showToast("Deletion failed", message, "error");
  } finally {
    elements.confirmDeleteButton.disabled = false;
    elements.confirmDeleteButton.textContent = "Delete permanently";
  }
}

function bindEvents() {
  // Main navigation and page actions.
  document.addEventListener("click", event => {
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      showView(viewButton.dataset.view);
      return;
    }

    const subjectButton = event.target.closest("[data-subject]");
    if (subjectButton) {
      selectSubject(subjectButton.dataset.subject);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-subject]");
    if (deleteButton) {
      requestDeletion(
        deleteButton.dataset.deleteSubject,
        deleteButton.dataset.deleteFilename
      );
    }
  });

  $("#navDashboard").addEventListener("click", () => showView("dashboard"));
  $("#navBrowse").addEventListener("click", () => {
    state.activeSubject = "";
    elements.subjectFilter.value = "";
    renderBrowse();
    showView("browse");
  });
  $("#navSubmit").addEventListener("click", () => showView("submit"));

  $("#adminModeButton").addEventListener("click", () => {
    if (state.adminMode) {
      showView("admin");
    } else {
      enterAdminMode();
    }
  });

  $("#exitAdminButton").addEventListener("click", exitAdminMode);

  // Refresh controls.
  $("#refreshButton").addEventListener("click", () => loadRequirements());
  $("#adminRefreshButton").addEventListener("click", () => loadRequirements());

  // Search and subject filtering.
  elements.searchInput.addEventListener("input", () => {
    state.search = elements.searchInput.value;
    renderBrowse();
  });

  elements.subjectFilter.addEventListener("change", () => {
    state.activeSubject = elements.subjectFilter.value;
    renderBrowse();
    updateNavigation();
  });

  $("#clearFiltersButton").addEventListener("click", () => {
    state.search = "";
    state.activeSubject = "";
    elements.searchInput.value = "";
    elements.subjectFilter.value = "";
    renderBrowse();
    updateNavigation();
  });

  // Submission form.
  elements.submissionForm.addEventListener("submit", submitRequirement);

  $("#resetFormButton").addEventListener("click", () => {
    elements.submissionForm.reset();
    elements.detailsCounter.textContent = "0 / 5000";
    clearFeedback(elements.submitFeedback);
  });

  elements.formDetails.addEventListener("input", () => {
    elements.detailsCounter.textContent =
      `${elements.formDetails.value.length} / 5000`;
  });

  // Admin deletion confirmation.
  $("#cancelDeleteButton").addEventListener("click", closeDeleteModal);
  elements.confirmDeleteButton.addEventListener("click", confirmDeletion);

  elements.confirmModal.addEventListener("click", event => {
    if (event.target === elements.confirmModal) closeDeleteModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeDeleteModal();
      elements.sidebar.classList.remove("open");
    }
  });

  // Mobile sidebar.
  $("#mobileMenuButton").addEventListener("click", () => {
    elements.sidebar.classList.toggle("open");
  });

  document.addEventListener("click", event => {
    if (
      window.innerWidth <= 680 &&
      !elements.sidebar.contains(event.target) &&
      !event.target.closest("#mobileMenuButton")
    ) {
      elements.sidebar.classList.remove("open");
    }
  });
}

function init() {
  elements.footerYear = $("#footerYear");
  elements.footerYear.textContent = new Date().getFullYear();

  renderSubjectControls();
  bindEvents();

  renderDashboardSubjects();
  renderBrowse();
  setConnection(false, "Connecting...");
  loadRequirements();

  // No password or submission data is persisted in browser storage.
}

init();
